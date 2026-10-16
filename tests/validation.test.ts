import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRun, watchlist } from "../src/core.js";
// Explicit validation-only test fixtures. Never ingested as live predictions.
const signal = {
  ticker: "TEST",
  exchange: "XNYS",
  market_symbol: "TEST",
  company: "TEST FIXTURE",
  sector: "test",
  tag: "ORANGE",
  signal_price: 100,
  currency: "USD",
  quote_at: "2026-01-02T16:44:00Z",
  quote_source: "https://example.invalid/fixture",
  data_status: "verified",
  data_reason: "TEST FIXTURE",
  catalyst_type: "fixture",
  catalyst_summary: "fixture",
  thesis: "fixture",
  risks: "fixture",
  invalidation: "fixture",
  target_pct: null,
  horizon_days: 30,
  sources: [],
  discovery_reason: null,
};
const fixture = () => ({
  run_key: "FIXTURE:validate",
  run_date: "2026-01-02",
  cutoff_at: "2026-01-02T16:45:00Z",
  generated_at: "2026-01-02T16:46:00Z",
  market_context: "EXPLICIT TEST FIXTURE",
  raw_report: "EXPLICIT TEST FIXTURE",
  run_type: "fixture",
  signals: [structuredClone(signal)],
});
test("quote at cutoff rejected and earlier quote accepted", () => {
  const r = fixture();
  assert.doesNotThrow(() => validateRun(r));
  r.signals[0].quote_at = r.cutoff_at;
  assert.throws(() => validateRun(r), /predate/);
});
test("missing quote not RED; ORANGE has no baseline", () => {
  const r = fixture();
  Object.assign(r.signals[0], {
    signal_price: null,
    quote_at: null,
    quote_source: null,
    data_status: "missing",
    tag: "RED",
  });
  assert.throws(() => validateRun(r), /Missing data/);
  r.signals[0].tag = "ORANGE";
  assert.doesNotThrow(() => validateRun(r));
});
test("duplicate identity and unknown fields rejected", () => {
  const r = fixture();
  r.signals.push(structuredClone(r.signals[0]));
  assert.throws(() => validateRun(r), /Duplicate/);
  assert.throws(() => validateRun({ ...fixture(), extra: "unexpected" }));
});
test("source after cutoff rejected", () => {
  const r = fixture();
  (r.signals[0].sources as any[]).push({
    url: "https://example.invalid",
    published_at: "2026-01-02T16:46:00Z",
    accessed_at: "2026-01-02T16:46:00Z",
    summary: "fixture",
  });
  assert.throws(() => validateRun(r), /Post-cutoff/);
});
test("all 20 mandatory; no forced greens", () => {
  const r = fixture();
  r.run_type = "live";
  r.run_key = "daily:2026-01-02";
  r.signals = watchlist.map((w) => ({ ...structuredClone(signal), ...w }));
  assert.doesNotThrow(() => validateRun(r));
  r.signals.pop();
  assert.throws(() => validateRun(r), /Missing watchlist/);
});
test("green requires timestamped evidence", () => {
  const r = fixture();
  r.run_type = "live";
  r.run_key = "daily:2026-01-02";
  r.signals = watchlist.map((w) => ({ ...structuredClone(signal), ...w }));
  r.signals[0].tag = "GREEN";
  assert.throws(() => validateRun(r), /timestamped/);
});
test("late generated_at fails anti-hindsight", () => {
  const r = fixture();
  r.run_type = "live";
  r.generated_at = "2026-01-02T17:02:00Z";
  assert.throws(() => validateRun(r), /15 minutes/);
});
