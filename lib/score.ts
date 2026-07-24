// Pure scoring math for the taste test. Shape mirrors /lib/contracts.ts:
// spot_rate/score are null only when there are no picks.

export interface ScoreResult {
  n: number;
  spot_rate: number | null;
  score: number | null;
}

/**
 * spot_rate = fraction of picks with chose_real === true (2 decimals)
 * score     = round(|spot_rate - 0.5| * 200)
 *             0 = indistinguishable (model won), 100 = fully spotted.
 */
export function scoreFromPicks(picks: { chose_real: boolean }[]): ScoreResult {
  const n = picks.length;
  if (n === 0) {
    return { n: 0, spot_rate: null, score: null };
  }
  const rate = picks.filter((p) => p.chose_real).length / n;
  return {
    n,
    spot_rate: Math.round(rate * 100) / 100,
    score: Math.round(Math.abs(rate - 0.5) * 200),
  };
}
