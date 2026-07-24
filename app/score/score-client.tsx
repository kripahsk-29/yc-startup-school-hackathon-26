"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Score } from "@/lib/contracts";
import styles from "./score.module.css";

// ------------------------------------------------------------
// LIVE DATA — both versions polled from GET /api/score?round=<v>
// (frozen Score contract { version, n, spot_rate, score }).
// While a round has no picks (n === 0, nulls from the API) the
// needle rests at the coin-flip position: spot_rate 0.5, score 0.
// ------------------------------------------------------------
type RoundKey = "v1" | "v2";
type Round = { version: RoundKey; n: number; spot_rate: number; score: number };

const EMPTY: Record<RoundKey, Round> = {
  v1: { version: "v1", n: 0, spot_rate: 0.5, score: 0 },
  v2: { version: "v2", n: 0, spot_rate: 0.5, score: 0 },
};

const POLL_MS = 5000;

function normalize(v: RoundKey, s: Score | null): Round {
  if (!s || s.spot_rate == null || s.score == null) {
    return { version: v, n: s?.n ?? 0, spot_rate: 0.5, score: 0 };
  }
  return { version: v, n: s.n, spot_rate: s.spot_rate, score: s.score };
}

function verdictFor(v: RoundKey, r: Round): { spotted: number; line: string } {
  const spotted = Math.round(r.spot_rate * r.n);
  if (r.n === 0) {
    return {
      spotted: 0,
      line: v === "v1" ? "Waiting for strangers…" : "Waiting for v2 picks…",
    };
  }
  return v === "v1"
    ? { spotted, line: `${spotted} of ${r.n} strangers still spotted the real one.` }
    : { spotted, line: `Now only ${spotted} can.` };
}

// ------------------------------------------------------------
// GAUGE GEOMETRY. Semicircle: 0% at left, 50% straight up
// (the coin-flip = model won), 100% at right. The needle's
// distance from center IS the score.
// ------------------------------------------------------------
const CX = 200;
const CY = 200;
const R_TRACK = 165;
const NEEDLE_LEN = 150;
const LABEL_R = 186;
const DURATION = 1500;

// round to 3dp so server and client serialize SVG coords identically
// (full-precision floats stringify differently across the two -> hydration mismatch)
const r3 = (n: number) => Math.round(n * 1000) / 1000;

// point on the arc for a value v in [0,100] at radius r
function polar(v: number, r: number): [number, number] {
  const ang = Math.PI * (1 - v / 100);
  return [r3(CX + r * Math.cos(ang)), r3(CY - r * Math.sin(ang))];
}
// needle rotation (deg, clockwise) for a spot-rate percent
function rotationFor(spotPct: number): number {
  return (spotPct - 50) * 1.8; // 0%->-90, 50%->0, 100%->+90
}
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export default function ScoreClient() {
  const [version, setVersion] = useState<RoundKey>("v1");
  const [shown, setShown] = useState<RoundKey>("v1"); // verdict flips at animation end
  const [animating, setAnimating] = useState(false);
  const [data, setData] = useState<Record<RoundKey, Round>>(EMPTY);
  const [display, setDisplay] = useState({
    spot: EMPTY.v1.spot_rate,
    score: EMPTY.v1.score,
  });

  const displayRef = useRef(display);
  const dataRef = useRef(data);
  const animatingRef = useRef(animating);
  const versionRef = useRef(version);
  const rafRef = useRef<number | null>(null);
  displayRef.current = display;
  dataRef.current = data;
  animatingRef.current = animating;
  versionRef.current = version;

  const animateTo = useCallback((next: RoundKey) => {
    const from = { ...displayRef.current };
    const target = dataRef.current[next];
    const to = { spot: target.spot_rate, score: target.score };

    if (prefersReducedMotion()) {
      setDisplay(to);
      displayRef.current = to;
      setShown(next);
      setAnimating(false);
      return;
    }

    setAnimating(true);
    const start = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const e = easeInOutCubic(t);
      const cur = {
        spot: from.spot + (to.spot - from.spot) * e,
        score: from.score + (to.score - from.score) * e,
      };
      setDisplay(cur);
      displayRef.current = cur;
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setShown(next);
        setAnimating(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Poll both rounds; when the currently-shown round's numbers move
  // (picks landing live), sweep the needle to the fresh values.
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [v1, v2] = await Promise.all(
          (["v1", "v2"] as const).map(async (v) => {
            const res = await fetch(`/api/score?round=${v}`, { cache: "no-store" });
            if (!res.ok) return null;
            return (await res.json()) as Score;
          })
        );
        if (!active) return;
        const next = { v1: normalize("v1", v1), v2: normalize("v2", v2) };
        setData(next);
        dataRef.current = next;

        const cur = next[versionRef.current];
        const shownNow = displayRef.current;
        const moved =
          Math.abs(cur.spot_rate - shownNow.spot) > 0.0001 ||
          Math.abs(cur.score - shownNow.score) > 0.0001;
        if (moved && !animatingRef.current) {
          animateTo(versionRef.current);
        }
      } catch {
        // transient poll failure — keep last known values
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [animateTo]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = version === "v1" ? "v2" : "v1";
    setVersion(next);
    animateTo(next);
  }, [version, animateTo]);

  // derived render values
  const spotPct = display.spot * 100;
  const rotation = rotationFor(spotPct);
  const scoreShown = Math.round(display.score);
  const verdict = verdictFor(shown, data[shown]);
  const round = data[shown];
  const delta = data.v1.score - data.v2.score;
  const hasBothRounds = data.v1.n > 0 && data.v2.n > 0;

  // ticks every 5%, majors + labels at 0/25/50/75/100
  const ticks = [];
  for (let v = 0; v <= 100; v += 5) {
    const major = v % 25 === 0;
    const [ox, oy] = polar(v, R_TRACK);
    const [ix, iy] = polar(v, R_TRACK - (major ? 17 : 9));
    if (v === 50) continue; // 50 gets a bespoke equilibrium marker
    ticks.push(
      <line
        key={v}
        x1={ox}
        y1={oy}
        x2={ix}
        y2={iy}
        className={major ? styles.tickMajor : styles.tick}
      />
    );
  }

  const labels: [number, string][] = [
    [0, "0"],
    [25, "25"],
    [75, "75"],
    [100, "100"],
  ];

  // equilibrium (50) marker
  const [eqOx, eqOy] = polar(50, R_TRACK + 6);
  const [eqIx, eqIy] = polar(50, R_TRACK - 20);

  return (
    <div className={styles.frame}>
      <p className={styles.eyebrow}>Taste Test — Image Curation</p>
      <p className={styles.subject}>How well the model curated as Poshitha</p>

      <div className={styles.gaugeWrap}>
        <svg
          className={styles.gauge}
          viewBox="0 0 400 250"
          role="img"
          aria-label={`Spot rate ${Math.round(spotPct)} percent. Capture score ${scoreShown} out of 100, where 0 means indistinguishable.`}
        >
          {/* arc track */}
          <path
            className={styles.track}
            d={`M ${polar(0, R_TRACK)[0]} ${polar(0, R_TRACK)[1]} A ${R_TRACK} ${R_TRACK} 0 0 1 ${polar(100, R_TRACK)[0]} ${polar(100, R_TRACK)[1]}`}
          />

          {ticks}

          {/* tick number labels (outside the arc) */}
          {labels.map(([v, txt]) => {
            const [lx, ly] = polar(v, LABEL_R);
            return (
              <text
                key={v}
                x={lx}
                y={ly}
                className={styles.tickLabel}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {txt}
              </text>
            );
          })}

          {/* equilibrium marker at 50 = coin-flip = model wins */}
          <line
            className={styles.equilibrium}
            x1={eqOx}
            y1={eqOy}
            x2={eqIx}
            y2={eqIy}
          />
          <text
            x={CX}
            y={16}
            className={styles.equilibriumLabel}
            textAnchor="middle"
          >
            50
          </text>
          <text
            x={CX}
            y={30}
            className={styles.equilibriumSub}
            textAnchor="middle"
          >
            coin-flip
          </text>

          {/* ghost needle — where v1 was, left behind to show the move */}
          {version === "v2" && data.v1.n > 0 && (
            <g
              transform={`rotate(${rotationFor(data.v1.spot_rate * 100)} ${CX} ${CY})`}
            >
              <line
                className={styles.ghost}
                x1={CX}
                y1={CY}
                x2={CX}
                y2={CY - NEEDLE_LEN}
              />
              <text
                className={styles.ghostLabel}
                x={CX}
                y={CY - NEEDLE_LEN - 8}
                textAnchor="middle"
              >
                v1
              </text>
            </g>
          )}

          {/* live needle */}
          <g transform={`rotate(${rotation} ${CX} ${CY})`}>
            <line
              className={styles.needle}
              x1={CX}
              y1={CY}
              x2={CX}
              y2={CY - NEEDLE_LEN}
            />
          </g>
          <circle className={styles.needleHub} cx={CX} cy={CY} r={11} />
          <circle className={styles.needleHubInner} cx={CX} cy={CY} r={4.5} />
        </svg>
      </div>

      <div className={styles.readout}>
        <div className={styles.number}>{scoreShown}</div>
        <div className={styles.numberLabel}>
          capture score · 0 = indistinguishable · lower is better
        </div>
      </div>

      <p className={styles.verdict}>{verdict.line}</p>
      <p className={styles.subreadout}>
        {verdict.spotted} of {round.n} picked the real board · {Math.round(round.spot_rate * 100)}% spotted
        {shown === "v2" && hasBothRounds && (
          <>
            {" · "}
            <span className={styles.delta}>
              score {delta >= 0 ? `−${delta}` : `+${-delta}`} from v1
            </span>
          </>
        )}
      </p>

      {/* screen-reader live announcement */}
      <p
        aria-live="polite"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
        }}
      >
        {`${shown}: capture score ${data[shown].score}, ${verdict.line}`}
      </p>

      <div className={styles.controls}>
        <button
          className={styles.button}
          onClick={toggle}
          disabled={animating}
        >
          {version === "v1" ? "Close the loop → run v2" : "↺ Replay from v1"}
        </button>
        <div className={styles.pills}>
          <span
            className={`${styles.pill} ${version === "v1" ? styles.pillActive : ""}`}
          >
            v1
          </span>
          <span className={styles.pillDot}>→</span>
          <span
            className={`${styles.pill} ${version === "v2" ? styles.pillActive : ""}`}
          >
            v2
          </span>
        </div>
      </div>

      <p className={styles.meta}>
        {version} · n = {data[version].n} real strangers · via Terac
      </p>
    </div>
  );
}
