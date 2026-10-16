import { test } from "node:test";
import assert from "node:assert/strict";
import { cutoffForDate, quoteBeforeCutoff } from "../src/quotes.js";
test("Paris DST schedule precise", () => {
  assert.equal(cutoffForDate("2026-10-02"), "2026-10-02T15:45:00.000Z");
  assert.equal(cutoffForDate("2026-10-26"), "2026-10-26T08:00:00.000Z");
});
test("minute close must predate cutoff, not bar opening time", () => {
  const c = {
    timestamp: [1000, 1060, 1120],
    indicators: { quote: [{ close: [10, 20, 30] }] },
    meta: { currency: "USD" },
  };
  const q = quoteBeforeCutoff(c, new Date(1120 * 1000).toISOString(), "USD");
  assert.equal(q.signal_price, 10);
  assert.equal(q.quote_at, new Date(1060 * 1000).toISOString());
});
test("no quote returns explicitly missing not fabricated", () => {
  assert.equal(
    quoteBeforeCutoff(
      {
        timestamp: [],
        meta: { currency: "USD" },
        indicators: { quote: [{ close: [] }] },
      },
      "2026-01-01T00:00:00Z",
      "USD",
    ).signal_price,
    null,
  );
});
