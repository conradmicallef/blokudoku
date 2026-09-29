# Bot tuning (pwaauto)

Headless, seeded copy of the `pwaauto` bot plus an evolution-strategy tuner. Node 18+, no dependencies.

- `core.js` - engine and bot. `DEFAULTS` are the original hand-written weights; the tuned weights live in `W` in `pwaauto/game.js`.
- `tune.js [gens] [games]` - tunes 8 weights on pre-filled (hard) boards, writes `tuned.json`. About 100 s per generation on 8 cores.
- `validate.js games cap pre beam look` - head-to-head on identical fresh seeds (`ONLY=tunedMean` to run one config).

Findings (160 hard games, 46 pre-filled cells): tuned weights survive 92 pieces vs 80 for the originals; on normal games the score is about 35% higher. Beam width: 4 -> 74, 8 -> 83, 16 -> 92, 32 -> 91, 64 -> 92 (16 is enough). Lookahead over random next sets gave no gain and is ~12x slower, so it is not used in the game.

Keep `core.js` and `pwaauto/game.js` in sync if the bot changes.
