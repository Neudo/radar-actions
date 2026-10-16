import { test } from "node:test";
import assert from "node:assert/strict";
import { selectBars, retry } from "../src/market.js";
import { hash } from "../src/core.js";
const chart = {
  meta: { currency: "USD" },
  timestamp: [1767623400, 1767709800],
  indicators: {
    quote: [
      { open: [100, 102], high: [105, 110], low: [99, 101], close: [104, 108] },
    ],
  },
  events: { splits: {} },
};
const sessions = [
  { session: "2026-01-05", close_at: "2026-01-05T21:00:00Z" },
  { session: "2026-01-06", close_at: "2026-01-06T21:00:00Z" },
];
test("only fully closed subsequent sessions, not cutoff date", () => {
  const b = selectBars(
    chart,
    sessions,
    "2026-01-04T17:00:00Z",
    "USD",
    Date.parse("2026-01-06T20:00:00Z"),
  );
  assert.equal(b.length, 1);
  assert.equal(b[0].n, 1);
});
test("currency mismatch fails closed", () =>
  assert.throws(() =>
    selectBars(
      chart,
      sessions,
      "2026-01-04T17:00:00Z",
      "EUR",
      Date.parse("2026-01-07"),
    ),
  ));
test("missing bar preserves session gap", () => {
  const c = structuredClone(chart);
  c.indicators.quote[0].close[0] = null as any;
  const b = selectBars(
    c,
    sessions,
    "2026-01-04T17:00:00Z",
    "USD",
    Date.parse("2026-01-07"),
  );
  assert.equal(b[0].n, 2);
});
test("split event quarantined pending audit; never silent adjustment", () => {
  const c = structuredClone(chart);
  c.events.splits = {
    one: { date: 1767709800, numerator: 2, denominator: 1 },
  } as any;
  assert.throws(
    () =>
      selectBars(
        c,
        sessions,
        "2026-01-04T17:00:00Z",
        "USD",
        Date.parse("2026-01-07"),
      ),
    /split/,
  );
});
test("audited split factor restores original entry basis", () => {
  const c = structuredClone(chart);
  c.events.splits = {
    one: { date: 1767709800, numerator: 2, denominator: 1 },
  } as any;
  const events = Object.values(c.events.splits);
  const b = selectBars(
    c,
    sessions,
    "2026-01-04T17:00:00Z",
    "USD",
    Date.parse("2026-01-07"),
    { event_hash: hash(events), factor: 2 },
  );
  assert.equal(b[0].close, 208);
  assert.equal(b[0].adjustment_factor, 2);
});
test("retry eventually succeeds without synthesizing result", async () => {
  let n = 0;
  const v = await retry(
    async () => {
      if (++n < 3) throw Error("timeout");
      return 42;
    },
    3,
    1,
  );
  assert.equal(n, 3);
  assert.equal(v, 42);
});
test("retry exhaust propagates error", async () => {
  await assert.rejects(
    retry(
      async () => {
        throw Error("outage");
      },
      2,
      1,
    ),
    /outage/,
  );
});
