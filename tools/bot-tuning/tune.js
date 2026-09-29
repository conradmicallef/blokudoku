// Evolution-strategy tuning of the bot parameters on pre-filled (hard) boards.
const fs = require('fs');
const { DEFAULTS } = require('./core');
const { makePool } = require('./pool');

const GENS = +process.argv[2] || 20, GAMES = +process.argv[3] || 24, CAP = 200, PRE = 46, BEAM = 16, LAMBDA = 16, MU = 5;
const SPACE = {
  blocked4: [0, 40], blocked3: [0, 20], smallRegion: [0, 12], rough: [0, 3],
  filled: [0, 3], nearComplete: [0, 6], mobility: [0, 6], clearMul: [0, 3],
};
const keys = Object.keys(SPACE);
const clip = (k, v) => Math.min(SPACE[k][1], Math.max(SPACE[k][0], v));
const randn = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

(async () => {
  const pool = makePool();
  let mean = {}; keys.forEach(k => { mean[k] = DEFAULTS[k]; });
  let sigma = {}; keys.forEach(k => { sigma[k] = 0.15 * (SPACE[k][1] - SPACE[k][0]); });
  const evalMany = async (cands, gen) => {
    const seeds = Array.from({ length: GAMES }, (_, i) => gen * 1000 + i + 1);
    // Split each candidate across 2 jobs so 8 cores stay busy.
    const half = GAMES / 2 | 0;
    return Promise.all(cands.map(async P => {
      const [a, b] = await Promise.all([seeds.slice(0, half), seeds.slice(half)].map(sd =>
        pool.run({ P, seeds: sd, cap: CAP, beam: BEAM, look: false, pre: PRE })));
      return (a.pieces * half + b.pieces * (GAMES - half)) / GAMES;
    }));
  };
  let bestEver = { fit: -1, P: { ...mean } };
  for (let gen = 1; gen <= GENS; gen++) {
    const t0 = Date.now();
    const cands = [{ ...mean }];
    for (let i = 0; i < LAMBDA; i++) {
      const c = {}; keys.forEach(k => { c[k] = clip(k, mean[k] + sigma[k] * randn()); });
      cands.push(c);
    }
    const fits = await evalMany(cands, gen);
    const order = fits.map((f, i) => [f, i]).sort((a, b) => b[0] - a[0]);
    const top = order.slice(0, MU).map(x => cands[x[1]]);
    const next = {}; keys.forEach(k => { next[k] = top.reduce((a, c) => a + c[k], 0) / MU; });
    mean = next;
    keys.forEach(k => { sigma[k] *= 0.94; });
    if (order[0][0] > bestEver.fit) bestEver = { fit: order[0][0], P: { ...cands[order[0][1]] } };
    console.log(`gen ${gen} meanFit ${fits[0].toFixed(1)} best ${order[0][0].toFixed(1)} avgTop ${(order.slice(0, MU).reduce((a, x) => a + x[0], 0) / MU).toFixed(1)} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    console.log('  mean', JSON.stringify(Object.fromEntries(keys.map(k => [k, +mean[k].toFixed(2)]))));
    fs.writeFileSync('tuned.json', JSON.stringify({ gen, mean, bestEver }, null, 1));
  }
  pool.close();
})();
