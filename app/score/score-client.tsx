"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Score } from "@/lib/contracts";
import styles from "./score.module.css";

// ------------------------------------------------------------
// FAKE DATA — two versions, to sell the v1 -> v2 needle move.
// Shapes match the frozen Score contract { version, n, spot_rate, score }.
// score = round(|spot_rate - 0.5| * 200).  Real data replaces this later.
// ------------------------------------------------------------
type Round = Score & { spot_rate: number; score: number };

const DATA: Record<"v1" | "v2", Round> = {
  v1: { version: "v1", n: 30, spot_rate: 0.83, score: 66 },
  v2: { version: "v2", n: 30, spot_rate: 0.6, score: 20 },
};

const VERDICT: Record<"v1" | "v2", { spotted: number; line: string }> = {
  v1: { spotted: 25, line: "25 of 30 strangers still spotted the real one." },
  v2: { spotted: 18, line: "Now only 18 can." },
};

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
  const [version, setVersion] = useState<"v1" | "v2">("v1");
  const [shown, setShown] = useState<"v1" | "v2">("v1"); // verdict flips at animation end
  const [animating, setAnimating] = useState(false);
  const [display, setDisplay] = useState({
    spot: DATA.v1.spot_rate,
    score: DATA.v1.score,
  });

  const displayRef = useRef(display);
  const rafRef = useRef<number | null>(null);
  displayRef.current = display;

  const animateTo = useCallback((next: "v1" | "v2") => {
    const from = { ...displayRef.current };
    const to = { spot: DATA[next].spot_rate, score: DATA[next].score };

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
  const verdict = VERDICT[shown];
  const round = DATA[shown];
  const delta = DATA.v1.score - DATA.v2.score; // 46

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
          {version === "v2" && (
            <g
              transform={`rotate(${rotationFor(DATA.v1.spot_rate * 100)} ${CX} ${CY})`}
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
        {shown === "v2" && (
          <>
            {" · "}
            <span className={styles.delta}>score −{delta} from v1</span>
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
        {`${shown}: capture score ${DATA[shown].score}, ${verdict.line}`}
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
        {version} · n = {DATA[version].n} real strangers · via Terac
      </p>
    </div>
  );
}
