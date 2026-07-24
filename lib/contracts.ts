// ============================================================
// TASTE TEST — FROZEN CONTRACTS  (canonical source of truth)
// ============================================================
// This file is the ONE agreed shape between the two lanes.
// B produces it, A consumes it, Cursor builds the task page against it.
//
// DO NOT CHANGE THESE SHAPES without telling Person A. If a shape has
// to move, change it HERE first, announce it, then update both sides.
//
// Plain-language mirror for anyone not in TypeScript: /CONTRACTS.md
// (that file is a copy for reading only — THIS file is canonical).
// ============================================================

/**
 * A version label for one run of the test. Cold run is "v1", the
 * post-loop rerun is "v2", and so on. Kept as a plain string so we
 * never have to touch this file to add a version.
 */
export type Version = string; // e.g. "v1", "v2"

/**
 * A moodboard is EXACTLY 9 image URLs, in display order.
 * URLs (not ids) so the task page can render them directly with no lookup.
 */
export type Moodboard = string[]; // length === 9, each an image URL

/**
 * THE ONE CROSS-LANE SEAM.
 * Per version, B hands A two boards:
 *   - real_moodboard:  a real board the person actually made
 *   - model_moodboard: what the model curated "as them" from the pool
 * Each is [url × 9]. Both boards, same length, same shape.
 */
export interface RoundBoards {
  real_moodboard: Moodboard;  // [url × 9] — the real human's board
  model_moodboard: Moodboard; // [url × 9] — the model's curated board
}

/**
 * GET /api/round?round=<version>  ->  RoundBoards
 * The task page and the eval harness both fetch the boards for a round here.
 * B's output for a version must be reachable through this endpoint.
 */
export type GetRoundResponse = RoundBoards;

/**
 * One stranger's logged pick, captured on OUR task page (never from Terac).
 * `chose_real` = did they correctly pick the REAL human's board?
 * This is what the task page writes and what scoring reads.
 */
export interface Pick {
  round: Version;
  chose_real: boolean;
}

/**
 * The score object that feeds the score screen.
 * Shape frozen as: { version, n, spot_rate, score }.
 *   n         = how many strangers judged this round
 *   spot_rate = fraction who correctly spotted the real board (0..1)
 *   score     = round(|spot_rate - 0.5| * 200), 0..100
 *               0  = indistinguishable (model won)
 *               100 = fully spotted (model failed)
 * spot_rate/score are null only when n === 0 (no picks yet).
 */
export interface Score {
  version: Version;
  n: number;
  spot_rate: number | null;
  score: number | null;
}

// ------------------------------------------------------------
// Invariants both sides may assert against (cheap guards, not validation
// frameworks). Keep these in sync with the shapes above.
// ------------------------------------------------------------
export const MOODBOARD_SIZE = 9;

export function isMoodboard(x: unknown): x is Moodboard {
  return (
    Array.isArray(x) &&
    x.length === MOODBOARD_SIZE &&
    x.every((u) => typeof u === "string" && u.length > 0)
  );
}

export function isRoundBoards(x: unknown): x is RoundBoards {
  return (
    !!x &&
    typeof x === "object" &&
    isMoodboard((x as RoundBoards).real_moodboard) &&
    isMoodboard((x as RoundBoards).model_moodboard)
  );
}
