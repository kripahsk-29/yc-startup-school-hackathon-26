import { promises as fs } from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import type { Score } from "@/lib/contracts";
import { scoreFromPicks } from "@/lib/score";

// Picks are stored as a Redis list under picks:<round> (see /api/pick).
// Local dev without Redis env falls back to data/picks.json.

const PICKS_FILE = path.join(process.cwd(), "data", "picks.json");

function pickKey(round: string): string {
  return `picks:${round}`;
}

function hasRedisEnv(): boolean {
  return Boolean(
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
      (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

function getRedis(): Redis {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
  return Redis.fromEnv();
}

function isPick(x: unknown): x is { chose_real: boolean } {
  return (
    !!x &&
    typeof x === "object" &&
    typeof (x as { chose_real?: unknown }).chose_real === "boolean"
  );
}

function parsePick(raw: unknown): { chose_real: boolean } | null {
  if (isPick(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return isPick(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function picksFromRedis(round: string): Promise<{ chose_real: boolean }[]> {
  const redis = getRedis();
  const items = await redis.lrange(pickKey(round), 0, -1);
  return items.map(parsePick).filter((p): p is { chose_real: boolean } => p !== null);
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

  try {
    const picks = hasRedisEnv()
      ? await picksFromRedis(round)
      : await picksFromFile(round);

    const { n, spot_rate, score } = scoreFromPicks(picks);
    const body: Score = { version: round, n, spot_rate, score };
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Storage read failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
