import SwiftUI
import UIKit

private let pageBackground = Color(red: 0.09, green: 0.10, blue: 0.16)
private let boardBackground = Color(red: 0.16, green: 0.18, blue: 0.27)
private let cellLight = Color(red: 0.24, green: 0.27, blue: 0.38)
private let cellDark = Color(red: 0.19, green: 0.21, blue: 0.31)

/// A piece drawn as a grid of square blocks.
struct PieceView: View {
    let piece: Piece
    let cell: CGFloat

    var body: some View {
        let filled = Set(piece.cells)
        VStack(spacing: 0) {
            ForEach(0..<piece.height, id: \.self) { r in
                HStack(spacing: 0) {
                    ForEach(0..<piece.width, id: \.self) { c in
                        if filled.contains(Offset(r: r, c: c)) {
                            RoundedRectangle(cornerRadius: cell * 0.16)
                                .fill(blockColors[piece.color])
                                .padding(cell * 0.05)
                                .frame(width: cell, height: cell)
                        } else {
                            Color.clear.frame(width: cell, height: cell)
                        }
                    }
                }
            }
        }
    }
}

struct ContentView: View {
    @StateObject private var model = GameModel()

    @State private var dragIndex: Int? = nil
    @State private var dragPoint: CGPoint = .zero
    @State private var confirmNew = false

    private let lift: CGFloat = 70

    // Fixed vertical layout, so the board and tray positions are computed
    // directly instead of measured (measuring via preferences proved unreliable).
    private let topPad: CGFloat = 8
    private let headerH: CGFloat = 64
    private let messageH: CGFloat = 22
    private let gap: CGFloat = 14

    private struct Metrics {
        var boardSize: CGFloat
        var pitch: CGFloat
        var boardOrigin: CGPoint
        var trayOrigin: CGPoint
        var trayCell: CGFloat
        var slotW: CGFloat
        var slotH: CGFloat
    }

    private func metrics(_ geo: GeometryProxy) -> Metrics {
        let boardSize = floor(min(geo.size.width - 24, geo.size.height * 0.52, 520))
        let pitch = boardSize / CGFloat(GameModel.size)
        let x = (geo.size.width - boardSize) / 2
        let y = topPad + headerH + gap + messageH + gap
        let trayCell = floor(pitch * 0.55)
        return Metrics(boardSize: boardSize, pitch: pitch,
                       boardOrigin: CGPoint(x: x, y: y),
                       trayOrigin: CGPoint(x: x, y: y + boardSize + gap),
                       trayCell: trayCell, slotW: boardSize / 3, slotH: trayCell * 5 + 12)
    }

    var body: some View {
        GeometryReader { geo in
            let m = metrics(geo)

            ZStack(alignment: .topLeading) {
                pageBackground.ignoresSafeArea()

                VStack(spacing: gap) {
                    header.frame(height: headerH)
                    Text(model.message.isEmpty ? " " : model.message)
                        .font(.headline)
                        .foregroundColor(.yellow)
                        .frame(height: messageH)
                    boardView(m: m)
                    trayView(m: m)
                }
                .padding(.top, topPad)
                .frame(width: geo.size.width, height: geo.size.height, alignment: .top)

                ghostView(m: m)

                if model.isOver {
                    gameOverView
                        .frame(width: geo.size.width, height: geo.size.height)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .contentShape(Rectangle())
            .simultaneousGesture(dragGesture(m: m))
        }
        .preferredColorScheme(.dark)
        .alert("Start a new game?", isPresented: $confirmNew) {
            Button("Cancel", role: .cancel) {}
            Button("New game", role: .destructive) { model.newGame() }
        }
    }

    // MARK: Header

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                Text("SCORE").font(.caption).foregroundColor(.gray)
                Text("\(model.score)").font(.system(size: 34, weight: .bold, design: .rounded))
            }
            Spacer()
            VStack(spacing: 8) {
                Text("Blokudoku").font(.headline)
                Button("New game") {
                    if model.isOver || model.score == 0 {
                        model.newGame()
                    } else {
                        confirmNew = true
                    }
                }
                .buttonStyle(.bordered)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("BEST").font(.caption).foregroundColor(.gray)
                Text("\(model.best)").font(.system(size: 34, weight: .bold, design: .rounded))
            }
        }
        .padding(.horizontal, 20)
        .foregroundColor(.white)
    }

    // MARK: Board

    private func boardView(m: Metrics) -> some View {
        let preview = previewState(m)
        return VStack(spacing: 0) {
            ForEach(0..<GameModel.size, id: \.self) { r in
                HStack(spacing: 0) {
                    ForEach(0..<GameModel.size, id: \.self) { c in
                        cellView(r: r, c: c, pitch: m.pitch, preview: preview)
                    }
                }
            }
        }
        .frame(width: m.boardSize, height: m.boardSize)
        .background(boardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private struct PreviewState {
        var cells: Set<Int> = []
        var willClear: Set<Int> = []
        var color: Int = 0
    }

    private func cellView(r: Int, c: Int, pitch: CGFloat, preview: PreviewState) -> some View {
        let idx = r * GameModel.size + c
        let v = model.grid[r][c]
        let alt = ((r / 3) + (c / 3)) % 2 == 1
        let radius = pitch * 0.14
        return ZStack {
            RoundedRectangle(cornerRadius: radius)
                .fill(alt ? cellDark : cellLight)
                .padding(1)
            if v > 0 {
                RoundedRectangle(cornerRadius: radius)
                    .fill(blockColors[v - 1])
                    .padding(1.5)
            }
            if preview.cells.contains(idx) {
                RoundedRectangle(cornerRadius: radius)
                    .fill(blockColors[preview.color].opacity(0.6))
                    .padding(1.5)
            }
            if preview.willClear.contains(idx) {
                RoundedRectangle(cornerRadius: radius)
                    .stroke(Color.white, lineWidth: 2)
                    .padding(1.5)
            }
            RoundedRectangle(cornerRadius: radius)
                .fill(Color.white)
                .padding(1)
                .opacity(model.flash.contains(idx) ? 0.9 : 0)
                .animation(.easeOut(duration: 0.3), value: model.flash)
        }
        .frame(width: pitch, height: pitch)
    }

    // MARK: Tray

    private func trayView(m: Metrics) -> some View {
        HStack(spacing: 0) {
            ForEach(0..<3, id: \.self) { i in
                slot(index: i, trayCell: m.trayCell)
                    .frame(width: m.slotW, height: m.slotH)
            }
        }
        .frame(width: m.boardSize)
    }

    @ViewBuilder
    private func slot(index i: Int, trayCell: CGFloat) -> some View {
        if i < model.pieces.count, let p = model.pieces[i] {
            let fits = model.fitsAnywhere(p)
            PieceView(piece: p, cell: trayCell)
                .saturation(fits ? 1 : 0)
                .opacity(dragIndex == i ? 0.0 : (fits ? 1 : 0.35))
        } else {
            Color.clear
        }
    }

    // MARK: Dragging
    // All points below are in the local space of the root ZStack.

    private func slotIndex(at p: CGPoint, _ m: Metrics) -> Int? {
        let slop: CGFloat = 12
        guard p.x >= m.trayOrigin.x, p.x <= m.trayOrigin.x + m.boardSize,
              p.y >= m.trayOrigin.y - slop, p.y <= m.trayOrigin.y + m.slotH + slop else { return nil }
        return min(2, max(0, Int((p.x - m.trayOrigin.x) / m.slotW)))
    }

    private func dragGesture(m: Metrics) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                if dragIndex == nil {
                    guard !model.isOver,
                          let i = slotIndex(at: value.startLocation, m),
                          i < model.pieces.count, model.pieces[i] != nil else { return }
                    dragIndex = i
                }
                dragPoint = value.location
            }
            .onEnded { value in
                guard let i = dragIndex else { return }
                dragPoint = value.location
                let target = dropTarget(m)
                dragIndex = nil
                if let t = target {
                    let cleared = model.pieces[i].map { !model.wouldClear($0, at: t.r, t.c).isEmpty } ?? false
                    if model.place(pieceAt: i, at: t.r, t.c) {
                        let style: UIImpactFeedbackGenerator.FeedbackStyle = cleared ? .medium : .light
                        UIImpactFeedbackGenerator(style: style).impactOccurred()
                    }
                }
            }
    }

    /// Top-left board cell the dragged piece would occupy, if placement is valid.
    private func dropTarget(_ m: Metrics) -> Offset? {
        guard let i = dragIndex, i < model.pieces.count, let p = model.pieces[i] else { return nil }
        let left = dragPoint.x - CGFloat(p.width) * m.pitch / 2
        let top = dragPoint.y - lift - CGFloat(p.height) * m.pitch / 2
        let c = Int(((left - m.boardOrigin.x) / m.pitch).rounded())
        let r = Int(((top - m.boardOrigin.y) / m.pitch).rounded())
        return model.canPlace(p, at: r, c) ? Offset(r: r, c: c) : nil
    }

    private func previewState(_ m: Metrics) -> PreviewState {
        var st = PreviewState()
        guard let i = dragIndex, i < model.pieces.count, let p = model.pieces[i],
              let t = dropTarget(m) else { return st }
        for o in p.cells {
            st.cells.insert((t.r + o.r) * GameModel.size + t.c + o.c)
        }
        st.willClear = model.wouldClear(p, at: t.r, t.c)
        st.color = p.color
        return st
    }

    @ViewBuilder
    private func ghostView(m: Metrics) -> some View {
        if let i = dragIndex, i < model.pieces.count, let p = model.pieces[i] {
            PieceView(piece: p, cell: m.pitch)
                .shadow(color: .black.opacity(0.4), radius: 6, y: 4)
                .position(x: dragPoint.x, y: dragPoint.y - lift)
                .allowsHitTesting(false)
        }
    }

    // MARK: Game over

    private var gameOverView: some View {
        ZStack {
            Color.black.opacity(0.7).ignoresSafeArea()
            VStack(spacing: 14) {
                Text("Game over").font(.largeTitle.bold())
                Text("Score: \(model.score)").font(.title2)
                if model.isNewBest {
                    Text("New best!").font(.headline).foregroundColor(.yellow)
                }
                Button("Play again") { model.newGame() }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
            }
            .foregroundColor(.white)
            .padding(32)
            .background(boardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }
}
