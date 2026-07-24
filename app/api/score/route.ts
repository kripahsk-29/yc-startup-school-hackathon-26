import { promises as fs } from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import { list } from "@vercel/blob";
import type { Score } from "@/lib/contracts";
import { scoreFromPicks } from "@/lib/score";

// Picks are stored one-blob-per-pick under picks/<round>/ (see /api/pick).
// Local dev without a blob token falls back to data/picks.json.

const PICKS_FILE = path.join(process.cwd(), "data", "picks.json");

function pickPrefix(round: string): string {
  return `picks/${encodeURIComponent(round)}/`;
}

function isPick(x: unknown): x is { chose_real: boolean } {
  return (
    !!x &&
    typeof x === "object" &&
    typeof (x as { chose_real?: unknown }).chose_real === "boolean"
  );
}

async function picksFromBlob(round: string): Promise<{ chose_real: boolean }[]> {
  const urls: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: pickPrefix(round), cursor });
    urls.push(...page.blobs.map((b) => b.url));
    cursor = page.cursor ?? undefined;
  } while (cursor);

  const bodies = await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return null;
        return (await res.json()) as unknown;
      } catch {
        return null;
      }
    })
  );
  return bodies.filter(isPick);
}

async function picksFromFile(round: string): Promise<{ chose_real: boolean }[]> {
  let all: unknown[] = [];
  try {
    const parsed = JSON.parse(await fs.readFile(PICKS_FILE, "utf8"));
    if (Array.isArray(parsed)) all = parsed;
  } catch {
    // No picks recorded yet.
  }
  return all.filter(
    (p): p is { round: string; chose_real: boolean } =>
      isPick(p) && (p as { round?: unknown }).round === round
  );
}

export async function GET(request: NextRequest) {
  const round = request.nextUrl.searchParams.get("round") || "v1";

  const picks = process.env.BLOB_READ_WRITE_TOKEN
    ? await picksFromBlob(round)
    : await picksFromFile(round);

  const { n, spot_rate, score } = scoreFromPicks(picks);
  const body: Score = { version: round, n, spot_rate, score };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
