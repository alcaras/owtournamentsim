# Old World Community Tournament Simulator

A standalone, browser-based simulator for the **2026 Old World Community
Tournament**. It runs the tournament exactly the way
[per-ankh.app](https://per-ankh.app/tournaments/2026-community-tournament) runs
it — two parallel Swiss divisions feeding a single cross-division championship —
then plays out the games using a seed-strength model so you can explore
"what-if" outcomes.

➡️ **Live:** https://alcaras.github.io/owtournamentsim/

## Format (ported verbatim from per-ankh)

The algorithms in `src/engine/` are direct ports of per-ankh's backend
(`cloud/src/tournament/` — `pairing.ts`, `standings.ts`, `bracket.ts`):

- **Two divisions** — The New World (Americas, 26) and The Old World (Europe,
  Africa, Asia, Oceania, 28). Players are seeded in sign-up order.
- **Swiss**, up to **5 rounds** per division. Reach **3 wins** → *advance*;
  reach **3 losses** → *eliminated*. Byes award a win.
  - Round 1: seed fold (seed 1 vs seed N/2+1, …).
  - Round 2+: bucket by record, fold top vs bottom half, avoid rematches,
    float odd players down, lowest-without-a-bye takes the bye.
- **Standings cascade** (for seeding): wins/losses → head-to-head →
  Buchholz cut-1 → opponents' Buchholz → cumulative (Harkness) → initial seed.
- **Championship**: everyone who advanced — from **both** divisions, ranked by
  one combined cascade — is seeded 1..N into a standard 1-vs-N
  single-elimination bracket (next power of two, byes for top seeds). No bronze
  match. Last player standing is champion.

## The one thing per-ankh doesn't define: who wins a game

Per-ankh records *real* games. To simulate, each player's strength comes from
their seed, and an **Upset factor** slider blends between pure chalk (the better
seed always wins) and a pure coin flip. Runs are deterministic per random seed,
so "Reset" replays the same outcomes and "Shuffle"/"Replay" rolls new ones.

## Develop

```bash
npm install
npm run dev      # local dev server
npm test         # engine unit tests (verifies the per-ankh port)
npm run build    # production build to dist/
```

Edit the field in `src/data/players.js`.

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and
publishes to GitHub Pages. `vite.config.js` sets `base: '/owtournamentsim/'` to
match the Pages project path.

## Credits

Tournament format and seeding/pairing/standings logic from
[per-ankh](https://github.com/alcaras/per-ankh) by alcaras & contributors. This
simulator is an unofficial companion tool; win probabilities are a model, not
real results.
