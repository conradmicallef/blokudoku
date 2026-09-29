'use strict';
// Fast headless Blokudoku engine + planning bot with tunable parameters.
const N = 9, NN = 81;
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

const SH = SHAPES.map(cells => {
  const h = Math.max(...cells.map(x => x[0])) + 1, w = Math.max(...cells.map(x => x[1])) + 1;
  const pl = [];
  for (let r = 0; r <= N - h; r++) for (let c = 0; c <= N - w; c++) {
    pl.push({ r, c, idx: Int8Array.from(cells.map(([dr, dc]) => (r + dr) * N + c + dc)) });
  }
  return { n: cells.length, pl };
});

// Groups 0-8 rows, 9-17 columns, 18-26 boxes.
const GC = [];
for (let i = 0; i < N; i++) { const a = []; for (let j = 0; j < N; j++) a.push(i * N + j); GC.push(Int8Array.from(a)); }
for (let i = 0; i < N; i++) { const a = []; for (let j = 0; j < N; j++) a.push(j * N + i); GC.push(Int8Array.from(a)); }
for (let i = 0; i < N; i++) {
  const br = (i / 3 | 0) * 3, bc = (i % 3) * 3, a = [];
  for (let j = 0; j < N; j++) a.push((br + (j / 3 | 0)) * N + bc + j % 3);
  GC.push(Int8Array.from(a));
}
const CG = [];
for (let k = 0; k < NN; k++) {
  const r = k / N | 0, c = k % N;
  CG.push([r, N + c, 2 * N + (r / 3 | 0) * 3 + (c / 3 | 0)]);
}

let rng = Math.random;
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const setRng = f => { rng = f; };

// ---- parameters (defaults reproduce the hand-written bot in pwaauto/game.js) ----
const DEFAULTS = {
  blocked4: 14, blocked3: 5, smallRegion: 4, regionMax: 5,
  rough: 0.6, filled: 0.8, nearComplete: 1.5, nearMin: 7,
  mobility: 1.2, dead: 150, clearMul: 1, look: 0,
};

const seen = new Uint32Array(NN);
let stamp = 0;
const stack = new Int8Array(NN);

function boardScore(b, P) {
  let s = 0, filled = 0;
  stamp++;
  for (let i = 0; i < NN; i++) {
    if (b[i]) { filled++; continue; }
    const r = i / N | 0, c = i - r * N;
    const blocked = ((r === 0 || b[i - N]) ? 1 : 0) + ((r === N - 1 || b[i + N]) ? 1 : 0) +
                    ((c === 0 || b[i - 1]) ? 1 : 0) + ((c === N - 1 || b[i + 1]) ? 1 : 0);
    if (blocked === 4) s -= P.blocked4; else if (blocked === 3) s -= P.blocked3;
    if (seen[i] === stamp) continue;
    let size = 0, sp = 0;
    stack[sp++] = i; seen[i] = stamp;
    while (sp) {
      const k = stack[--sp];
      size++;
      const kr = k / N | 0, kc = k - kr * N;
      if (kr > 0 && !b[k - N] && seen[k - N] !== stamp) { seen[k - N] = stamp; stack[sp++] = k - N; }
      if (kr < N - 1 && !b[k + N] && seen[k + N] !== stamp) { seen[k + N] = stamp; stack[sp++] = k + N; }
      if (kc > 0 && !b[k - 1] && seen[k - 1] !== stamp) { seen[k - 1] = stamp; stack[sp++] = k - 1; }
      if (kc < N - 1 && !b[k + 1] && seen[k + 1] !== stamp) { seen[k + 1] = stamp; stack[sp++] = k + 1; }
    }
    if (size < P.regionMax) s -= (P.regionMax - size) * P.smallRegion;
  }
  let rough = 0;
  for (let i = 0; i < NN; i++) {
    if (i % N < N - 1 && b[i] !== b[i + 1]) rough++;
    if (i < NN - N && b[i] !== b[i + N]) rough++;
  }
  s -= rough * P.rough + filled * P.filled;
  for (let g = 0; g < 27; g++) {
    let n = 0;
    const cs = GC[g];
    for (let j = 0; j < N; j++) n += b[cs[j]];
    if (n >= P.nearMin && n < N) s += (n - P.nearMin + 1) * P.nearComplete;
  }
  return s;
}

function mobility(b) {
  let n = 0;
  for (let s = 0; s < SH.length; s++) {
    const pl = SH[s].pl;
    for (let p = 0; p < pl.length; p++) {
      const idx = pl[p].idx;
      let ok = true;
      for (let j = 0; j < idx.length; j++) if (b[idx[j]]) { ok = false; break; }
      if (ok) { n++; break; }
    }
  }
  return n;
}

const clearBuf = [];
function apply(b, pl) {
  const t = b.slice();
  const idx = pl.idx;
  let mask = 0;
  for (let j = 0; j < idx.length; j++) {
    t[idx[j]] = 1;
    const g = CG[idx[j]];
    mask |= (1 << g[0]) | (1 << g[1]) | (1 << g[2]);
  }
  let n = 0;
  clearBuf.length = 0;
  for (let g = 0; g < 27; g++) {
    if (!(mask & (1 << g))) continue;
    const cs = GC[g];
    let full = true;
    for (let j = 0; j < N; j++) if (!t[cs[j]]) { full = false; break; }
    if (full) { clearBuf.push(g); n++; }
  }
  for (let q = 0; q < clearBuf.length; q++) {
    const cs = GC[clearBuf[q]];
    for (let j = 0; j < N; j++) t[cs[j]] = 0;
  }
  return { t, n };
}

function fits(b, pl) {
  const idx = pl.idx;
  for (let j = 0; j < idx.length; j++) if (b[idx[j]]) return false;
  return true;
}

// Beam search over all orders/placements of `shapes` (array of {slot, s}).
// Returns { first:{slot,pl}, val } or null when nothing can be placed.
function plan(b0, combo0, shapes, P, beam, useLook) {
  const m = shapes.length;
  let states = [{ b: b0, used: 0, gain: 0, combo: combo0, first: null, val: 0 }];
  const done = [];
  for (let level = 0; level < m; level++) {
    const cand = new Map();
    for (let si = 0; si < states.length; si++) {
      const st = states[si];
      let any = false;
      for (let k = 0; k < m; k++) {
        if (st.used & (1 << k)) continue;
        const sh = SH[shapes[k].s], pls = sh.pl;
        for (let p = 0; p < pls.length; p++) {
          if (!fits(st.b, pls[p])) continue;
          any = true;
          const { t, n } = apply(st.b, pls[p]);
          let gain = st.gain + sh.n, combo = 0;
          if (n) { combo = st.combo + 1; gain += (10 * n * n) * P.clearMul + st.combo * 10; }
          const used = st.used | (1 << k);
          const key = used + '|' + combo + '|' + t.join('');
          const val = gain + boardScore(t, P);
          const old = cand.get(key);
          if (!old || val > old.val) cand.set(key, { b: t, used, gain, combo, val, first: st.first || { slot: shapes[k].slot, pl: pls[p], s: shapes[k].s } });
        }
      }
      if (!any) done.push({ b: st.b, used: st.used, gain: st.gain, combo: st.combo, first: st.first, val: st.gain + boardScore(st.b, P) - P.dead * (m - level) });
    }
    states = [...cand.values()].sort((x, y) => y.val - x.val);
    if (states.length > beam) states.length = beam;
    if (!states.length) break;
  }
  const finals = states.concat(done).filter(s => s.first);
  if (!finals.length) return null;
  for (const st of finals) st.val2 = st.val + mobility(st.b) * P.mobility;
  finals.sort((x, y) => y.val2 - x.val2);
  if (useLook && P.look > 0) {
    const top = finals.slice(0, 4);
    for (const st of top) st.val2 += P.look * futureValue(st.b, st.combo, P);
    top.sort((x, y) => y.val2 - x.val2);
    return { first: top[0].first, val: top[0].val2 };
  }
  return { first: finals[0].first, val: finals[0].val2 };
}

// Average plan value of the board against random upcoming sets (cheap beam).
const LOOK_SAMPLES = 4;
function futureValue(b, combo, P) {
  let tot = 0;
  for (let i = 0; i < LOOK_SAMPLES; i++) {
    const sh = [0, 1, 2].map(slot => ({ slot, s: rng() * SH.length | 0 }));
    const r = plan(b, combo, sh, P, 3, false);
    tot += r ? r.val : -P.dead * 3;
  }
  return tot / LOOK_SAMPLES;
}

// Plays one full game; returns { score, pieces }.
function playGame(P, seed, cap, beam, useLook, pre) {
  const gameRng = mulberry32(seed);
  setRng(mulberry32(seed ^ 0x9E3779B9));
  let b = new Uint8Array(NN), combo = 0, score = 0, placed = 0;
  for (let n = 0; n < (pre || 0);) { const k = gameRng() * NN | 0; if (!b[k]) { b[k] = 1; n++; } }
  while (placed < cap) {
    let set = [0, 1, 2].map(slot => ({ slot, s: gameRng() * SH.length | 0 }));
    while (set.length) {
      const r = plan(b, combo, set, P, beam, useLook);
      if (!r) return { score, pieces: placed };
      const sh = SH[r.first.s];
      const { t, n } = apply(b, r.first.pl);
      score += sh.n;
      if (n) { combo++; score += 10 * n * n + (combo - 1) * 10; } else combo = 0;
      b = t; placed++;
      set = set.filter(x => x.slot !== r.first.slot);
    }
  }
  return { score, pieces: placed };
}

module.exports = { DEFAULTS, playGame, SH };
