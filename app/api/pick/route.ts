import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

// Picks live in Upstash Redis so they persist across serverless requests.
// Append via RPUSH to picks:<round>. Local dev without Redis env falls
// back to data/picks.json.

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

  try {
    if (hasRedisEnv()) {
      const redis = getRedis();
      await redis.rpush(pickKey(round), pick);
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Storage write failed";
    return Response.json({ error: message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
