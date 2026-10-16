import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculate,
  aggregate,
  canonical,
  validateRun,
  drawdown,
} from "../src/core.js";
const bar = (n: number, c: number, h = c, l = c) => ({
  session: `2026-01-${String(n + 1).padStart(2, "0")}`,
  n,
  open: c,
  high: h,
  low: l,
  close: c,
});
test("checkpoints are trading sessions; no maturity on 29", () => {
  const bs = Array.from({ length: 29 }, (_, i) => bar(i + 1, 100 + i));
  const p = calculate(100, bs);
  assert.equal(p.checkpoints["5"], 4);
  assert.equal(p.checkpoints["30"], null);
  assert.equal(p.matured, false);
});
test("intraday target is separate from close, first hit deterministic", () => {
  const p = calculate(100, [bar(1, 102, 111, 99), bar(2, 110, 112, 100)]);
  assert.equal(p.targets["10"].intraday_day, 1);
  assert.equal(p.targets["10"].close_day, 2);
});
test("true close peak drawdown not loss from entry", () => {
  const p = calculate(100, [bar(1, 120), bar(2, 90)]);
  assert.equal(p.close_drawdown_pct, -25);
  assert.equal(p.min_return_pct, -10);
});
test("unknown OHLC high/low order reported as drawdown bounds", () => {
  const d = drawdown(100, [bar(1, 105, 120, 90)]);
  assert.equal(d.optimistic_pct, -14.28571429);
  assert.equal(d.conservative_pct, -25);
});
test("gaps block all later checkpoints rather than renumbering", () => {
  const p = calculate(100, [bar(1, 101), bar(3, 105)]);
  assert.equal(p.sessions, 1);
  assert.equal(p.data_status, "gap");
});
test("zero entry rejected", () => assert.throws(() => calculate(0, [])));
test("matured-only rates, all four tags retained", () => {
  const a = aggregate([
    { tag: "GREEN", performance: calculate(100, [bar(1, 110)]) },
    {
      tag: "RED",
      performance: calculate(
        100,
        Array.from({ length: 30 }, (_, i) => bar(i + 1, 90)),
      ),
    },
  ]);
  assert.equal(a.by_tag.GREEN.matured, 0);
  assert.equal(a.by_tag.GREEN.target_rates["9"].intraday_pct, null);
  assert.equal(a.by_tag.RED.matured, 1);
  assert.equal(Object.keys(a.by_tag).length, 4);
});
test("canonical object hashes independent of key order", () =>
  assert.equal(canonical({ a: 1, b: 2 }), canonical({ b: 2, a: 1 })));
test("empty and future quote payload rejected", () => {
  assert.throws(() => validateRun({}));
});
