# Taste Test — Person B (ingestion + brain)

## Run
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-...
uvicorn main:app --reload --port 8000
# open http://localhost:8000

## Flow (matches the console sections top to bottom, order matters)
1. Seed: upload your saves or paste image URLs
2. Pool: get ~50 candidate URLs in (this is also the forced-choice source)
3. Forced choice: click through 20 pairs
4. Extract (real model call)
5. Pick YOUR real 9 from the pool, save — **before curating.** /curate excludes
   whatever's in real_moodboard from the candidate pool it shows the model, so
   if this step happens after curate, the exclusion has nothing to exclude and
   the two boards can end up sharing images (this bit us once — see below).
6. Curate (real model call; needs pool >= 15 *after* excluding real_moodboard)
7. GET /round?round=v1  -> { model_moodboard: [url x9], real_moodboard: [url x9] }   <- A's frozen contract (CONTRACTS.md / lib/contracts.ts)
   GET /handoff          -> same shape, unversioned "whatever's current" alias
   GET /handoff/fake      -> same shape, static placeholder URLs, for A to build against before the brain works

Each `/curate` or `/refine` run is stored under its own `taste_model_version`
(v1, v2, ...) in state.rounds, so `/round?round=v1` still returns v1's board
even after `/refine` has produced v2 — that's what lets A's task page show
both rounds side by side.

## Close the loop (the demo)
After A's first panel run, paste "what gave the model away" into the
Brain notes box -> Refine. It builds a v2 taste model and re-curates
automatically. A re-runs the panel. The number moving = the product.

## IMPORTANT: seed with URLs whose host allows bot fetching

`/extract` and `/curate` send external image URLs to Claude as a `url` source
— Claude fetches the image itself, and that fetch **respects the host's
robots.txt**. Hosts that disallow generic crawlers (e.g. `picsum.photos`,
which blocks almost everything) will 400 with "This URL is disallowed by
the website's robots.txt file." Confirmed working: `images.unsplash.com`,
`images.pexels.com`. If A's real Pinterest dump comes back as `pinimg.com`
links, spot-check a couple against `https://<host>/robots.txt` (or just try
one through `/extract`) before assuming the batch will work — don't find out
at 2:30 that half the pool 400s.

Uploaded files (not pasted URLs) sidestep this — they get base64-encoded and
sent as raw bytes, no fetch involved — but then they're only reachable at
`/files/...` on whatever host is running this server, which breaks for A's
task page unless we're on the same network or tunneled. Prefer pasted public
URLs over uploads for anything A needs to render.

## Board overlap (real_moodboard vs model_moodboard must be disjoint)

A's overlap guardrail in `/api/round` caught this once: `/curate` used to draw
from the *entire* pool with no idea which images were already in
`real_moodboard`, so the model could — and did — pick the exact same photos
the real board used (v1 was 5/9 identical). If the two boards share images,
strangers aren't judging "which is real," they're staring at near-duplicate
grids and the score means nothing.

Fixed in `brain.curate()`: images already in `state["real_moodboard"]` are
filtered out of the candidate pool before it's ever sent to Claude, so
overlap is now structurally impossible, not just detected after the fact.
This only works if real_moodboard is already set when `/curate` runs — see
step 5 above.

## Knobs
- TASTE_MODEL env var to switch Claude model (default claude-sonnet-4-6)
- state.json is the whole database; delete it (or POST /reset) to start over
