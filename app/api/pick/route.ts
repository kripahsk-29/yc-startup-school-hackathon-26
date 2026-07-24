import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";

// Picks live in Vercel Blob so they persist across serverless requests.
// One immutable blob per pick (picks/<round>/<ts>-<uuid>.json) — appends
// never race. Local dev without a blob token falls back to data/picks.json.

const PICKS_FILE = path.join(process.cwd(), "data", "picks.json");

function pickPrefix(round: string): string {
  return `picks/${encodeURIComponent(round)}/`;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { round, chose_real } = (body ?? {}) as {
    round?: unknown;
    chose_real?: unknown;
  };
  if (typeof round !== "string" || round.length === 0 || typeof chose_real !== "boolean") {
    return Response.json(
      { error: "Expected { round: string, chose_real: boolean }" },
      { status: 400 }
    );
  }

  const pick = { round, chose_real, timestamp: new Date().toISOString() };

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await put(
      `${pickPrefix(round)}${Date.now()}-${randomUUID()}.json`,
      JSON.stringify(pick),
      {
        access: "public",
        addRandomSuffix: false,
        contentType: "application/json",
      }
    );
  } else {
    // Local-dev fallback: append to the JSON file as before.
    await fs.mkdir(path.dirname(PICKS_FILE), { recursive: true });
    let picks: unknown[] = [];
    try {
      const parsed = JSON.parse(await fs.readFile(PICKS_FILE, "utf8"));
      if (Array.isArray(parsed)) picks = parsed;
    } catch {
      // Missing or corrupt file — start fresh.
    }
    picks.push(pick);
    await fs.writeFile(PICKS_FILE, JSON.stringify(picks, null, 2) + "\n");
  }

  return Response.json({ ok: true });
}
