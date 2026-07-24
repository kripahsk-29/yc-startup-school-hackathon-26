"""
Taste Test — Person B backend (ingestion + brain).
Run:  ANTHROPIC_API_KEY=sk-... uvicorn main:app --reload --port 8000
State lives in state.json. No auth, no DB, on purpose.
"""
import json
import os
import random
import shutil
import uuid
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

import brain  # the two Claude calls live here

ROOT = Path(__file__).parent
STATE_PATH = ROOT / "state.json"
UPLOADS = ROOT / "uploads"
UPLOADS.mkdir(exist_ok=True)

app = FastAPI(title="Taste Test — B")
app.mount("/files", StaticFiles(directory=UPLOADS), name="files")


# ---------- state (the "database") ----------

DEFAULT_STATE = {
    "seed_images": [],      # [{id, url, kind: "seed"}]
    "pool_images": [],      # [{id, url, kind: "pool"}]
    "forced_choices": [],   # [{a_id, b_id, winner_id}]
    "taste_model": None,    # extraction output
    "picks": [],            # curation output (9 ids)
    "reasons": {},
    "real_moodboard": [],   # 9 ids the human picked
    "panel_notes": [],      # free-text confusion notes from A's run, for v2
    "rounds": {},           # {"v1": {"model_ids": [id x9], "reasons": {...}}, "v2": {...}}
}


def load_state():
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text())
    return json.loads(json.dumps(DEFAULT_STATE))


def save_state(s):
    STATE_PATH.write_text(json.dumps(s, indent=2))


def img_by_id(state, iid):
    for im in state["seed_images"] + state["pool_images"]:
        if im["id"] == iid:
            return im
    return None


def _resolve_url(state, iid, request: Request):
    """id -> absolute URL. Local uploads are stored as relative /files/...
    paths; make them absolute against whatever host this request came in on
    (works for localhost, LAN, or an ngrok tunnel without config). External
    URLs (pasted Pinterest links etc.) pass through unchanged."""
    img = img_by_id(state, iid)
    if img is None:
        return None
    url = img["url"]
    if url.startswith("/"):
        return str(request.base_url).rstrip("/") + url
    return url


def _current_version(state):
    """brain.py's extraction/refine prompts stamp taste_model_version (v1,
    v2, ...) into the model JSON — reuse that as the round label so it can't
    drift from what actually produced the picks."""
    tm = state.get("taste_model") or {}
    return tm.get("taste_model_version") or "v1"


# ---------- ingestion ----------

class UrlList(BaseModel):
    urls: list[str]


def _next_id(state, prefix):
    n = len(state["seed_images" if prefix == "s" else "pool_images"]) + 1
    return f"{prefix}{n:02d}"


@app.post("/seed/upload")
async def seed_upload(files: list[UploadFile] = File(...)):
    return await _ingest_uploads(files, "seed")


@app.post("/pool/upload")
async def pool_upload(files: list[UploadFile] = File(...)):
    return await _ingest_uploads(files, "pool")


async def _ingest_uploads(files, kind):
    state = load_state()
    prefix = "s" if kind == "seed" else "p"
    added = []
    for f in files:
        iid = _next_id(state, prefix)
        ext = os.path.splitext(f.filename or "")[1] or ".jpg"
        fname = f"{iid}_{uuid.uuid4().hex[:6]}{ext}"
        dest = UPLOADS / fname
        with dest.open("wb") as out:
            shutil.copyfileobj(f.file, out)
        rec = {"id": iid, "url": f"/files/{fname}", "kind": kind}
        state[f"{kind}_images"].append(rec)
        added.append(rec)
    save_state(state)
    return {"added": added, "total": len(state[f"{kind}_images"])}


@app.post("/seed/urls")
def seed_urls(body: UrlList):
    return _ingest_urls(body.urls, "seed")


@app.post("/pool/urls")
def pool_urls(body: UrlList):
    return _ingest_urls(body.urls, "pool")


def _ingest_urls(urls, kind):
    state = load_state()
    prefix = "s" if kind == "seed" else "p"
    added = []
    for u in urls:
        u = u.strip()
        if not u:
            continue
        iid = _next_id(state, prefix)
        rec = {"id": iid, "url": u, "kind": kind}
        state[f"{kind}_images"].append(rec)
        added.append(rec)
    save_state(state)
    return {"added": added, "total": len(state[f"{kind}_images"])}


@app.get("/state")
def get_state():
    return load_state()


@app.post("/reset")
def reset():
    save_state(json.loads(json.dumps(DEFAULT_STATE)))
    return {"ok": True}


# ---------- forced choice ----------

@app.get("/choices/pairs")
def choice_pairs(n: int = 20):
    """Random A/B pairs. Prefer pool images (revealed preference over NEW
    images generalizes better than re-judging your own saves)."""
    state = load_state()
    source = state["pool_images"] if len(state["pool_images"]) >= 10 else state["seed_images"]
    if len(source) < 4:
        raise HTTPException(400, "Need at least 4 images (upload pool or seed first)")
    ids = [im["id"] for im in source]
    pairs, seen = [], set()
    tries = 0
    while len(pairs) < n and tries < n * 20:
        a, b = random.sample(ids, 2)
        key = tuple(sorted((a, b)))
        if key not in seen:
            seen.add(key)
            pairs.append({"a": img_by_id(state, a), "b": img_by_id(state, b)})
        tries += 1
    return {"pairs": pairs}


class Choice(BaseModel):
    a_id: str
    b_id: str
    winner_id: str


@app.post("/choices/answer")
def choice_answer(c: Choice):
    state = load_state()
    state["forced_choices"].append(c.model_dump())
    save_state(state)
    return {"count": len(state["forced_choices"])}


# ---------- the brain ----------

@app.post("/extract")
def extract():
    state = load_state()
    if not state["seed_images"]:
        raise HTTPException(400, "No seed images")
    model = brain.extract_taste_model(state)
    state["taste_model"] = model
    save_state(state)
    return model


@app.post("/curate")
def curate():
    state = load_state()
    if not state["taste_model"]:
        raise HTTPException(400, "Run /extract first")
    if len(state["pool_images"]) < 15:
        raise HTTPException(400, f"Pool too small ({len(state['pool_images'])}), aim for ~50")
    result = brain.curate(state)
    state["picks"] = result["picks"]
    state["reasons"] = result.get("reasons", {})
    state["rounds"][_current_version(state)] = {
        "model_ids": result["picks"],
        "reasons": result.get("reasons", {}),
    }
    save_state(state)
    return result


class RefineBody(BaseModel):
    notes: str  # what the panel said / which pairs gave the model away


@app.post("/refine")
def refine(body: RefineBody):
    """Close the loop: v1 model + panel confusion notes -> v2 model, then re-curate."""
    state = load_state()
    if not state["taste_model"]:
        raise HTTPException(400, "No taste model to refine")
    state["panel_notes"].append(body.notes)
    v2 = brain.refine_taste_model(state, body.notes)
    state["taste_model"] = v2
    save_state(state)
    result = brain.curate(state)
    state["picks"] = result["picks"]
    state["reasons"] = result.get("reasons", {})
    state["rounds"][_current_version(state)] = {
        "model_ids": result["picks"],
        "reasons": result.get("reasons", {}),
    }
    save_state(state)
    return {"taste_model": v2, "picks": result["picks"], "reasons": result.get("reasons", {})}


# ---------- real moodboard + handoff (the B -> A contract) ----------

class RealBoard(BaseModel):
    ids: list[str]


@app.post("/real_moodboard")
def set_real_moodboard(body: RealBoard):
    if len(body.ids) != 9:
        raise HTTPException(400, f"Need exactly 9, got {len(body.ids)}")
    state = load_state()
    state["real_moodboard"] = body.ids
    save_state(state)
    return {"ok": True}


@app.get("/round")
def round_boards(round: str, request: Request):
    """THE frozen contract (CONTRACTS.md / lib/contracts.ts, RoundBoards):
    GET /round?round=<version> -> { real_moodboard: [url x9], model_moodboard: [url x9] }
    real_moodboard is fixed once set; model_moodboard is per-version so a v1
    request still returns v1's board even after /refine has produced v2."""
    state = load_state()
    r = state["rounds"].get(round)
    if r is None:
        raise HTTPException(404, f"No round '{round}' yet. Known: {list(state['rounds'])}")
    return {
        "model_moodboard": [_resolve_url(state, i, request) for i in r["model_ids"]],
        "real_moodboard": [_resolve_url(state, i, request) for i in state["real_moodboard"]],
    }


@app.get("/handoff")
def handoff(request: Request):
    """Convenience alias for whatever's most current — same shape as /round,
    unversioned. Prefer /round?round=<v> for anything the score screen needs
    to keep separate per version."""
    state = load_state()
    return {
        "model_moodboard": [_resolve_url(state, i, request) for i in state["picks"]],
        "real_moodboard": [_resolve_url(state, i, request) for i in state["real_moodboard"]],
    }


@app.get("/handoff/fake")
def handoff_fake():
    """For A to build against before the brain works. Static placeholder URLs
    so her task page renders images right now, no dependency on my server."""
    return {
        "model_moodboard": [f"https://picsum.photos/seed/model{i}/480" for i in range(1, 10)],
        "real_moodboard": [f"https://picsum.photos/seed/real{i}/480" for i in range(1, 10)],
    }


@app.get("/")
def index():
    return FileResponse(ROOT / "static" / "index.html")
