const { parentPort } = require('worker_threads');
const { DEFAULTS, playGame } = require('./core');
parentPort.on('message', ({ id, P, seeds, cap, beam, look, pre }) => {
  const full = { ...DEFAULTS, ...P };
  let pieces = 0, score = 0;
  for (const s of seeds) {
    const r = playGame(full, s, cap, beam, look, pre);
    pieces += r.pieces; score += r.score;
  }
  parentPort.postMessage({ id, pieces: pieces / seeds.length, score: score / seeds.length });
});
