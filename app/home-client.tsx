"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  isRoundBoards,
  type Moodboard,
  type RoundBoards,
  type Score,
} from "@/lib/contracts";
import s from "./landing.module.css";

/* ================================================================ data */

const ASCII_TARA = String.raw`
▄▄▄▄▄▄▄▄  ▄▄▄▄   ▄▄▄▄▄▄   ▄▄▄▄
   ██    ██  ██  ██  ██  ██  ██
   ██    ██▀▀██  ██▀▀▄▄  ██▀▀██
   ██    ██  ██  ██  ██  ██  ██
`;

const BOOT_LINES = [
  "TARA · INSTRUMENT No. 001",
  "calibrating optics ......... OK",
  "loading archive ............ OK",
  "linking stranger panel ..... OK",
];

// Pixel bitmaps, wild.as-style. 1 = filled cell.
const PX_SMILE = [
  "0100010",
  "0100010",
  "0000000",
  "1000001",
  "0111110",
];

const PX_FROWN = [
  "0100010",
  "0100010",
  "0000000",
  "0111110",
  "1000001",
];

const PX_MARK = [
  "1101011",
  "1101011",
  "0101010",
  "0010100",
];

const PLATES = [
  {
    n: "01",
    title: "The archive",
    cap: "The subject's saved images enter the record. No captions, no context — just verdicts.",
  },
  {
    n: "02",
    title: "Forced choice",
    cap: "This or that, over and over. Preference under pressure leaves fingerprints.",
  },
  {
    n: "03",
    title: "The taste model",
    cap: "A model is fitted to one person's eye. Not an average — a signature.",
  },
  {
    n: "04",
    title: "The board",
    cap: "The model curates nine images as the subject, from a pool it never saw them touch.",
  },
  {
    n: "05",
    title: "The panel",
    cap: "Strangers face two boards, unlabeled. Which one did the human make?",
  },
  {
    n: "06",
    title: "The score",
    cap: "Distance from a coin flip, 0–100. Zero means the panel couldn't tell you apart.",
  },
];

/* ================================================================ page */

export default function HomeClient() {
  // Lenis inertial scrolling — the page glides.
  useEffect(() => {
    let raf = 0;
    let lenis: { raf: (t: number) => void; destroy: () => void } | undefined;
    let alive = true;
    (async () => {
      const { default: Lenis } = await import("lenis");
      if (!alive) return;
      lenis = new Lenis({ lerp: 0.09 });
      const loop = (t: number) => {
        lenis?.raf(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      lenis?.destroy();
    };
  }, []);

  return (
    <div className={s.page}>
      <Boot />
      <TopBar />
      <Hero />
      <HeatBand />
      <Manifesto />
      <Duality />
      <Method />
      <Experiment />
      <Reading />
      <Footer />
    </div>
  );
}

/* ---------------------------------------------------------------- boot */

function Boot() {
  const [gone, setGone] = useState(false);
  const [line, setLine] = useState(0);

  useEffect(() => {
    const ticker = setInterval(
      () => setLine((n) => Math.min(n + 1, BOOT_LINES.length)),
      280
    );
    const out = setTimeout(() => setGone(true), 1700);
    return () => {
      clearInterval(ticker);
      clearTimeout(out);
    };
  }, []);

  return (
    <div
      className={`${s.boot} ${gone ? s.bootGone : ""}`}
      onClick={() => setGone(true)}
      aria-hidden={gone}
    >
      <pre className={s.bootAscii}>{ASCII_TARA}</pre>
      <div className={s.bootLines}>
        {BOOT_LINES.slice(0, line).map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- topbar */

function TopBar() {
  return (
    <header className={s.topbar}>
      <span>TARA · INSTRUMENT No. 001</span>
      <Link href="/judge" className={s.topbarLink}>
        JOIN THE PANEL ↗
      </Link>
    </header>
  );
}

/* ---------------------------------------------------------------- hero */

function Hero() {
  return (
    <section className={s.hero}>
      <Reveal>
        <h1 className={s.heroTitle}>
          TASTE,
          <br />
          MEASURED.
        </h1>
      </Reveal>
      <Reveal delay={150}>
        <p className={s.label}>THE FIRST BENCHMARK FOR PERSONAL TASTE</p>
      </Reveal>
      <Reveal delay={250}>
        <PixelGlyph map={PX_MARK} className={s.heroMark} />
      </Reveal>
      <Reveal delay={300}>
        <p className={s.heroPara}>
          TARA learns one person&rsquo;s eye from what they save and what they
          choose, curates as them — then lets strangers judge the result.
        </p>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------- heatmap band */

function HeatBand() {
  return (
    <section className={s.band}>
      <PixelField />
      <p className={`${s.label} ${s.bandCap}`}>
        FIG. 00 — ONE PERSON&rsquo;S TASTE, RESOLVING FROM NOISE
      </p>
    </section>
  );
}

/* ----------------------------------------------------------- manifesto */

function Manifesto() {
  return (
    <section className={s.section}>
      <Reveal>
        <p className={s.para}>
          A short point of view on what happened to taste, and how we plan to
          give it a number. But first, the problem.
        </p>
      </Reveal>
      <WordReveal
        className={s.statement}
        text="Everything is trained on everyone, so everything is starting to look like everyone. The feed converged. The average won. And the only defense anyone ever had was a word that never had a number."
      />
    </section>
  );
}

/* ------------------------------------------------------------- duality */

function Duality() {
  return (
    <section className={s.section}>
      <div className={s.duality}>
        <Reveal>
          <div className={s.dualCol}>
            <PixelGlyph map={PX_SMILE} className={s.dualGlyph} />
            <p className={s.label}>MODELS ARE BRILLIANT AT</p>
            <p className={s.dualText}>
              Producing a board that looks like taste. A thousand of them,
              instantly, in any style you name.
            </p>
          </div>
        </Reveal>
        <Reveal delay={150}>
          <div className={s.dualCol}>
            <PixelGlyph map={PX_FROWN} className={s.dualGlyph} />
            <p className={s.label}>AND HOPELESS AT</p>
            <p className={s.dualText}>
              Knowing which one is <em>yours</em>. That last percent is where
              taste lives — and until now, nobody could score it.
            </p>
          </div>
        </Reveal>
      </div>
      <Reveal delay={200}>
        <p className={s.para}>
          So we built the test, and the test produces a number.
        </p>
      </Reveal>
    </section>
  );
}

/* -------------------------------------------------------------- method */

function Method() {
  return (
    <section className={s.section}>
      <Reveal>
        <h2 className={s.h2}>
          Save. Choose.
          <br />
          Curate. Judge.
        </h2>
      </Reveal>
      <Reveal delay={100}>
        <p className={s.para}>
          The machine makes the boards. Strangers make the calls.
        </p>
      </Reveal>
      <div className={s.ledger}>
        {PLATES.map((p, i) => (
          <Reveal key={p.n} delay={i * 60}>
            <article className={s.ledgerRow}>
              <span className={s.ledgerNum}>FIG. {p.n}</span>
              <div>
                <h3 className={s.ledgerTitle}>{p.title}</h3>
                <p className={s.ledgerCap}>{p.cap}</p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- experiment */

function Experiment() {
  const [boards, setBoards] = useState<RoundBoards | null>(null);
  const [realIsA, setRealIsA] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/round?round=v1");
        if (!res.ok) return;
        const data: unknown = await res.json();
        if (isRoundBoards(data) && !cancelled) {
          setRealIsA(Math.random() < 0.5);
          setBoards(data);
        }
      } catch {
        // The section renders its frame without images; the demo never crashes.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const a = boards ? (realIsA ? boards.real_moodboard : boards.model_moodboard) : null;
  const b = boards ? (realIsA ? boards.model_moodboard : boards.real_moodboard) : null;

  return (
    <section className={s.sectionWide}>
      <Reveal>
        <p className={s.label}>FIG. 07 — THE EXPERIMENT · LIVE ROUND</p>
      </Reveal>
      <Reveal delay={100}>
        <h2 className={s.h2}>
          One of these was made by a person.
          <br />
          The other, by her model.
        </h2>
      </Reveal>
      <div className={s.exhibits}>
        <Exhibit label="EXHIBIT A" images={a} delay={150} />
        <Exhibit label="EXHIBIT B" images={b} delay={250} />
      </div>
      <Reveal delay={300}>
        <p className={s.ctaLine}>
          <Link href="/judge" className={s.inkLink}>
            SIT ON THE PANEL ↗
          </Link>
          <span className={s.ctaNote}>every pick is recorded</span>
        </p>
      </Reveal>
    </section>
  );
}

function Exhibit({
  label,
  images,
  delay,
}: {
  label: string;
  images: Moodboard | null;
  delay: number;
}) {
  return (
    <Reveal delay={delay}>
      <figure className={s.exhibit}>
        <figcaption className={s.label}>{label}</figcaption>
        <div className={s.exhibitGrid}>
          {(images ?? Array.from({ length: 9 }, () => null)).map((url, i) =>
            url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${i}-${url}`}
                src={url}
                alt={`${label}, image ${i + 1} of 9`}
                loading="lazy"
              />
            ) : (
              <div key={i} className={s.exhibitBlank} />
            )
          )}
        </div>
      </figure>
    </Reveal>
  );
}

/* ------------------------------------------------------------- reading */

function Reading() {
  const [v1, setV1] = useState<Score | null>(null);
  const [v2, setV2] = useState<Score | null>(null);

  useEffect(() => {
    let cancelled = false;
    const grab = async (round: string, set: (x: Score) => void) => {
      try {
        const res = await fetch(`/api/score?round=${round}`);
        if (!res.ok) return;
        const data = (await res.json()) as Score;
        if (!cancelled) set(data);
      } catch {
        // Numerals fall back to em dashes.
      }
    };
    grab("v1", setV1);
    grab("v2", setV2);
    return () => {
      cancelled = true;
    };
  }, []);

  const delta =
    v1?.score != null && v2?.score != null ? v2.score - v1.score : null;

  return (
    <section className={s.section}>
      <Reveal>
        <p className={s.label}>FIG. 08 — THE READING</p>
      </Reveal>
      <div className={s.scores}>
        <ScoreCol label="ROUND v1 · COLD" score={v1} delay={100} />
        <ScoreCol label="ROUND v2 · REFINED" score={v2} delay={200} />
        <Reveal delay={300}>
          <div>
            <p className={s.label}>MOVEMENT</p>
            <p className={s.deltaNum}>
              {delta == null ? "Δ—" : `Δ${delta > 0 ? "+" : ""}${delta}`}
            </p>
            <p className={s.scoreMeta}>score falls as the model closes in</p>
          </div>
        </Reveal>
      </div>
      <Reveal delay={350}>
        <p className={s.statementSmall}>
          When the number moves, the model is learning you.
        </p>
      </Reveal>
      <Reveal delay={400}>
        <p className={s.ctaLine}>
          <Link href="/score" className={s.inkLink}>
            OPEN THE LIVE READING ↗
          </Link>
        </p>
      </Reveal>
    </section>
  );
}

function ScoreCol({
  label,
  score,
  delay,
}: {
  label: string;
  score: Score | null;
  delay: number;
}) {
  return (
    <Reveal delay={delay}>
      <div>
        <p className={s.label}>{label}</p>
        <p className={s.scoreNum}>
          {score?.score != null ? <CountUp value={score.score} /> : "——"}
        </p>
        <p className={s.scoreMeta}>
          {score && score.n > 0
            ? `${score.n} strangers · spot rate ${Math.round(
                (score.spot_rate ?? 0) * 100
              )}%`
            : "awaiting panel"}
        </p>
      </div>
    </Reveal>
  );
}

function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const dur = 1400;
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          setN(Math.round(eased * value));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return <span ref={ref}>{n}</span>;
}

/* -------------------------------------------------------------- footer */

function Footer() {
  return (
    <footer className={s.footer}>
      <p className={s.footerLine}>
        Taste never got a score. <em>Until now.</em>
      </p>
      <nav className={s.footerNav}>
        <Link href="/judge">JOIN THE PANEL</Link>
        <Link href="/score">THE SCORE</Link>
        <span>TARA · SPECIMEN RECORD 001 · 2026</span>
      </nav>
    </footer>
  );
}

/* ==================================================== pixel machinery */

/** Small pixel glyph rendered as a CSS grid, wild.as-style. */
function PixelGlyph({ map, className }: { map: string[]; className?: string }) {
  const cols = map[0].length;
  return (
    <div
      aria-hidden
      className={`${s.pixelGlyph} ${className ?? ""}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {map.flatMap((row, y) =>
        row.split("").map((c, x) => (
          <span key={`${x}-${y}`} className={c === "1" ? s.px : s.pxOff} />
        ))
      )}
    </div>
  );
}

/**
 * The signature graphic: a full-width pixel heatmap that resolves from
 * random noise into a coherent hot pattern as it enters the viewport —
 * one person's taste emerging from the average.
 */
function PixelField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const CELL = 16;
    const GAP = 2;
    const ROWS = 13;

    let raf = 0;
    let running = false;
    let progress = 0; // 0 = noise, 1 = resolved pattern
    let cols = 0;
    let noise: number[][] = [];

    const COLORS = ["#14183C", "#3B4FE0", "#F2A33C", "#C8102E", "#D8F24B"];

    const colorFor = (v: number): string | null => {
      if (v < 0.28) return null;
      if (v < 0.45) return COLORS[0];
      if (v < 0.6) return COLORS[1];
      if (v < 0.75) return COLORS[2];
      if (v < 0.9) return COLORS[3];
      return COLORS[4];
    };

    // Two soft gaussian blobs — the "signal" the noise resolves into.
    const target = (x: number, y: number): number => {
      const nx = x / cols;
      const ny = y / ROWS;
      const blob = (cx: number, cy: number, sp: number) =>
        Math.exp(-(((nx - cx) ** 2 + (ny - cy) ** 2 * 2.6) / sp));
      return Math.min(1, blob(0.3, 0.45, 0.03) * 1.05 + blob(0.62, 0.6, 0.012) * 0.9);
    };

    const setup = () => {
      const w = canvas.parentElement?.clientWidth ?? window.innerWidth;
      cols = Math.floor(w / (CELL + GAP));
      canvas.width = cols * (CELL + GAP);
      canvas.height = ROWS * (CELL + GAP);
      noise = Array.from({ length: ROWS }, () =>
        Array.from({ length: cols }, () => Math.random())
      );
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < cols; x++) {
          // Gentle perpetual shimmer keeps the field alive after resolving.
          const shimmer = 0.06 * Math.sin(t / 900 + x * 1.7 + y * 2.3);
          const v =
            noise[y][x] * (1 - progress) * 0.9 +
            target(x, y) * progress +
            shimmer;
          const c = colorFor(v);
          if (!c) continue;
          ctx.fillStyle = c;
          ctx.fillRect(x * (CELL + GAP), y * (CELL + GAP), CELL, CELL);
        }
      }
    };

    let resolveStart = 0;
    const loop = (t: number) => {
      if (resolveStart === 0) resolveStart = t;
      const p = Math.min(1, (t - resolveStart) / 2600);
      progress = 1 - Math.pow(1 - p, 3);
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    setup();
    draw(0);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true;
          raf = requestAnimationFrame(loop);
        }
      },
      { threshold: 0.3 }
    );
    io.observe(canvas);

    const onResize = () => {
      setup();
      // Repaint immediately — resizing the canvas wipes it, and the rAF
      // loop may not be running yet (or the tab may be hidden).
      draw(performance.now());
    };
    window.addEventListener("resize", onResize);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className={s.pixelField} />;
}

/* -------------------------------------------------- reveal-on-scroll */

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${s.reveal} ${inView ? s.revealIn : ""}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------- scroll-driven word reveal */

function WordReveal({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [shown, setShown] = useState(0);
  const words = text.split(" ");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const p = Math.min(1, Math.max(0, (vh * 0.92 - r.top) / (vh * 0.55)));
        setShown(Math.ceil(p * words.length));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [words.length]);

  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <span
          key={`${i}-${w}`}
          className={`${s.word} ${i < shown ? s.wordOn : ""}`}
        >
          {w}{" "}
        </span>
      ))}
    </p>
  );
}
