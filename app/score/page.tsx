import type { Metadata } from "next";
import { body, display } from "./fonts";
import ScoreClient from "./score-client";
import styles from "./score.module.css";

export const metadata: Metadata = {
  title: "Taste Test — Score",
  description: "A scoreboard for taste. How far the strangers land from a coin-flip.",
};

export default function ScorePage() {
  return (
    <main className={`${display.variable} ${body.variable} ${styles.screen}`}>
      <ScoreClient />
    </main>
  );
}
