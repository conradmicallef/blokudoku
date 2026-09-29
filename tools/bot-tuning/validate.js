// Head-to-head on identical fresh seeds. Usage: node validate.js <games> <cap> <pre> <beam> <look>
const fs = require('fs');
const { DEFAULTS } = require('./core');
const { makePool } = require('./pool');
const [games, cap, pre, beam, look] = [+process.argv[2] || 160, +process.argv[3] || 200, +process.argv[4] || 46, +process.argv[5] || 16, +process.argv[6] || 0];
const tuned = JSON.parse(fs.readFileSync('tuned.json', 'utf8'));
const all = { defaults: {}, tunedMean: tuned.mean, tunedBest: tuned.bestEver.P };
const configs = process.env.ONLY ? { [process.env.ONLY]: all[process.env.ONLY] } : all;
if (look) for (const k of Object.keys(configs)) configs[k] = { ...configs[k], look };

(async () => {
  const pool = makePool();
  const seeds = Array.from({ length: games }, (_, i) => 900000 + i);
  const chunks = 16, per = Math.ceil(games / chunks);
  for (const [name, P] of Object.entries(configs)) {
    const jobs = [];
    for (let i = 0; i < chunks; i++) {
      const sd = seeds.slice(i * per, (i + 1) * per);
      if (sd.length) jobs.push(pool.run({ P, seeds: sd, cap, beam, look: !!look, pre }).then(r => ({ r, n: sd.length })));
    }
    const rs = await Promise.all(jobs);
    const n = rs.reduce((a, x) => a + x.n, 0);
    const pieces = rs.reduce((a, x) => a + x.r.pieces * x.n, 0) / n;
    const score = rs.reduce((a, x) => a + x.r.score * x.n, 0) / n;
    console.log(name.padEnd(10), 'pieces', pieces.toFixed(1), 'score', Math.round(score));
  }
  pool.close();
})();
