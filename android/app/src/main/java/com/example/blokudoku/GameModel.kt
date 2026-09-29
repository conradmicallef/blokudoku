package com.example.blokudoku

import kotlin.random.Random

const val N = 9
const val COLOR_COUNT = 7

private fun s(vararg p: Int): List<IntArray> = p.toList().chunked(2).map { intArrayOf(it[0], it[1]) }

/** Shapes as (row, col) offsets; identical to the PWA. */
val SHAPES: List<List<IntArray>> = listOf(
    s(0,0),
    s(0,0, 0,1), s(0,0, 1,0),
    s(0,0, 0,1, 0,2), s(0,0, 1,0, 2,0),
    s(0,0, 0,1, 0,2, 0,3), s(0,0, 1,0, 2,0, 3,0),
    s(0,0, 0,1, 0,2, 0,3, 0,4), s(0,0, 1,0, 2,0, 3,0, 4,0),
    s(0,0, 0,1, 1,0, 1,1),
    s(0,0, 0,1, 0,2, 1,0, 1,1, 1,2, 2,0, 2,1, 2,2),
    s(0,0, 1,0, 1,1), s(0,0, 0,1, 1,0), s(0,0, 0,1, 1,1), s(0,1, 1,0, 1,1),
    s(0,0, 1,0, 2,0, 2,1), s(0,1, 1,1, 2,1, 2,0), s(0,0, 0,1, 1,0, 2,0), s(0,0, 0,1, 1,1, 2,1),
    s(0,0, 0,1, 0,2, 1,0), s(0,0, 0,1, 0,2, 1,2), s(0,0, 1,0, 1,1, 1,2), s(1,0, 1,1, 1,2, 0,2),
    s(0,0, 0,1, 0,2, 1,1), s(1,0, 1,1, 1,2, 0,1), s(0,0, 1,0, 2,0, 1,1), s(0,1, 1,1, 2,1, 1,0),
    s(0,1, 0,2, 1,0, 1,1), s(0,0, 0,1, 1,1, 1,2), s(0,0, 1,0, 1,1, 2,1), s(0,1, 1,1, 1,0, 2,0),
    s(0,0, 0,1, 0,2, 1,0, 2,0), s(0,0, 0,1, 0,2, 1,2, 2,2), s(0,0, 1,0, 2,0, 2,1, 2,2), s(2,0, 2,1, 2,2, 1,2, 0,2),
)

data class Piece(val shape: Int, val color: Int) {
    val cells: List<IntArray> get() = SHAPES[shape]
    val height: Int get() = cells.maxOf { it[0] } + 1
    val width: Int get() = cells.maxOf { it[1] } + 1
}

data class MoveResult(val cleared: Set<Int>, val lines: Int, val combo: Int)

class GameModel(private val random: Random = Random.Default) {
    /** 0 = empty, otherwise colour index + 1. Index = row * N + col. */
    val grid = IntArray(N * N)
    val pieces = arrayOfNulls<Piece>(3)
    var score = 0
        private set
    var combo = 0
        private set
    var over = false
        private set

    init { reset() }

    fun reset() {
        grid.fill(0)
        newSet()
        score = 0; combo = 0; over = false
    }

    private fun randomPiece() = Piece(random.nextInt(SHAPES.size), random.nextInt(COLOR_COUNT))

    private fun newSet() { for (i in pieces.indices) pieces[i] = randomPiece() }

    fun canPlace(p: Piece, r: Int, c: Int): Boolean = p.cells.all { cell ->
        val rr = r + cell[0]; val cc = c + cell[1]
        rr in 0 until N && cc in 0 until N && grid[rr * N + cc] == 0
    }

    fun fitsAnywhere(p: Piece): Boolean {
        for (r in 0 until N) for (c in 0 until N) if (canPlace(p, r, c)) return true
        return false
    }

    /** Groups (rows, columns, 3x3 boxes) completely filled in [g]. */
    private fun fullGroups(g: IntArray): List<List<Int>> {
        val out = ArrayList<List<Int>>()
        for (i in 0 until N) {
            val br = (i / 3) * 3; val bc = (i % 3) * 3
            val row = ArrayList<Int>(); val col = ArrayList<Int>(); val box = ArrayList<Int>()
            for (j in 0 until N) {
                row.add(i * N + j)
                col.add(j * N + i)
                box.add((br + j / 3) * N + bc + j % 3)
            }
            for (grp in listOf(row, col, box)) if (grp.all { g[it] != 0 }) out.add(grp)
        }
        return out
    }

    /** Cells that would be cleared if [p] were placed at (r, c). Assumes placement is valid. */
    fun wouldClear(p: Piece, r: Int, c: Int): Set<Int> {
        val t = grid.copyOf()
        for (cell in p.cells) t[(r + cell[0]) * N + c + cell[1]] = 1
        return fullGroups(t).flatten().toSet()
    }

    /** Places piece [index] at (r, c). Returns null if invalid. */
    fun place(index: Int, r: Int, c: Int): MoveResult? {
        val p = pieces[index] ?: return null
        if (over || !canPlace(p, r, c)) return null
        for (cell in p.cells) grid[(r + cell[0]) * N + c + cell[1]] = p.color + 1
        pieces[index] = null
        score += p.cells.size
        val groups = fullGroups(grid)
        var cleared = emptySet<Int>()
        if (groups.isEmpty()) {
            combo = 0
        } else {
            cleared = groups.flatten().toSet()
            val n = groups.size
            combo++
            score += n * 10 * n + (combo - 1) * 10
            for (k in cleared) grid[k] = 0
        }
        if (pieces.all { it == null }) newSet()
        over = pieces.none { it != null && fitsAnywhere(it) }
        return MoveResult(cleared, groups.size, combo)
    }

    fun serialize(): String {
        val g = grid.joinToString("")
        val p = pieces.joinToString(",") { if (it == null) "-" else "${it.shape}:${it.color}" }
        return "$g|$p|$score|$combo"
    }

    /** Restores state from [serialize] output; returns false (leaving a fresh game) on bad data. */
    fun restore(data: String?): Boolean {
        if (data == null) return false
        try {
            val parts = data.split("|")
            if (parts.size != 4 || parts[0].length != N * N) return false
            val g = IntArray(N * N) { parts[0][it].digitToInt() }
            if (g.any { it !in 0..COLOR_COUNT }) return false
            val ps = parts[1].split(",")
            if (ps.size != 3) return false
            val loaded = ArrayList<Piece?>()
            for (t in ps) {
                if (t == "-") { loaded.add(null); continue }
                val bits = t.split(":")
                val pc = Piece(bits[0].toInt(), bits[1].toInt())
                if (pc.shape !in SHAPES.indices || pc.color !in 0 until COLOR_COUNT) return false
                loaded.add(pc)
            }
            g.copyInto(grid)
            for (i in 0..2) pieces[i] = loaded[i]
            score = parts[2].toInt(); combo = parts[3].toInt()
            if (pieces.all { it == null }) newSet()
            over = pieces.none { it != null && fitsAnywhere(it) }
            return true
        } catch (e: Exception) {
            reset()
            return false
        }
    }
}
