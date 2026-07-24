import type { NextRequest } from "next/server";
import { MOODBOARD_SIZE, type GetRoundResponse } from "@/lib/contracts";

// STUB: placeholder boards until the data lane wires real ones in.
// The response shape is frozen by /lib/contracts.ts — keep it exact.
function stubBoard(round: string, kind: "real" | "model"): string[] {
  return Array.from(
    { length: MOODBOARD_SIZE },
    (_, i) => `https://picsum.photos/seed/${round}-${kind}-${i + 1}/400`
  );
}

export async function GET(request: NextRequest) {
  const round = request.nextUrl.searchParams.get("round") || "v1";
  const body: GetRoundResponse = {
    real_moodboard: stubBoard(round, "real"),
    model_moodboard: stubBoard(round, "model"),
  };
  return Response.json(body);
}
