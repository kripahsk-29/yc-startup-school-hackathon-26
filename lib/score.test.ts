import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreFromPicks } from "./score";

const picks = (...values: boolean[]) => values.map((chose_real) => ({ chose_real }));

test("all correct picks -> spot_rate 1, score 100", () => {
  const result = scoreFromPicks(picks(true, true, true, true));
  assert.deepEqual(result, { n: 4, spot_rate: 1, score: 100 });
});

test("all wrong picks -> spot_rate 0, score 100", () => {
  const result = scoreFromPicks(picks(false, false, false, false));
  assert.deepEqual(result, { n: 4, spot_rate: 0, score: 100 });
});

test("exact 50/50 -> spot_rate 0.5, score 0", () => {
  const result = scoreFromPicks(picks(true, false, true, false));
  assert.deepEqual(result, { n: 4, spot_rate: 0.5, score: 0 });
});
