"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Score } from "@/lib/contracts";

const POLL_MS = 4000;

type LaunchState =
  | { phase: "idle" }
  | { phase: "launching" }
  | { phase: "launched"; opportunityId: string }
  | { phase: "error"; message: string };

export default function RunConsole() {
  return (
    <main className="min-h-screen flex-1 bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <header className="mb-10">
          <h1 className="text-2xl font-semibold tracking-tight">
            Taste Test — Operator Console
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Launch Terac panels and watch picks land in real time. Internal only.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <VersionPanel version="v1" />
          <VersionPanel version="v2" />
        </div>
      </div>
    </main>
  );
}

function VersionPanel({ version }: { version: string }) {
  const [panelSize, setPanelSize] = useState(25);
  const [launchState, setLaunchState] = useState<LaunchState>({ phase: "idle" });
  const [score, setScore] = useState<Score | null>(null);

  // Live score poll — runs from page load so pre-launched rounds show too.
  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/score?round=${encodeURIComponent(version)}`);
        if (!res.ok) return;
        const data: Score = await res.json();
        if (active) setScore(data);
      } catch {
        // transient poll failure — keep last known values
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [version]);

  const onLaunch = useCallback(async () => {
    setLaunchState({ phase: "launching" });
    try {
      const res = await fetch("/api/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, n: panelSize }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Launch failed (${res.status})`);
      setLaunchState({ phase: "launched", opportunityId: String(data.opportunity_id) });
    } catch (err) {
      setLaunchState({
        phase: "error",
        message: err instanceof Error ? err.message : "Launch failed",
      });
    }
  }, [version, panelSize]);

  const hasData = (score?.n ?? 0) > 0;

  return (
    <section
      aria-label={`Panel ${version}`}
      className="flex flex-col rounded-xl border border-slate-800 bg-slate-900 p-6"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold uppercase tracking-wide text-slate-200">
          {version}
        </h2>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          panel size
          <input
            type="number"
            min={1}
            value={panelSize}
            onChange={(e) => setPanelSize(Math.max(1, Number(e.target.value) || 1))}
            className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-right text-slate-100 focus-visible:outline-2 focus-visible:outline-sky-400"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onLaunch}
        disabled={launchState.phase === "launching"}
        className="mt-5 rounded-lg bg-sky-500 px-6 py-4 text-lg font-semibold text-slate-950 hover:bg-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:cursor-wait disabled:opacity-60"
      >
        {launchState.phase === "launching"
          ? "Launching…"
          : `Launch ${version} panel`}
      </button>

      <div className="mt-3 min-h-10 text-sm" role="status">
        {launchState.phase === "launched" && (
          <p className="text-emerald-400">
            Live — opportunity{" "}
            <span className="font-mono">{launchState.opportunityId}</span>
          </p>
        )}
        {launchState.phase === "error" && (
          <p className="break-words text-rose-400">{launchState.message}</p>
        )}
      </div>

      <dl className="mt-2 grid grid-cols-3 gap-3 border-t border-slate-800 pt-5">
        <Stat label="responses" value={score ? String(score.n) : "—"} />
        <Stat
          label="spot rate"
          value={score?.spot_rate != null ? score.spot_rate.toFixed(2) : "—"}
        />
        <Stat label="score" value={score?.score != null ? String(score.score) : "—"} />
      </dl>

      <div className="mt-6">
        {hasData ? (
          <Link
            href="/score"
            className="text-sm text-sky-400 underline underline-offset-4 hover:text-sky-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            View score screen →
          </Link>
        ) : (
          <span className="text-sm text-slate-600">No picks yet.</span>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 font-mono text-2xl tabular-nums text-slate-100">{value}</dd>
    </div>
  );
}
