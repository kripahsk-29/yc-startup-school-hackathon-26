# yc-startup-school-hackathon-26
a benchmark for identifying taste all in one place, because AI cannot replace your vision >_&lt; (built with the integration of Terac AI)

## Landing page (TARA)

- `npm run dev` → http://localhost:3000 — the demo-facing story landing.
- Reads live data from its own API routes: `/api/round?round=v1` (exhibit
  boards, falls back to picsum stubs if the backend tunnel is down) and
  `/api/score?round=v1|v2` (the reading).
- Design direction + palette: `design-inspo/PALETTE.md` (v2 = craft.wild.as
  language). Board inspo images in `design-inspo/`.
- Judge flow: `/judge` · Live score screen: `/score` · Operator console: `/run`.
