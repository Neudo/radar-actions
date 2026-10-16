import { test } from "node:test";
import assert from "node:assert/strict";
import { signalSchema, validateRun, hash, aggregate } from "../src/core.js";
import { technicalContext } from "../src/technical.js";
import { readFileSync } from "node:fs";
const listing = {
  identifier: "TEST:XNYS",
  venue: "XNYS",
  currency: "USD",
  quote_price: 100,
  quote_at: "2026-01-02T16:44:00Z",
  quote_source: "https://example.invalid/fixture",
  trade_republic_verified: false,
};
const zone = (low: number, high: number) => ({
  low,
  high,
  basis: "EXPLICIT TEST FIXTURE support evidence",
});
const setup = () => ({
  listing: { ...listing },
  support: zone(92, 93),
  alert: zone(94, 95),
  structural_invalidation: zone(90, 91),
  technical_evidence: "EXPLICIT TEST FIXTURE",
  confirmations: [],
});
const signal: any = {
  ticker: "TEST",
  exchange: "XNYS",
  market_symbol: "TEST",
  company: "TEST FIXTURE",
  sector: "test",
  tag: "ORANGE",
  signal_price: 100,
  currency: "USD",
  quote_at: listing.quote_at,
  quote_source: listing.quote_source,
  data_status: "verified",
  data_reason: "fixture",
  catalyst_type: "fixture",
  catalyst_summary: "fixture",
  thesis: "fixture",
  risks: "fixture",
  invalidation: "fixture",
  target_pct: 9,
  horizon_days: 30,
  sources: [],
  discovery_reason: null,
};
const run = (s: any) => ({
  run_key: "FIXTURE:pullback",
  run_date: "2026-01-02",
  cutoff_at: "2026-01-02T16:45:00Z",
  generated_at: "2026-01-02T16:46:00Z",
  run_type: "fixture",
  market_context: "TEST FIXTURE",
  raw_report: "TEST FIXTURE",
  signals: [s],
});
test("legacy signal hashes unchanged; structured J0 support/alert survives parsing", () => {
  assert.equal(hash(signalSchema.parse(signal)), hash(signal));
  const s = { ...signal, assessment_status: "assessed", setup: setup() };
  assert.deepEqual(validateRun(run(s)).signals[0], s);
  assert.throws(() =>
    signalSchema.parse({ ...s, setup: { ...s.setup, support: zone(95, 92) } }),
  );
});
test("setup provenance rejects post-cutoff/stale and casual currency conversion", () => {
  const s = { ...signal, setup: setup() };
  s.setup.listing.quote_at = "2026-01-02T16:45:00Z";
  assert.throws(() => validateRun(run(s)), /Setup quote/);
  s.setup.listing.quote_at = "2025-12-20T16:44:00Z";
  assert.throws(() => validateRun(run(s)), /Setup quote/);
  s.setup.listing = { ...listing, currency: "EUR" };
  assert.throws(() => validateRun(run(s)), /Trade Republic/);
  Object.assign(s.setup.listing, {
    identifier: "US0000000001",
    venue: "LS Exchange",
    trade_republic_verified: true,
  });
  assert.doesNotThrow(() => validateRun(run(s)));
});
test("unknown research is not a confirmed watch setup; alert precedes rebound", () => {
  assert.throws(
    () =>
      validateRun(
        run({ ...signal, assessment_status: "unknown", setup: setup() }),
      ),
    /Unknown/,
  );
  const s = { ...signal, setup: setup() };
  s.setup.alert = zone(104, 105);
  assert.throws(() => validateRun(run(s)), /Alert/);
  s.setup = setup();
  s.setup.structural_invalidation = zone(96, 97);
  assert.throws(() => validateRun(run(s)), /Invalidation/);
});
test("daily technical history contains volume, 120 sessions, no same-day future OHLC", () => {
  const ts = Array.from(
    { length: 130 },
    (_, i) => Date.parse("2025-08-01T13:30:00Z") / 1000 + i * 86400,
  );
  const vals = ts.map((_, i) => 100 + i);
  const chart = {
    meta: { currency: "USD" },
    timestamp: ts,
    indicators: {
      quote: [
        {
          open: vals,
          close: vals,
          high: vals.map((x) => x + 1),
          low: vals.map((x) => x - 1),
          volume: vals.map((x) => x * 100),
        },
      ],
    },
  };
  const cutoff = new Date(ts[129] * 1000 + 3600000).toISOString();
  const ctx = technicalContext(chart, cutoff, "USD", 220);
  assert.equal(ctx.daily_history.length, 120);
  assert.equal(ctx.daily_history.at(-1)?.close, 228);
  assert.equal(ctx.daily_history.at(-1)?.volume, 22800);
  assert.equal(ctx.moving_average_50, 203.5);
  assert.equal(ctx.recent_20_session_high, 229);
  assert.ok(
    ctx.daily_history.every((x) => x.at.slice(0, 10) < cutoff.slice(0, 10)),
  );
  assert.throws(() => technicalContext(chart, cutoff, "EUR", 220), /currency/);
  chart.indicators.quote[0].volume[128] = null as any;
  assert.equal(
    technicalContext(chart, cutoff, "USD", 220).daily_history.at(-1)?.volume,
    null,
  );
});
test("unknown assessments do not inflate ORANGE comparison cohorts", () => {
  const a = aggregate([
    { tag: "ORANGE", assessment_status: "unknown", performance: null },
    { tag: "ORANGE", performance: null },
  ]);
  assert.equal(a.overall.total, 2);
  assert.equal(a.unknown_count, 1);
  assert.equal(a.by_tag.ORANGE.total, 1);
});
test("canonical prompt retains exact source and excludes obsolete chase/report instructions", () => {
  const source = readFileSync("prompts/big-radar-user-source.txt", "utf8");
  const canonical = readFileSync("prompts/big-radar-original.md", "utf8");
  assert.ok(canonical.includes(source.trimEnd()));
  const daily = readFileSync("prompts/daily-cron.md", "utf8");
  for (const term of [
    "pullback",
    "assessment_status",
    "setup",
    "Trade Republic",
    "5–30 séances",
    "pas de surveillance",
    "cutoff",
    "2–3 phrases",
  ])
    assert.ok(daily.includes(term), term);
  assert.ok(!daily.includes("Recherche insuffisante => ORANGE"));
});
