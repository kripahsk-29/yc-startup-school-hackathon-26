# yc-startup-school-hackathon-26
https://yc-startup-school-hackathon-26.vercel.app/

2nd place, Best Use of Terac 

TARA, the first benchmark for taste, placed 2nd in the Best Use of Terac track at YC Startup School Hackathon 2026. 

Everyone has taste. Nobody can write it down. You type "clean but warm" and get slop back. 

So we built a way to measure it. You feed it your stuff (Pinterest board, camera roll, your site, Instagram, even your Spotify playlists) and it pulls out your actual pick and reject rules. Then it curates a moodboard "as you," puts it next to a real one you made, and asks experts (designers, creative directors) which one you actually made. If they can't tell, the model got you. 

Taste has no answer key, so the only way to prove a model captured you is that a real person can't tell its work apart from yours. We hired those experts live through Terac, which made it a real RL loop: their confusion is the signal we feed back in. 

Why it matters: individuals won't pay for a vanity score, but delegating creative judgment is severe and expensive for everyone who does it. Onboarding a junior designer to your house style takes six months of rejections. Onboarding a model takes four seconds, and it's wrong, and you only find out after shipping. Media companies, agencies, brand teams, and creators with ghostwriters pay this cost continuously and none of them measure it. 

And the 2026 version: everyone is handing work to agents. The bottleneck in delegation isn't capability, it's whether the agent shares your judgment. Nobody has a way to measure agent-to-person taste alignment. We'd be first with a metric. 

It was a fun project to build, with a lot of potential in where we can take this next. 

Named TARA after our friend (she's awesome) lol. It means "star" in Sanskrit.

## Landing page (TARA)

- `npm run dev` → http://localhost:3000 — the demo-facing story landing.
- Reads live data from its own API routes: `/api/round?round=v1` (exhibit
  boards, falls back to picsum stubs if the backend tunnel is down) and
  `/api/score?round=v1|v2` (the reading).
- Design direction + palette: `design-inspo/PALETTE.md` (v2 = craft.wild.as
  language). Board inspo images in `design-inspo/`.
- Judge flow: `/judge` · Live score screen: `/score` · Operator console: `/run`.
