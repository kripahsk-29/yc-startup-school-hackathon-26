import { promises as fs } from "node:fs";
import path from "node:path";

const PICKS_FILE = path.join(process.cwd(), "data", "picks.json");

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

  await fs.mkdir(path.dirname(PICKS_FILE), { recursive: true });

  let picks: unknown[] = [];
  try {
    const parsed = JSON.parse(await fs.readFile(PICKS_FILE, "utf8"));
    if (Array.isArray(parsed)) picks = parsed;
  } catch {
    // Missing or corrupt file — start fresh.
  }

  picks.push({ round, chose_real, timestamp: new Date().toISOString() });
  await fs.writeFile(PICKS_FILE, JSON.stringify(picks, null, 2) + "\n");

  return Response.json({ ok: true });
}
