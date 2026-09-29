import XCTest
@testable import Blokudoku

final class GameModelTests: XCTestCase {
    private func makeModel(_ shape: Int = 0) -> GameModel {
        let d = UserDefaults(suiteName: "test.\(UUID().uuidString)")!
        return GameModel(defaults: d, generator: { Piece(shape: shape, color: 0) })
    }

    func testShapeCount() {
        XCTAssertEqual(Shapes.all.count, 35)
        XCTAssertEqual(Shapes.all[10].count, 9)
    }

    func testPlaceScoresCells() {
        let m = makeModel(0)
        XCTAssertTrue(m.place(pieceAt: 0, at: 4, 4))
        XCTAssertEqual(m.score, 1)
        XCTAssertFalse(m.canPlace(Piece(shape: 0, color: 0), at: 4, 4))
    }

    func testRowClearScoring() {
        let m = makeModel(0)
        for c in 0..<9 {
            let idx = m.pieces.firstIndex { $0 != nil }!
            XCTAssertTrue(m.place(pieceAt: idx, at: 0, c))
        }
        // 9 cells placed + one line: 1 * 10 * 1
        XCTAssertEqual(m.score, 19)
        XCTAssertEqual(m.combo, 1)
        XCTAssertEqual(m.grid[0], Array(repeating: 0, count: 9))
    }
}
