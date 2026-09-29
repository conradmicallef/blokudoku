const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');

function makePool(n = os.cpus().length) {
  const workers = [], idle = [], queue = [], pending = new Map();
  let nextId = 1;
  const pump = () => {
    while (idle.length && queue.length) {
      const w = idle.pop(), job = queue.shift();
      pending.set(job.id, { w, resolve: job.resolve });
      const { resolve, ...msg } = job;
      w.postMessage(msg);
    }
  };
  for (let i = 0; i < n; i++) {
    const w = new Worker(path.join(__dirname, 'worker.js'));
    w.on('message', m => {
      const p = pending.get(m.id); pending.delete(m.id);
      idle.push(p.w); p.resolve(m); pump();
    });
    workers.push(w); idle.push(w);
  }
  return {
    run(job) { return new Promise(resolve => { queue.push({ ...job, id: nextId++, resolve }); pump(); }); },
    close() { workers.forEach(w => w.terminate()); },
  };
}
module.exports = { makePool };
