# Taste Test — Person B (ingestion + brain)

## Run
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-...
uvicorn main:app --reload --port 8000
# open http://localhost:8000

## Flow (matches the console sections top to bottom)
1. Seed: upload your saves or paste image URLs
2. Pool: get ~50 candidate URLs in (this is also the forced-choice source)
3. Forced choice: click through 20 pairs
4. Extract -> Curate (real model calls; curate needs pool >= 15)
5. Pick YOUR real 9 from the same pool, save
6. /handoff  -> { model_moodboard: [url x9], real_moodboard: [url x9] }   <- A's contract
   /handoff/fake -> same shape, static placeholder URLs, for A to build against right now

## Close the loop (the demo)
After A's first panel run, paste "what gave the model away" into the
Brain notes box -> Refine. It builds a v2 taste model and re-curates
automatically. A re-runs the panel. The number moving = the product.

## Knobs
- TASTE_MODEL env var to switch Claude model (default claude-sonnet-4-6)
- state.json is the whole database; delete it (or POST /reset) to start over
