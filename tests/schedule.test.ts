import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRun, watchlist } from "../src/core.js";
import { cutoffForDate, quoteBeforeCutoff } from "../src/quotes.js";

// Validation-only synthetic payloads. Never sent to production.
export function scheduledPayload(date: string, cutoff: string) {
  return {
    run_key: `daily:${date}`,
    run_date: date,
    cutoff_at: cutoff,
    generated_at: new Date(Date.parse(cutoff) + 60000).toISOString(),
    run_type: "live",
    market_context: "EXPLICIT TEST FIXTURE",
    raw_report: "EXPLICIT TEST FIXTURE",
    signals: watchlist.map((w) => ({
      ...w,
      tag: "ORANGE",
      signal_price: null,
      quote_at: null,
      quote_source: null,
      data_status: "missing",
      data_reason: "EXPLICIT TEST FIXTURE",
      catalyst_type: "fixture",
      catalyst_summary: "fixture",
      thesis: "fixture",
      risks: "fixture",
      invalidation: "fixture",
      target_pct: null,
      horizon_days: 30,
      sources: [],
      discovery_reason: null,
    })),
  };
}
const cases = [
  ["2026-01-02", "16:45"],
  ["2026-10-16", "15:45"],
  ["2026-10-18", "15:45"],
  ["2026-10-19", "07:00"],
  ["2026-10-24", "07:00"],
  ["2026-10-25", "08:00"],
  ["2026-10-26", "08:00"],
  ["2027-03-27", "08:00"],
  ["2027-03-28", "07:00"],
];
for (const [date, time] of cases)
  test(`effective Paris cutoff and live validation ${date}`, (t) => {
    t.mock.method(Date, "now", () => Date.parse(`${date}T23:59:00Z`));
    const cutoff = `${date}T${time}:00.000Z`;
    assert.equal(cutoffForDate(date), cutoff);
    const payload = scheduledPayload(date, cutoff);
    assert.doesNotThrow(() => validateRun(payload));
    const wrong = scheduledPayload(
      date,
      `${date}T${date < "2026-10-19" ? "07:00" : "15:45"}:00.000Z`,
    );
    assert.throws(() => validateRun(wrong), /Live cutoff/);
    assert.throws(
      () =>
        validateRun({
          ...payload,
          cutoff_at: cutoff.replace(".000Z", ".001Z"),
        }),
      /Live cutoff/,
    );
    payload.generated_at = new Date(
      Date.parse(cutoff) + 15 * 60000,
    ).toISOString();
    assert.doesNotThrow(() => validateRun(payload));
    payload.generated_at = new Date(
      Date.parse(cutoff) + 15 * 60000 + 1,
    ).toISOString();
    assert.throws(() => validateRun(payload), /15 minutes/);
  });
test("09:00 baseline uses only completed strictly pre-cutoff minutes; US previous session allowed", () => {
  const cutoff = "2026-10-19T07:00:00.000Z";
  const minute = Date.parse(cutoff) / 1000;
  const chart = {
    meta: { currency: "USD" },
    timestamp: [minute - 180, minute - 120, minute - 60, minute],
    indicators: { quote: [{ close: [10, 20, 30, 40] }] },
  };
  assert.equal(quoteBeforeCutoff(chart, cutoff, "USD").signal_price, 20);
  chart.timestamp = [Date.parse("2026-10-16T19:59:00Z") / 1000];
  assert.equal(
    quoteBeforeCutoff(chart, cutoff, "USD").quote_at,
    "2026-10-16T20:00:00.000Z",
  );
});
