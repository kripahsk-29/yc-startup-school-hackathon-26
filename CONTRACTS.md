# Frozen Contracts — Taste Test

> **Canonical source of truth is [`/lib/contracts.ts`](lib/contracts.ts).**
> This file is a plain-language copy for reading. If the two ever disagree,
> the `.ts` wins. **Do not change these shapes without telling Person A.**

There is exactly **one seam** between the two lanes, plus the two API/data
shapes that hang off it. Build against these on both sides so we never block
each other.

---

## 1. The seam — `RoundBoards` (B → A, per version)

B produces this. A consumes it.

```json
{
  "real_moodboard":  ["<url>", "...×9"],
  "model_moodboard": ["<url>", "...×9"]
}
```

- Each board is **exactly 9 image URLs**, in display order.
- **URLs, not ids** — the task page renders them directly, no lookup step.
- `real_moodboard` = a board the real person actually made.
- `model_moodboard` = what the model curated "as them" from the pool.

## 2. `GET /api/round?round=<version>` → `RoundBoards`

- `<version>` is `v1`, `v2`, …
- Returns the object above for that version.
- Both the task page and the eval harness fetch boards through this endpoint.

## 3. A single stranger's pick (logged on OUR task page)

```json
{ "round": "v1", "chose_real": true }
```

- `chose_real` = did they correctly pick the **real** human's board?
- Written by the task page; read by scoring. Terac never sees this — we
  capture it ourselves.

## 4. The score object → the score screen

```json
{ "version": "v1", "n": 30, "spot_rate": 0.84, "score": 68 }
```

- `n` = how many strangers judged this round.
- `spot_rate` = fraction who correctly spotted the real board (0–1).
- `score` = `round(|spot_rate − 0.5| × 200)`, 0–100.
  - `0` = indistinguishable → **model won**.
  - `100` = fully spotted → **model failed**.
- `spot_rate` / `score` are `null` only when `n === 0`.

---

### Note on the earlier brief

CLAUDE.md's frozen contract listed boards as `[id ×9]`. We have since locked
them as **`[url ×9]`** so the task page can render without an id→url lookup.
This `.ts`/`.md` pair is the current truth.
