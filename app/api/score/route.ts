import { promises as fs } from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import type { Score } from "@/lib/contracts";
import { scoreFromPicks } from "@/lib/score";

const PICKS_FILE = path.join(process.cwd(), "data", "picks.json");

export async function GET(request: NextRequest) {
  const round = request.nextUrl.searchParams.get("round") || "v1";

  let all: unknown[] = [];
  try {
    const parsed = JSON.parse(await fs.readFile(PICKS_FILE, "utf8"));
    if (Array.isArray(parsed)) all = parsed;
  } catch {
    // No picks recorded yet.
  }

  const picks = all.filter(
    (p): p is { round: string; chose_real: boolean } =>
      !!p &&
      typeof p === "object" &&
      (p as { round?: unknown }).round === round &&
      typeof (p as { chose_real?: unknown }).chose_real === "boolean"
  );

  const { n, spot_rate, score } = scoreFromPicks(picks);
  const body: Score = { version: round, n, spot_rate, score };
  return Response.json(body);
}
