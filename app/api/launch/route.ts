import type { NextRequest } from "next/server";
import { createProject, createOpportunity, launch } from "@/terac_spine.js";

// One Terac project per server process; every launch reuses it.
let projectIdPromise: Promise<string> | null = null;

function getProjectId(): Promise<string> {
  if (!projectIdPromise) {
    projectIdPromise = createProject("Taste Test")
      .then((project: { id: string }) => project.id)
      .catch((err: unknown) => {
        projectIdPromise = null; // allow retry on the next launch
        throw err;
      });
  }
  return projectIdPromise;
}

export async function POST(request: NextRequest) {
  if (!process.env.TERAC_API_KEY) {
    return Response.json(
      { error: "TERAC_API_KEY is not set on the server." },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { version, n } = (body ?? {}) as { version?: unknown; n?: unknown };
  if (typeof version !== "string" || version.length === 0) {
    return Response.json({ error: "Expected { version: string, n: number }" }, { status: 400 });
  }
  const panelSize = typeof n === "number" && Number.isInteger(n) && n > 0 ? n : 30;

  // Terac participants need a publicly reachable task page. Override the
  // origin with TASK_URL_BASE when tunneling (e.g. ngrok) in front of dev.
  const base = process.env.TASK_URL_BASE ?? request.nextUrl.origin;
  const taskUrl = `${base}/judge`;

  try {
    const projectId = await getProjectId();
    // createOpportunity appends ?round=<version> to taskUrl itself.
    const opportunity = await createOpportunity({
      projectId,
      taskUrl,
      n: panelSize,
      version,
    });
    await launch(opportunity.id);
    return Response.json({
      opportunity_id: opportunity.id,
      version,
      n: panelSize,
      task_url: `${taskUrl}?round=${version}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Terac launch failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
