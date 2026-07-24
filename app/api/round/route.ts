import type { NextRequest } from "next/server";
import { MOODBOARD_SIZE, isRoundBoards, type GetRoundResponse } from "@/lib/contracts";

// B's ingestion/brain backend, exposed over an ngrok tunnel. It serves the
// frozen contract at GET /round?round=<v> -> RoundBoards.
const BACKEND_BASE = "https://recent-pauper-grouped.ngrok-free.dev";

// Fallback so the task page never hard-crashes if the tunnel is down or the
// shape is wrong. Deterministic picsum boards, same RoundBoards shape.
function stubBoard(round: string, kind: "real" | "model"): string[] {
  return Array.from(
    { length: MOODBOARD_SIZE },
    (_, i) => `https://picsum.photos/seed/${round}-${kind}-${i + 1}/400`
  );
}

function stubResponse(round: string, reason: string): Response {
  const body: GetRoundResponse = {
    real_moodboard: stubBoard(round, "real"),
    model_moodboard: stubBoard(round, "model"),
  };
  return Response.json(body, {
    headers: { "x-taste-source": "stub", "x-taste-fallback-reason": reason },
  });
}

export async function GET(request: NextRequest) {
  const round = request.nextUrl.searchParams.get("round") || "v1";

  try {
    const upstream = await fetch(
      `${BACKEND_BASE}/round?round=${encodeURIComponent(round)}`,
      {
        // ngrok-free serves a browser-warning interstitial unless this is set.
        headers: {
          "ngrok-skip-browser-warning": "true",
          accept: "application/json",
        },
        cache: "no-store",
        // Don't let a hung tunnel hang the task page.
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!upstream.ok) {
      return stubResponse(round, `upstream ${upstream.status}`);
    }

    const data: unknown = await upstream.json();
    if (!isRoundBoards(data)) {
      // Wrong shape (missing keys, not 9 items, non-URL strings) -> fall back.
      return stubResponse(round, "upstream shape is not RoundBoards");
    }

    // Real boards from B's backend, validated against the frozen contract.
    return Response.json(data as GetRoundResponse, {
      headers: { "x-taste-source": "backend" },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return stubResponse(round, `fetch failed: ${reason}`);
  }
}
