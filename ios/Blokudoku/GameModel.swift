import Foundation
import SwiftUI

struct Offset: Hashable {
    let r: Int
    let c: Int
}

enum Shapes {
    /// Rows separated by "/", "#" = filled cell. Same 35 shapes as the PWA.
    private static let raw: [String] = [
        "#",
        "##", "#/#",
        "###", "#/#/#",
        "####", "#/#/#/#",
        "#####", "#/#/#/#/#",
        "##/##",
        "###/###/###",
        "#./##", "##/#.", "##/.#", ".#/##",
        "#./#./##", ".#/.#/##", "##/#./#.", "##/.#/.#",
        "###/#..", "###/..#", "#../###", "..#/###",
        "###/.#.", ".#./###", "#./##/#.", ".#/##/.#",
        ".##/##.", "##./.##", "#./##/.#", ".#/##/#.",
        "###/#../#..", "###/..#/..#", "#../#../###", "..#/..#/###",
    ]

    static let all: [[Offset]] = raw.map { s -> [Offset] in
        var out: [Offset] = []
        for (r, row) in s.split(separator: "/").enumerated() {
            for (c, ch) in row.enumerated() where ch == "#" {
                out.append(Offset(r: r, c: c))
            }
        }
        return out
    }
}

let blockColors: [Color] = [
    Color(red: 0xef / 255.0, green: 0x5b / 255.0, blue: 0x5b / 255.0),
    Color(red: 0xf3 / 255.0, green: 0x9c / 255.0, blue: 0x3d / 255.0),
    Color(red: 0xf2 / 255.0, green: 0xd1 / 255.0, blue: 0x4b / 255.0),
    Color(red: 0x5c / 255.0, green: 0xc4 / 255.0, blue: 0x6b / 255.0),
    Color(red: 0x3f / 255.0, green: 0xb5 / 255.0, blue: 0xd9 / 255.0),
    Color(red: 0x5b / 255.0, green: 0x7c / 255.0, blue: 0xf0 / 255.0),
    Color(red: 0xb6 / 255.0, green: 0x67 / 255.0, blue: 0xe0 / 255.0),
]

struct Piece: Codable, Equatable {
    var shape: Int
    var color: Int

    var cells: [Offset] { Shapes.all[shape] }
    var height: Int { (cells.map { $0.r }.max() ?? 0) + 1 }
    var width: Int { (cells.map { $0.c }.max() ?? 0) + 1 }

    static func random() -> Piece {
        Piece(shape: Int.random(in: 0..<Shapes.all.count), color: Int.random(in: 0..<blockColors.count))
    }
}

struct SavedGame: Codable {
    var grid: [[Int]]
    var pieces: [Piece?]
    var score: Int
    var combo: Int
}

final class GameModel: ObservableObject {
    static let size = 9
    static let stateKey = "blokudoku.state"
    static let bestKey = "blokudoku.best"

    @Published private(set) var grid: [[Int]] = Array(repeating: Array(repeating: 0, count: 9), count: 9)
    @Published private(set) var pieces: [Piece?] = []
    @Published private(set) var score = 0
    @Published private(set) var combo = 0
    @Published private(set) var best = 0
    @Published private(set) var isOver = false
    @Published private(set) var isNewBest = false
    /// Flat indices (r * 9 + c) of cells cleared by the last move, used for a brief flash.
    @Published private(set) var flash: Set<Int> = []
    @Published private(set) var message = ""

    private let defaults: UserDefaults
    private let generator: () -> Piece

    init(defaults: UserDefaults = .standard, generator: @escaping () -> Piece = { Piece.random() }) {
        self.defaults = defaults
        self.generator = generator
        best = defaults.integer(forKey: Self.bestKey)
        if let data = defaults.data(forKey: Self.stateKey),
           let saved = try? JSONDecoder().decode(SavedGame.self, from: data),
           saved.grid.count == Self.size,
           saved.grid.allSatisfy({ $0.count == Self.size }),
           saved.pieces.count == 3,
           saved.pieces.allSatisfy({ $0 == nil || Shapes.all.indices.contains($0!.shape) }) {
            grid = saved.grid
            pieces = saved.pieces
            score = saved.score
            combo = saved.combo
            updateStatus()
        } else {
            newGame()
        }
    }

    // MARK: Rules

    func canPlace(_ p: Piece, at r: Int, _ c: Int) -> Bool {
        let n = Self.size
        for o in p.cells {
            let rr = r + o.r, cc = c + o.c
            if rr < 0 || rr >= n || cc < 0 || cc >= n || grid[rr][cc] != 0 { return false }
        }
        return true
    }

    func fitsAnywhere(_ p: Piece) -> Bool {
        for r in 0..<Self.size {
            for c in 0..<Self.size where canPlace(p, at: r, c) { return true }
        }
        return false
    }

    /// Flat indices of every cell belonging to a full row, column or 3x3 box in `g`, plus the group count.
    static func fullCells(in g: [[Int]]) -> (cells: Set<Int>, groups: Int) {
        let n = size
        var cells = Set<Int>()
        var groups = 0
        for i in 0..<n {
            let br = (i / 3) * 3, bc = (i % 3) * 3
            var row: [Int] = [], col: [Int] = [], box: [Int] = []
            for j in 0..<n {
                row.append(i * n + j)
                col.append(j * n + i)
                box.append((br + j / 3) * n + bc + j % 3)
            }
            for grp in [row, col, box] {
                if grp.allSatisfy({ g[$0 / n][$0 % n] != 0 }) {
                    groups += 1
                    cells.formUnion(grp)
                }
            }
        }
        return (cells, groups)
    }

    /// Cells that would be cleared if `p` were placed at (r, c). Assumes the placement is valid.
    func wouldClear(_ p: Piece, at r: Int, _ c: Int) -> Set<Int> {
        var t = grid
        for o in p.cells { t[r + o.r][c + o.c] = 1 }
        return Self.fullCells(in: t).cells
    }

    // MARK: Actions

    func newGame() {
        grid = Array(repeating: Array(repeating: 0, count: Self.size), count: Self.size)
        pieces = newSet()
        score = 0
        combo = 0
        isOver = false
        isNewBest = false
        flash = []
        message = ""
        save()
    }

    private func newSet() -> [Piece?] {
        [generator(), generator(), generator()]
    }

    /// Places tray piece `index` with its top-left at (r, c). Returns false if invalid.
    @discardableResult
    func place(pieceAt index: Int, at r: Int, _ c: Int) -> Bool {
        guard !isOver, pieces.indices.contains(index), let p = pieces[index], canPlace(p, at: r, c) else {
            return false
        }
        for o in p.cells { grid[r + o.r][c + o.c] = p.color + 1 }
        pieces[index] = nil
        score += p.cells.count

        let result = Self.fullCells(in: grid)
        let n = result.groups
        if n == 0 {
            combo = 0
            message = ""
        } else {
            combo += 1
            score += n * 10 * n + (combo - 1) * 10
            for k in result.cells { grid[k / Self.size][k % Self.size] = 0 }
            message = (n > 1 ? "\(n) lines! " : "") + (combo > 1 ? "Combo x\(combo)" : "")
            flashCells(result.cells)
        }

        if pieces.allSatisfy({ $0 == nil }) { pieces = newSet() }
        updateStatus()
        return true
    }

    private func flashCells(_ cells: Set<Int>) {
        flash = cells
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
            self?.flash = []
        }
    }

    private func updateStatus() {
        if score > best {
            best = score
            defaults.set(best, forKey: Self.bestKey)
        }
        var anyFits = false
        for case let p? in pieces where fitsAnywhere(p) {
            anyFits = true
            break
        }
        if !isOver && !anyFits {
            isOver = true
            isNewBest = score > 0 && score >= best
        }
        save()
    }

    private func save() {
        if isOver {
            defaults.removeObject(forKey: Self.stateKey)
        } else {
            let state = SavedGame(grid: grid, pieces: pieces, score: score, combo: combo)
            if let data = try? JSONEncoder().encode(state) {
                defaults.set(data, forKey: Self.stateKey)
            }
        }
    }
}
