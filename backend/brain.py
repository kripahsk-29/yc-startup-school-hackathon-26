"""
The two Claude calls (plus refine). Everything image-related is sent as actual
images so the model judges pixels, not filenames.
"""
import base64
import json
import mimetypes
import os
from pathlib import Path

import anthropic

ROOT = Path(__file__).parent
UPLOADS = ROOT / "uploads"
MODEL = os.environ.get("TASTE_MODEL", "claude-sonnet-4-6")

client = anthropic.Anthropic()  # needs ANTHROPIC_API_KEY

SCHEMA = {
    "taste_model_version": "v1",
    "subject_id": "person_b",
    "medium": "image_curation",
    "context_note": "personal moodboard aesthetic, not client work",
    "positive_rules": [{"rule": "...", "evidence_count": 0, "confidence": 0.0}],
    "rejection_rules": [{"rule": "...", "evidence_count": 0, "confidence": 0.0}],
    "paired_preferences": [{"prefers": "...", "over": "...", "strength": 0.0}],
    "tie_breakers": ["..."],
}

EXTRACTION_PROMPT = """You are extracting a person's visual taste into decision rules, not adjectives.

INPUT: a set of images this person saved/liked (labeled by id), plus their
forced-choice picks (A vs B, winner marked).

Do NOT output vague style words ("minimal", "warm", "editorial"). Output
falsifiable decision rules that could be used to CHOOSE between two new images.

Weight the person's REJECTIONS and forced-choice picks more heavily than their
saves — saves are aspirational, choices are revealed preference.

Return ONLY valid JSON matching this schema (no prose, no markdown fences):
{schema}

For each rule, set evidence_count to how many input items support it and
confidence 0-1 accordingly. Cap positive_rules at 6.
"""

CURATION_PROMPT = """You are curating a 9-image moodboard AS this specific person, using ONLY their
taste model. You are SELECTING from a pool, not generating.

TASTE MODEL:
{taste_model}

The candidate pool images follow, each labeled with its id.

Apply rejection_rules first to eliminate, then paired_preferences and
tie_breakers to rank what remains. Pick exactly 9.

Return ONLY JSON (no prose, no fences): {{ "picks": ["id", ...], "reasons": {{ "id": "one-line why" }} }}
"""

REFINE_PROMPT = """A panel of ~30 strangers compared this model's curated moodboard against the
real person's moodboard and tried to spot the real one. Here is the taste model
that produced the curated board, and notes on what gave the model away.

TASTE MODEL v_prev:
{taste_model}

PANEL CONFUSION NOTES (what made the model's board distinguishable):
{notes}

Revise the taste model so the next curation is harder to distinguish from the
real person. Sharpen or add rejection_rules and paired_preferences that address
the giveaways. Keep positive_rules <= 6. Bump taste_model_version (v1 -> v2 etc).

Return ONLY valid JSON in the exact same schema (no prose, no fences).
"""


# ---------- image plumbing ----------

def _image_block(img):
    """img = {id, url}. Local uploads -> base64; remote urls -> url source."""
    url = img["url"]
    if url.startswith("/files/"):
        path = UPLOADS / url.removeprefix("/files/")
        media = mimetypes.guess_type(str(path))[0] or "image/jpeg"
        data = base64.standard_b64encode(path.read_bytes()).decode()
        return {"type": "image", "source": {"type": "base64", "media_type": media, "data": data}}
    return {"type": "image", "source": {"type": "url", "url": url}}


def _labeled_images(images, cap=None):
    blocks = []
    for img in images[:cap] if cap else images:
        blocks.append({"type": "text", "text": f"[image id: {img['id']}]"})
        blocks.append(_image_block(img))
    return blocks


def _parse_json(text):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


def _call(content, max_tokens=2000):
    resp = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": content}],
    )
    return _parse_json("".join(b.text for b in resp.content if b.type == "text"))


# ---------- the calls ----------

def extract_taste_model(state):
    content = [{"type": "text", "text": EXTRACTION_PROMPT.format(schema=json.dumps(SCHEMA, indent=2))}]
    content += [{"type": "text", "text": "=== SAVED / LIKED IMAGES ==="}]
    content += _labeled_images(state["seed_images"], cap=24)

    # include only the images that appear in forced choices, then the choices
    choice_ids = {c["a_id"] for c in state["forced_choices"]} | {c["b_id"] for c in state["forced_choices"]}
    seen = {im["id"] for im in state["seed_images"][:24]}
    choice_imgs = [im for im in state["pool_images"] + state["seed_images"]
                   if im["id"] in choice_ids and im["id"] not in seen]
    if choice_imgs:
        content += [{"type": "text", "text": "=== IMAGES REFERENCED IN FORCED CHOICES ==="}]
        content += _labeled_images(choice_imgs)
    if state["forced_choices"]:
        lines = [f"{c['a_id']} vs {c['b_id']} -> chose {c['winner_id']}" for c in state["forced_choices"]]
        content += [{"type": "text", "text": "=== FORCED CHOICES (revealed preference) ===\n" + "\n".join(lines)}]
    return _call(content)


def curate(state):
    # Exclude the real person's own board from the candidate pool so the
    # model can never "pick" the exact images the real board uses — the
    # two boards must be disjoint or the eval test is meaningless.
    real_ids = set(state.get("real_moodboard", []))
    candidates = [im for im in state["pool_images"] if im["id"] not in real_ids]

    content = [{"type": "text", "text": CURATION_PROMPT.format(
        taste_model=json.dumps(state["taste_model"], indent=2))}]
    content += _labeled_images(candidates, cap=50)
    result = _call(content)
    pool_ids = {im["id"] for im in candidates}
    result["picks"] = [p for p in result.get("picks", []) if p in pool_ids][:9]
    if len(result["picks"]) != 9:
        raise RuntimeError(f"Curation returned {len(result['picks'])} valid picks, need 9. Raw: {result}")
    return result


def refine_taste_model(state, notes):
    content = [{"type": "text", "text": REFINE_PROMPT.format(
        taste_model=json.dumps(state["taste_model"], indent=2),
        notes=notes)}]
    return _call(content)
