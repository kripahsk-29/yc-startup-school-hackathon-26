# yc-startup-school-hackathon-26
https://yc-startup-school-hackathon-26.vercel.app/

A benchmark for identifying taste all in one place, because AI cannot replace your vision >_&lt; (built with the integration of Terac AI)

## Terac track win — 2nd place, Best Use of Terac

TARA — the first benchmark for personal taste — placed 2nd in the Best Use
of Terac track at YC Startup School Hackathon 2026. Real strangers, hired
live through Terac, judged whether an AI captured a person's visual taste.
The human panel wasn't a feature — it was the measurement.

Named TARA after our friend — it means "star" in Sanskrit.

## Landing page (TARA)

- `npm run dev` → http://localhost:3000 — the demo-facing story landing.
- Reads live data from its own API routes: `/api/round?round=v1` (exhibit
  boards, falls back to picsum stubs if the backend tunnel is down) and
  `/api/score?round=v1|v2` (the reading).
- Design direction + palette: `design-inspo/PALETTE.md` (v2 = craft.wild.as
  language). Board inspo images in `design-inspo/`.
- Judge flow: `/judge` · Live score screen: `/score` · Operator console: `/run`.
