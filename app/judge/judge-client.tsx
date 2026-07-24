"use client";

import { useEffect, useState } from "react";
import { isRoundBoards, type Moodboard, type RoundBoards } from "@/lib/contracts";

// Deliberately unbranded: any visual personality biases the judgment.
const SYSTEM_FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

type Status = "loading" | "ready" | "submitting" | "done" | "error";

export default function JudgeClient({ round }: { round: string }) {
  const [boards, setBoards] = useState<RoundBoards | null>(null);
  // Which side holds the real board this visit, decided once per visitor.
  const [realIsA] = useState(() => Math.random() < 0.5);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/round?round=${encodeURIComponent(round)}`);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data: unknown = await res.json();
        if (!isRoundBoards(data)) throw new Error("Unexpected response shape");
        if (!cancelled) {
          setBoards(data);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage("Could not load this round. Please refresh to try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [round]);

  async function submitPick(side: "A" | "B") {
    if (status !== "ready") return;
    setStatus("submitting");
    setErrorMessage(null);
    const chose_real = side === "A" ? realIsA : !realIsA;
    try {
      const res = await fetch("/api/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round, chose_real }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setStatus("done");
    } catch {
      // Nothing was recorded, so the visitor may try again.
      setStatus("ready");
      setErrorMessage("Your answer could not be recorded. Please try again.");
    }
  }

  const boardA = boards ? (realIsA ? boards.real_moodboard : boards.model_moodboard) : null;
  const boardB = boards ? (realIsA ? boards.model_moodboard : boards.real_moodboard) : null;

  return (
    <main
      className="min-h-screen w-full flex-1 bg-white text-neutral-950"
      style={{ fontFamily: SYSTEM_FONT }}
    >
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <h1 className="text-center text-xl font-medium sm:text-2xl">
          Which set did a real person choose?
        </h1>

        {status === "loading" && (
          <p className="mt-16 text-center text-neutral-600" role="status">
            Loading…
          </p>
        )}

        {status === "error" && (
          <p className="mt-16 text-center text-neutral-600" role="alert">
            {errorMessage}
          </p>
        )}

        {status === "done" && (
          <p className="mt-16 text-center text-lg" role="status">
            Thanks — recorded.
          </p>
        )}

        {(status === "ready" || status === "submitting") && boardA && boardB && (
          <>
            <div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-10">
              <Board label="A" images={boardA} />
              <Board label="B" images={boardB} />
            </div>

            <div className="mt-12 flex justify-center gap-6">
              <PickButton label="A" disabled={status === "submitting"} onPick={submitPick} />
              <PickButton label="B" disabled={status === "submitting"} onPick={submitPick} />
            </div>

            {errorMessage && (
              <p className="mt-6 text-center text-neutral-600" role="alert">
                {errorMessage}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Board({ label, images }: { label: string; images: Moodboard }) {
  return (
    <section aria-label={`Set ${label}`}>
      <h2 className="mb-4 text-center text-lg font-medium">{label}</h2>
      <div className="grid grid-cols-3 gap-2">
        {images.map((url, i) => (
          // Plain <img>: next/image would require whitelisting remote hosts in
          // next.config.ts, which is outside this piece's fence.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${i}-${url}`}
            src={url}
            alt={`Set ${label}, image ${i + 1} of 9`}
            className="aspect-square w-full object-cover"
            loading="lazy"
          />
        ))}
      </div>
    </section>
  );
}

function PickButton({
  label,
  disabled,
  onPick,
}: {
  label: "A" | "B";
  disabled: boolean;
  onPick: (side: "A" | "B") => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(label)}
      aria-label={`Choose set ${label}`}
      className="min-w-28 border border-neutral-400 px-10 py-3 text-lg text-neutral-950 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
