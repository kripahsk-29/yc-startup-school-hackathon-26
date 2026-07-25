// TASTE TEST — TERAC SPINE (Person A)
// Real API, v2 beta. Base: https://terac.com/api/external/v2
// Auth: Authorization: Bearer <key>. Rate limit: 100 req/min.
//
// ============================================================
// HOW TERAC ACTUALLY WORKS (read this, it shapes everything):
// Terac does NOT return answers to you directly. You create an
// "opportunity" that points participants to a task_url YOU host.
// Participants go to your page, do the task, and YOU capture their
// answer on your own page/endpoint. You poll listSubmissions only
// to know how many people finished. So the pipeline is:
//   1. Host a public task page (two moodboards + a click). <- teammate work / see contract at bottom
//   2. createProject -> createOpportunity(task_url) -> launch.
//   3. Participants hit your page, you log their pick.
//   4. Poll submissions to track completion.
//   5. Score from the picks YOUR page logged.
// ============================================================

const BASE = "https://terac.com/api/external/v2";
const KEY = process.env.TERAC_API_KEY; // set this in your shell before running

async function terac(path, { method = "GET", body } = {}) {
  // Only claim a JSON body when one exists. Bodyless POSTs (e.g. /launch)
  // must NOT send Content-Type: application/json — Terac tries to parse the
  // empty body and rejects with 400 PARSE_ERROR.
  const headers = { "Authorization": `Bearer ${KEY}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    throw new Error(`Terac ${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

// ------------------------------------------------------------
// STEP 0 — SMOKE TEST. Run this FIRST, before anything else.
// If this prints projects (even an empty list) your key works
// and the whole project is viable. If it throws, stop and fix
// auth/credits before writing another line. This is the gate.
// ------------------------------------------------------------
async function smokeTest() {
  if (!KEY) throw new Error("Set TERAC_API_KEY in your environment first.");
  console.log("Pinging Terac...");
  const projects = await terac("/projects");
  console.log("KEY WORKS. Projects visible:", JSON.stringify(projects, null, 2));
  return projects;
}

// ------------------------------------------------------------
// STEP 1 — Create a project (a container for opportunities).
// ------------------------------------------------------------
async function createProject(title = "Taste Test") {
  // v2 API expects `name` (not `title`) — confirmed against live 400 validation.
  return terac("/projects", { method: "POST", body: { name: title } });
}

// ------------------------------------------------------------
// STEP 2 — Create a DRAFT opportunity that points at your task page.
// num_participants = your panel size. business_type "b2c" = general pop
// (the rules require general-population only; do NOT add specialist filters).
// task_url = YOUR hosted pairwise page, with a round id so answers map back.
// ------------------------------------------------------------
async function createOpportunity({ projectId, taskUrl, n = 30, version = "v1" }) {
  return terac("/opportunities", {
    method: "POST",
    body: {
      title: "Which moodboard did a real person make?",
      project_id: projectId,
      num_participants: n,
      business_type: "b2c",
      tasks: [
        {
          sequence: 1,
          task_type: "activity",       // v2 enum: interview|file_upload|activity — ours is a hosted click task
          review_type: "auto_approve", // don't hand-review 30 people during a hackathon
          task_url: `${taskUrl}?round=${version}`,
          duration_minutes: 2,
        },
      ],
    },
  });
}

// ------------------------------------------------------------
// STEP 3 — Launch it (draft -> live). This spends credit and
// starts recruiting real humans. The response/opportunity carries
// links.launch and links.submissions.
// ------------------------------------------------------------
async function launch(opportunityId) {
  // Terac's launch endpoint requires Content-Type: application/json AND a
  // parseable body — an empty JSON object satisfies both checks.
  return terac(`/opportunities/${opportunityId}/launch`, { method: "POST", body: {} });
}

// ------------------------------------------------------------
// STEP 4 — Poll completion. This tells you how many finished,
// NOT their answers (answers come from your own task page).
// ------------------------------------------------------------
async function pollSubmissions(opportunityId) {
  return terac(`/opportunities/${opportunityId}/submissions`);
}

async function waitForResponses(opportunityId, target, { everyMs = 30000, maxMins = 40 } = {}) {
  const deadline = Date.now() + maxMins * 60000;
  while (Date.now() < deadline) {
    const { data = [] } = await pollSubmissions(opportunityId);
    const done = data.filter(s => s.status === "approved" || s.status === "awaiting_review").length;
    console.log(`${done}/${target} finished...`);
    if (done >= target) return done;
    await new Promise(r => setTimeout(r, everyMs));
  }
  console.log("Hit time cap. Proceeding with whatever we have — say 'directional, not significant' if n is low.");
}

// ------------------------------------------------------------
// SCORING — the number the whole demo rests on.
// Input: the picks YOUR task page logged. Each pick says which
// board the stranger thought was the REAL human's.
// spot_rate = fraction who correctly fingered the real board.
//   1.0 = model totally failed (everyone spotted the real you)
//   0.5 = model succeeded (strangers are guessing)
// score  = distance from 50, scaled 0-100 (0 = perfect capture).
// ------------------------------------------------------------
function score(picks) {
  // picks: [{ chose_real: true/false }, ...]
  const n = picks.length;
  if (n === 0) return { n: 0, spot_rate: null, score: null };
  const correct = picks.filter(p => p.chose_real).length;
  const spot_rate = correct / n;
  const distanceFrom50 = Math.abs(spot_rate - 0.5);
  const scoreOutOf100 = Math.round(distanceFrom50 * 200); // 0 = indistinguishable, 100 = fully spotted
  return { n, spot_rate: +spot_rate.toFixed(2), score: scoreOutOf100 };
}

// ------------------------------------------------------------
// FULL RUN — one version end to end.
// ------------------------------------------------------------
async function runVersion({ projectId, taskUrl, n, version, getLoggedPicks }) {
  const opp = await createOpportunity({ projectId, taskUrl, n, version });
  console.log(`Opportunity ${opp.id} created (${version}). Cost: ${JSON.stringify(opp.pricing)}`);
  await launch(opp.id);
  console.log("Launched. Recruiting real humans...");
  await waitForResponses(opp.id, n);
  const picks = await getLoggedPicks(version); // YOUR page's logged answers for this round
  const result = score(picks);
  console.log(`${version} SCORE:`, result);
  return { ...result, version, opportunityId: opp.id };
}

// ------------------------------------------------------------
// THE B -> A CONTRACT (frozen — see /lib/contracts.ts + /CONTRACTS.md):
// Person B hands you, per version:
//   real_moodboard: [url x9]   // a real one the person made
//   model_moodboard:[url x9]   // what the model curated "as them"
// Your task page shows both (randomize left/right), asks
// "which did a real person make?", and logs { round, chose_real }.
//
// getLoggedPicks(version) must return [{ chose_real: bool }, ...]
// from wherever your task page wrote them (a JSON file / kv / memory).
// ------------------------------------------------------------

// ------------------------------------------------------------
// SYNTHETIC FALLBACK — if Terac isn't returning humans by 1:30,
// swap getLoggedPicks for this so the demo still runs. BUT say
// out loud you lost the Terac track; don't pretend humans judged.
// ------------------------------------------------------------
async function syntheticJudge({ realBoard, modelBoard, n = 30 }) {
  // Ask Claude/an image model n times "which looks human-curated?"
  // Return [{ chose_real }]. Placeholder — wire to your model call.
  throw new Error("Fallback not wired. Only use if Terac is dead.");
}

module.exports = {
  smokeTest, createProject, createOpportunity, launch,
  pollSubmissions, waitForResponses, score, runVersion, syntheticJudge,
};

// Run the smoke test directly:  TERAC_API_KEY=xxx node terac_spine.js
if (require.main === module) {
  smokeTest().catch(e => { console.error("SMOKE TEST FAILED:", e.message); process.exit(1); });
}
