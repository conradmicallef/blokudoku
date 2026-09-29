package com.example.blokudoku

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.roundToInt

private val BG = Color(0xFF1B1F2E)
private val BOARD_BG = Color(0xFF2A3050)
private val CELL = Color(0xFF353C5F)
private val CELL_ALT = Color(0xFF2E3554)
private val ACCENT = Color(0xFFF2D14B)
private val PIECE_COLORS = listOf(
    Color(0xFFEF5B5B), Color(0xFFF39C3D), Color(0xFFF2D14B), Color(0xFF5CC46B),
    Color(0xFF3FB5D9), Color(0xFF5B7CF0), Color(0xFFB667E0),
)

private class Store(ctx: Context) {
    private val prefs = ctx.getSharedPreferences("blokudoku", Context.MODE_PRIVATE)
    var best: Int
        get() = prefs.getInt("best", 0)
        set(v) { prefs.edit().putInt("best", v).apply() }
    var state: String?
        get() = prefs.getString("state", null)
        set(v) {
            val e = prefs.edit()
            if (v == null) e.remove("state") else e.putString("state", v)
            e.apply()
        }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(primary = ACCENT, background = BG, surface = BOARD_BG)) {
                GameScreen(Store(applicationContext))
            }
        }
    }
}

private data class DragState(val index: Int, val finger: Offset)

@Composable
private fun GameScreen(store: Store) {
    val model = remember { GameModel().also { m -> m.restore(store.state) } }
    var version by remember { mutableIntStateOf(0) } // bumped after each model mutation to force redraw
    var best by remember { mutableIntStateOf(store.best) }
    var comboText by remember { mutableStateOf("") }
    var drag by remember { mutableStateOf<DragState?>(null) }
    var flash by remember { mutableStateOf<Set<Int>>(emptySet()) }
    var flashKey by remember { mutableIntStateOf(0) }
    var confirmNew by remember { mutableStateOf(false) }
    var showOver by remember { mutableStateOf(model.over) }
    var newBest by remember { mutableStateOf(false) }

    var boardPos by remember { mutableStateOf(Offset.Zero) }
    var overlayPos by remember { mutableStateOf(Offset.Zero) }
    val slotPos = remember { Array(3) { Offset.Zero } }

    fun persist() { store.state = if (model.over) null else model.serialize() }

    fun startNew() {
        model.reset(); comboText = ""; showOver = false; newBest = false; flash = emptySet(); drag = null
        version++; persist()
    }

    LaunchedEffect(flashKey) {
        if (flash.isNotEmpty()) {
            kotlinx.coroutines.delay(280)
            flash = emptySet()
        }
    }

    val density = LocalDensity.current
    val liftPx = with(density) { 70.dp.toPx() }

    BoxWithConstraints(Modifier.fillMaxSize().background(BG).systemBarsPadding()) {
        val ver = version // subscribe this scope to model changes
        val boardDp = minOf(maxWidth - 24.dp, maxHeight * 0.55f, 520.dp)
        val boardPx = with(density) { boardDp.toPx() }
        val pitch = boardPx / N
        val trayCell = pitch * 0.55f

        fun dropTarget(d: DragState, p: Piece): Pair<Int, Int> {
            val left = d.finger.x - overlayPos.x - (p.width * pitch) / 2
            val top = d.finger.y - overlayPos.y - (p.height * pitch) / 2 - liftPx
            val c = ((left - (boardPos.x - overlayPos.x)) / pitch).roundToInt()
            val r = ((top - (boardPos.y - overlayPos.y)) / pitch).roundToInt()
            return r to c
        }

        val dragging = drag
        val dragPiece = dragging?.let { model.pieces[it.index] }
        var previewCells: Set<Int> = emptySet()
        var willClear: Set<Int> = emptySet()
        if (dragging != null && dragPiece != null) {
            val (r, c) = dropTarget(dragging, dragPiece)
            if (model.canPlace(dragPiece, r, c)) {
                previewCells = dragPiece.cells.map { (it[0] + r) * N + c + it[1] }.toSet()
                willClear = model.wouldClear(dragPiece, r, c)
            }
        }

        Column(
            Modifier.fillMaxSize().padding(horizontal = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(8.dp))
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("SCORE", color = Color.Gray, fontSize = 12.sp)
                    Text("${model.score}", color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Bold)
                }
                Column(Modifier.weight(1f)) {
                    Text("BEST", color = Color.Gray, fontSize = 12.sp)
                    Text("$best", color = ACCENT, fontSize = 30.sp, fontWeight = FontWeight.Bold)
                }
                Button(onClick = { if (model.over || model.score == 0) startNew() else confirmNew = true }) {
                    Text("New game")
                }
            }
            Text(
                comboText, color = ACCENT, fontSize = 18.sp, fontWeight = FontWeight.Bold,
                modifier = Modifier.height(28.dp),
            )
            Canvas(
                Modifier.size(boardDp).onGloballyPositioned { boardPos = it.positionInRoot() }
            ) {
                drawBoard(model, ver, pitch, previewCells, willClear, flash, dragPiece?.color ?: 0)
            }
            Spacer(Modifier.weight(1f))
            Row(
                Modifier.fillMaxWidth().padding(bottom = 16.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                for (i in 0 until 3) {
                    val p = model.pieces[i]
                    val slotDp = with(density) { (trayCell * 5 + 8.dp.toPx()).toDp() }
                    Box(
                        Modifier
                            .size(slotDp)
                            .onGloballyPositioned { slotPos[i] = it.positionInRoot() }
                            .pointerInput(i, pitch) {
                                detectDragGestures(
                                    onDragStart = { off ->
                                        if (model.pieces[i] != null && !model.over) {
                                            drag = DragState(i, slotPos[i] + off)
                                        }
                                    },
                                    onDrag = { change, amount ->
                                        change.consume()
                                        drag = drag?.let { it.copy(finger = it.finger + amount) }
                                    },
                                    onDragEnd = {
                                        val d = drag
                                        drag = null
                                        val pc = d?.let { model.pieces[it.index] }
                                        if (d != null && pc != null) {
                                            val (r, c) = dropTarget(d, pc)
                                            val res = model.place(d.index, r, c)
                                            if (res != null) {
                                                if (res.cleared.isNotEmpty()) {
                                                    flash = res.cleared
                                                    flashKey++
                                                    comboText = (if (res.lines > 1) "${res.lines} lines! " else "") +
                                                        (if (res.combo > 1) "Combo x${res.combo}" else "")
                                                } else {
                                                    comboText = ""
                                                }
                                                if (model.score > best) {
                                                    best = model.score
                                                    store.best = best
                                                }
                                                if (model.over) {
                                                    newBest = model.score > 0 && model.score >= best
                                                    showOver = true
                                                }
                                                version++
                                                persist()
                                            }
                                        }
                                    },
                                    onDragCancel = { drag = null },
                                )
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        if (p != null) {
                            val fits = model.fitsAnywhere(p)
                            val hidden = dragging?.index == i
                            Canvas(
                                Modifier.size(
                                    with(density) { (p.width * trayCell).toDp() },
                                    with(density) { (p.height * trayCell).toDp() },
                                )
                            ) {
                                if (!hidden) drawPiece(p, trayCell, if (fits) 1f else 0.25f, Offset.Zero)
                            }
                        }
                    }
                }
            }
        }

        // floating dragged piece, drawn above everything
        Canvas(Modifier.fillMaxSize().onGloballyPositioned { overlayPos = it.positionInRoot() }) {
            if (dragging != null && dragPiece != null) {
                val left = dragging.finger.x - overlayPos.x - (dragPiece.width * pitch) / 2
                val top = dragging.finger.y - overlayPos.y - (dragPiece.height * pitch) / 2 - liftPx
                drawPiece(dragPiece, pitch, 0.95f, Offset(left, top))
            }
        }
    }

    if (confirmNew) {
        AlertDialog(
            onDismissRequest = { confirmNew = false },
            title = { Text("Start a new game?") },
            confirmButton = { TextButton(onClick = { confirmNew = false; startNew() }) { Text("New game") } },
            dismissButton = { TextButton(onClick = { confirmNew = false }) { Text("Cancel") } },
        )
    }
    if (showOver) {
        AlertDialog(
            onDismissRequest = {},
            title = { Text("Game over") },
            text = {
                Column {
                    Text("Score: ${model.score}")
                    if (newBest) Text("New best!", color = ACCENT, fontWeight = FontWeight.Bold)
                }
            },
            confirmButton = { TextButton(onClick = { startNew() }) { Text("Play again") } },
        )
    }
}

@Suppress("UNUSED_PARAMETER")
private fun DrawScope.drawBoard(
    model: GameModel, version: Int, pitch: Float,
    preview: Set<Int>, willClear: Set<Int>, flash: Set<Int>, previewColor: Int,
) {
    val gap = pitch * 0.06f
    val rad = CornerRadius(pitch * 0.14f)
    drawRoundRect(BOARD_BG, size = Size(pitch * N, pitch * N), cornerRadius = CornerRadius(pitch * 0.2f))
    for (r in 0 until N) for (c in 0 until N) {
        val k = r * N + c
        val v = model.grid[k]
        val base = if (((r / 3) + (c / 3)) % 2 == 1) CELL_ALT else CELL
        val color = when {
            k in flash && v == 0 -> Color.White
            v != 0 -> PIECE_COLORS[v - 1]
            k in preview -> PIECE_COLORS[previewColor].copy(alpha = 0.55f)
            else -> base
        }
        val tl = Offset(c * pitch + gap, r * pitch + gap)
        val sz = Size(pitch - 2 * gap, pitch - 2 * gap)
        drawRoundRect(color, tl, sz, rad)
        if (k in willClear) {
            drawRoundRect(Color.White.copy(alpha = 0.35f), tl, sz, rad)
            drawRoundRect(Color.White, tl, sz, rad, style = Stroke(width = pitch * 0.06f))
        }
    }
    for (i in 1..2) {
        val p = i * 3 * pitch
        drawLine(Color(0xFF12152A), Offset(p, 0f), Offset(p, pitch * N), strokeWidth = gap)
        drawLine(Color(0xFF12152A), Offset(0f, p), Offset(pitch * N, p), strokeWidth = gap)
    }
}

private fun DrawScope.drawPiece(p: Piece, cell: Float, alpha: Float, origin: Offset) {
    val gap = cell * 0.06f
    for (rc in p.cells) {
        drawRoundRect(
            PIECE_COLORS[p.color].copy(alpha = alpha),
            Offset(origin.x + rc[1] * cell + gap, origin.y + rc[0] * cell + gap),
            Size(cell - 2 * gap, cell - 2 * gap),
            CornerRadius(cell * 0.14f),
        )
    }
}
