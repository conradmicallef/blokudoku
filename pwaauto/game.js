'use strict';
(() => {
const N = 9;
const COLORS = ['#ef5b5b', '#f39c3d', '#f2d14b', '#5cc46b', '#3fb5d9', '#5b7cf0', '#b667e0'];
const SHAPES = [
  [[0,0]],
  [[0,0],[0,1]], [[0,0],[1,0]],
  [[0,0],[0,1],[0,2]], [[0,0],[1,0],[2,0]],
  [[0,0],[0,1],[0,2],[0,3]], [[0,0],[1,0],[2,0],[3,0]],
  [[0,0],[0,1],[0,2],[0,3],[0,4]], [[0,0],[1,0],[2,0],[3,0],[4,0]],
  [[0,0],[0,1],[1,0],[1,1]],
  [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],
  [[0,0],[1,0],[1,1]], [[0,0],[0,1],[1,0]], [[0,0],[0,1],[1,1]], [[0,1],[1,0],[1,1]],
  [[0,0],[1,0],[2,0],[2,1]], [[0,1],[1,1],[2,1],[2,0]], [[0,0],[0,1],[1,0],[2,0]], [[0,0],[0,1],[1,1],[2,1]],
  [[0,0],[0,1],[0,2],[1,0]], [[0,0],[0,1],[0,2],[1,2]], [[0,0],[1,0],[1,1],[1,2]], [[1,0],[1,1],[1,2],[0,2]],
  [[0,0],[0,1],[0,2],[1,1]], [[1,0],[1,1],[1,2],[0,1]], [[0,0],[1,0],[2,0],[1,1]], [[0,1],[1,1],[2,1],[1,0]],
  [[0,1],[0,2],[1,0],[1,1]], [[0,0],[0,1],[1,1],[1,2]], [[0,0],[1,0],[1,1],[2,1]], [[0,1],[1,1],[1,0],[2,0]],
  [[0,0],[0,1],[0,2],[1,0],[2,0]], [[0,0],[0,1],[0,2],[1,2],[2,2]], [[0,0],[1,0],[2,0],[2,1],[2,2]], [[2,0],[2,1],[2,2],[1,2],[0,2]],
];

const $ = id => document.getElementById(id);
const boardEl = $('board'), trayEl = $('tray'), scoreEl = $('score'), bestEl = $('best'), comboEl = $('combo');
const slots = [...trayEl.querySelectorAll('.slot')];
const cells = [];
let grid, pieces, score, combo, best, over;
let drag = null;

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

function buildBoard() {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const d = document.createElement('div');
    d.className = 'cell' + (((r / 3 | 0) + (c / 3 | 0)) % 2 ? ' alt' : '');
    boardEl.appendChild(d);
    cells.push(d);
  }
}

function layout() {
  const bw = Math.floor(Math.min(innerWidth - 24, innerHeight * 0.52, 520));
  const root = document.documentElement.style;
  root.setProperty('--bw', bw + 'px');
  root.setProperty('--tc', Math.floor((bw - 8) / N * 0.55) + 'px');
  if (pieces) renderTray();
}

function randomPiece() {
  return { cells: SHAPES[Math.random() * SHAPES.length | 0], color: Math.random() * COLORS.length | 0 };
}
const newSet = () => [randomPiece(), randomPiece(), randomPiece()];
const dims = p => [Math.max(...p.cells.map(x => x[0])) + 1, Math.max(...p.cells.map(x => x[1])) + 1];

function canPlace(p, r, c) {
  return p.cells.every(([dr, dc]) => {
    const rr = r + dr, cc = c + dc;
    return rr >= 0 && rr < N && cc >= 0 && cc < N && !grid[rr][cc];
  });
}
function fitsAnywhere(p) {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (canPlace(p, r, c)) return true;
  return false;
}

function pieceEl(p, size, cls) {
  const [h, w] = dims(p);
  const el = document.createElement('div');
  el.className = cls;
  el.style.gridTemplateColumns = `repeat(${w}, ${size}px)`;
  el.style.gridTemplateRows = `repeat(${h}, ${size}px)`;
  const set = new Set(p.cells.map(x => x[0] * 10 + x[1]));
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const b = document.createElement('div');
    if (set.has(r * 10 + c)) { b.className = 'b'; b.style.background = COLORS[p.color]; }
    else b.className = 'e';
    el.appendChild(b);
  }
  return el;
}

function renderTray() {
  const tc = parseInt(document.documentElement.style.getPropertyValue('--tc')) || 20;
  slots.forEach((s, i) => {
    s.innerHTML = '';
    s.classList.remove('dragging');
    const p = pieces[i];
    if (!p) { s.classList.remove('dead'); return; }
    s.appendChild(pieceEl(p, tc, 'piece'));
    s.classList.toggle('dead', !fitsAnywhere(p));
  });
}

function renderBoard() {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const el = cells[r * N + c], v = grid[r][c];
    el.classList.toggle('on', !!v);
    el.style.background = v ? COLORS[v - 1] : '';
  }
  scoreEl.textContent = score;
  bestEl.textContent = best;
}

function save() { store.set('blokudokuauto.state', over ? null : { grid, pieces, score, combo }); }

function newGame() {
  grid = Array.from({ length: N }, () => Array(N).fill(0));
  pieces = newSet();
  score = 0; combo = 0; over = false;
  $('overlay').hidden = true;
  comboEl.textContent = '';
  renderBoard(); renderTray(); save();
}

// Groups (rows, columns, 3x3 boxes) that are completely filled in the given grid.
function fullGroups(g) {
  const out = [];
  for (let i = 0; i < N; i++) {
    const br = (i / 3 | 0) * 3, bc = (i % 3) * 3;
    const row = [], col = [], box = [];
    for (let j = 0; j < N; j++) {
      row.push(i * N + j);
      col.push(j * N + i);
      box.push((br + (j / 3 | 0)) * N + bc + j % 3);
    }
    [row, col, box].forEach(grp => { if (grp.every(k => g[k / N | 0][k % N])) out.push(grp); });
  }
  return out;
}

function place(p, r, c) {
  p.cells.forEach(([dr, dc]) => { grid[r + dr][c + dc] = p.color + 1; });
  score += p.cells.length;
  const groups = fullGroups(grid);
  if (!groups.length) { combo = 0; comboEl.textContent = ''; return; }
  const clear = new Set(groups.flat());
  const n = groups.length;
  combo++;
  score += n * 10 * n + (combo - 1) * 10;
  comboEl.textContent = (n > 1 ? n + ' lines! ' : '') + (combo > 1 ? 'Combo x' + combo : '');
  if (navigator.vibrate) navigator.vibrate(30);
  clear.forEach(k => cells[k].classList.add('clearing'));
  setTimeout(() => {
    clear.forEach(k => { grid[k / N | 0][k % N] = 0; cells[k].classList.remove('clearing'); });
    renderBoard(); renderTray(); checkOver();
  }, 280);
}

function afterPlace() {
  if (pieces.every(p => !p)) pieces = newSet();
  renderBoard(); renderTray();
  checkOver();
}

function checkOver() {
  if (score > best) { best = score; store.set('blokudokuauto.best', best); bestEl.textContent = best; }
  scoreEl.textContent = score;
  if (!over && !pieces.some(p => p && fitsAnywhere(p))) {
    over = true;
    $('final').textContent = score;
    $('newbest').hidden = !(score > 0 && score >= best);
    $('overlay').hidden = false;
  }
  save();
}

// ---- dragging ----
const LIFT = 70; // px the piece floats above the finger
function origin() {
  const a = cells[0].getBoundingClientRect(), b = cells[1].getBoundingClientRect();
  return { x: a.left, y: a.top, pitch: b.left - a.left };
}
function clearPreview() {
  cells.forEach(c => c.classList.remove('preview', 'willclear'));
}

trayEl.addEventListener('pointerdown', e => {
  const slot = e.target.closest('.slot');
  return; // the computer plays; manual dragging is disabled
  if (!slot || over || drag) return;
  const i = +slot.dataset.i, p = pieces[i];
  if (!p) return;
  e.preventDefault();
  slot.setPointerCapture(e.pointerId);
  const ghost = pieceEl(p, origin().pitch - 2, '');
  ghost.id = 'ghost';
  document.body.appendChild(ghost);
  slot.classList.add('dragging');
  drag = { i, p, slot, ghost, id: e.pointerId, pos: null };
  moveDrag(e);
});

function moveDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const { ghost, p } = drag;
  const left = e.clientX - ghost.offsetWidth / 2;
  const top = e.clientY - ghost.offsetHeight / 2 - LIFT;
  ghost.style.transform = `translate(${left}px, ${top}px)`;
  const o = origin();
  const c = Math.round((left - o.x) / o.pitch), r = Math.round((top - o.y) / o.pitch);
  clearPreview();
  if (canPlace(p, r, c)) {
    drag.pos = [r, c];
    p.cells.forEach(([dr, dc]) => cells[(r + dr) * N + c + dc].classList.add('preview'));
    markWouldClear(p, r, c);
  } else drag.pos = null;
}

function markWouldClear(p, r, c) {
  const t = grid.map(row => row.slice());
  p.cells.forEach(([dr, dc]) => { t[r + dr][c + dc] = 1; });
  fullGroups(t).flat().forEach(k => cells[k].classList.add('willclear'));
}

function endDrag(e, cancel) {
  if (!drag || e.pointerId !== drag.id) return;
  const { i, p, slot, ghost, pos } = drag;
  drag = null;
  ghost.remove();
  clearPreview();
  slot.classList.remove('dragging');
  if (!cancel && pos) {
    pieces[i] = null;
    place(p, pos[0], pos[1]);
    afterPlace();
  }
}
trayEl.addEventListener('pointermove', moveDrag);
trayEl.addEventListener('pointerup', e => endDrag(e, false));
trayEl.addEventListener('pointercancel', e => endDrag(e, true));
document.addEventListener('contextmenu', e => e.preventDefault());

// ---- computer player ----
const SPEEDS = [['slow', 1200], ['normal', 600], ['fast', 320], ['turbo', 0]];
let speedIdx = 1, paused = false, botTimer = null;

// The bot plans the whole set of pieces at once: beam search over every order
// and placement, scored by points gained plus how healthy the resulting board is.
// Only the first move of the best plan is played, then it re-plans.
// Weights were tuned by self-play (evolution strategy) on hard, pre-filled boards.
const BEAM = 16;
const W = {
  blocked4: 10.32, blocked3: 7.56,      // empty cell walled in on 4 / 3 sides
  smallRegion: 1.77, regionMax: 5,      // per missing cell of a tiny enclosed empty region
  rough: 0.96, filled: 1.17,            // ragged edges, occupied cells
  nearComplete: 2.02, nearMin: 7,       // groups close to clearing
  mobility: 1.6, dead: 150, clearMul: 0.83,
};

// Every legal placement of each shape, as flat board indices.
const PLACEMENTS = SHAPES.map(cells => {
  const h = Math.max(...cells.map(x => x[0])) + 1, w = Math.max(...cells.map(x => x[1])) + 1;
  const out = [];
  for (let r = 0; r <= N - h; r++) for (let c = 0; c <= N - w; c++) {
    out.push({ r, c, idx: cells.map(([dr, dc]) => (r + dr) * N + c + dc) });
  }
  return out;
});

// Groups 0-8 rows, 9-17 columns, 18-26 boxes; and the three groups each cell belongs to.
const GC = [];
for (let i = 0; i < N; i++) GC.push([...Array(N).keys()].map(j => i * N + j));
for (let i = 0; i < N; i++) GC.push([...Array(N).keys()].map(j => j * N + i));
for (let i = 0; i < N; i++) {
  const br = (i / 3 | 0) * 3, bc = (i % 3) * 3;
  GC.push([...Array(N).keys()].map(j => (br + (j / 3 | 0)) * N + bc + j % 3));
}
const CG = [...Array(N * N).keys()].map(k => {
  const r = k / N | 0, c = k % N;
  return [r, N + c, 2 * N + (r / 3 | 0) * 3 + (c / 3 | 0)];
});

// Board quality after a move (higher is better). b is a flat 81-cell array of 0/1.
function boardScore(b) {
  let s = 0, filled = 0;
  const seen = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) {
    if (b[i]) { filled++; continue; }
    const r = i / N | 0, c = i % N;
    const blocked = (r === 0 || b[i - N] ? 1 : 0) + (r === N - 1 || b[i + N] ? 1 : 0) +
                    (c === 0 || b[i - 1] ? 1 : 0) + (c === N - 1 || b[i + 1] ? 1 : 0);
    if (blocked === 4) s -= W.blocked4; else if (blocked === 3) s -= W.blocked3;
    if (seen[i]) continue;
    // Small enclosed empty regions can only take tiny pieces.
    let size = 0;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const k = stack.pop();
      size++;
      const kr = k / N | 0, kc = k % N;
      if (kr > 0 && !b[k - N] && !seen[k - N]) { seen[k - N] = 1; stack.push(k - N); }
      if (kr < N - 1 && !b[k + N] && !seen[k + N]) { seen[k + N] = 1; stack.push(k + N); }
      if (kc > 0 && !b[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; stack.push(k - 1); }
      if (kc < N - 1 && !b[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; stack.push(k + 1); }
    }
    if (size < W.regionMax) s -= (W.regionMax - size) * W.smallRegion;
  }
  let rough = 0;
  for (let i = 0; i < N * N; i++) {
    if (i % N < N - 1 && b[i] !== b[i + 1]) rough++;
    if (i < N * (N - 1) && b[i] !== b[i + N]) rough++;
  }
  s -= rough * W.rough + filled * W.filled;
  for (const g of GC) {
    let n = 0;
    for (const k of g) n += b[k];
    if (n >= W.nearMin && n < N) s += (n - W.nearMin + 1) * W.nearComplete;
  }
  return s;
}

// How many of the possible shapes could still be placed: a measure of how much room is left.
function mobility(b) {
  let n = 0;
  for (const pls of PLACEMENTS) if (pls.some(pl => pl.idx.every(k => !b[k]))) n++;
  return n;
}

function applyMove(b, pl) {
  const t = b.slice();
  let mask = 0;
  for (const k of pl.idx) { t[k] = 1; mask |= (1 << CG[k][0]) | (1 << CG[k][1]) | (1 << CG[k][2]); }
  const full = [];
  for (let g = 0; g < 27; g++) if (mask & (1 << g) && GC[g].every(k => t[k])) full.push(g);
  full.forEach(g => GC[g].forEach(k => { t[k] = 0; }));
  return { b: t, n: full.length };
}

function smartMove() {
  const set = [];
  pieces.forEach((p, slot) => { if (p) set.push({ slot, s: SHAPES.indexOf(p.cells), len: p.cells.length }); });
  if (!set.length) return null;
  let states = [{ b: Uint8Array.from(grid.flat(), v => v ? 1 : 0), used: 0, gain: 0, combo, first: null, val: 0 }];
  const done = [];
  for (let level = 0; level < set.length; level++) {
    const cand = new Map();
    for (const st of states) {
      let any = false;
      set.forEach((piece, k) => {
        if (st.used & (1 << k)) return;
        for (const pl of PLACEMENTS[piece.s]) {
          if (!pl.idx.every(i => !st.b[i])) continue;
          any = true;
          const { b, n } = applyMove(st.b, pl);
          let gain = st.gain + piece.len, cmb = 0;
          if (n) { cmb = st.combo + 1; gain += 10 * n * n * W.clearMul + st.combo * 10; }
          const used = st.used | (1 << k);
          const key = used + '|' + cmb + '|' + b.join('');
          const val = gain + boardScore(b);
          const old = cand.get(key);
          if (!old || val > old.val) cand.set(key, { b, used, gain, combo: cmb, val, first: st.first || { i: piece.slot, r: pl.r, c: pl.c } });
        }
      });
      // Could not place every piece: heavily penalised dead end.
      if (!any) done.push({ ...st, val: st.gain + boardScore(st.b) - W.dead * (set.length - level) });
    }
    states = [...cand.values()].sort((x, y) => y.val - x.val).slice(0, BEAM);
    if (!states.length) break;
  }
  let best = null;
  for (const st of states.concat(done)) {
    if (!st.first) continue;
    const v = st.val + mobility(st.b) * W.mobility;
    if (!best || v > best.v) best = { v, ...st.first };
  }
  return best;
}

function botStep() {
  clearTimeout(botTimer);
  if (paused) return;
  const delay = SPEEDS[speedIdx][1];
  if (over) { botTimer = setTimeout(() => { newGame(); botStep(); }, Math.max(delay, 300) * 2); return; }
  const m = smartMove();
  if (!m) { botTimer = setTimeout(botStep, 200); return; }
  const p = pieces[m.i];
  const show = () => p.cells.forEach(([dr, dc]) => cells[(m.r + dr) * N + m.c + dc].classList.add('preview'));
  show();
  botTimer = setTimeout(() => {
    clearPreview();
    pieces[m.i] = null;
    place(p, m.r, m.c);
    afterPlace();
    botTimer = setTimeout(botStep, Math.max(delay, 320));
  }, delay / 2);
}

$('pause').addEventListener('click', () => {
  paused = !paused;
  $('pause').textContent = paused ? 'Resume' : 'Pause';
  if (!paused) botStep();
});
$('speed').addEventListener('click', () => {
  speedIdx = (speedIdx + 1) % SPEEDS.length;
  $('speed').textContent = 'Speed: ' + SPEEDS[speedIdx][0];
});

$('again').addEventListener('click', () => { newGame(); });
$('newgame').addEventListener('click', () => { if (over || score === 0 || confirm('Start a new game?')) newGame(); });
addEventListener('resize', layout);

// ---- init ----
best = store.get('blokudokuauto.best') || 0;
buildBoard();
layout();
const saved = store.get('blokudokuauto.state');
if (saved && saved.grid && saved.pieces) {
  ({ grid, pieces, score, combo } = saved);
  over = false;
  renderBoard(); renderTray(); checkOver();
} else {
  newGame();
}

botStep();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
