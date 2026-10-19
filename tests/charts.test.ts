import { test } from "node:test";
import assert from "node:assert/strict";
import { evolution, levels, cohorts } from "../frontend/lib/charts.js";
const signal: any = {
  ticker: "TEST",
  exchange: "XNYS",
  currency: "USD",
  signal_price: "100",
  data_status: "verified",
  tracking_status: "active",
  payload: {
    quote_at: "2026-01-02T16:00:00Z",
    quote_source: "https://example.invalid/j0",
  },
  observations: [
    {
      trading_days_since_signal: 1,
      price: "101",
      performance_pct: "1",
      session: "2026-01-05",
      observed_at: "2026-01-05T21:00:00Z",
      source: "https://example.invalid/bar",
    },
    {
      trading_days_since_signal: 3,
      price: "99",
      performance_pct: "-1",
      session: "2026-01-07",
      observed_at: "2026-01-07T21:00:00Z",
    },
  ],
};
test("evolution includes frozen J0 and explicit gaps, never synthetic observations", () => {
  const s = evolution(signal);
  assert.equal(s.length, 4);
  assert.equal(s[0].price, 100);
  assert.equal(s[0].return_pct, 0);
  assert.equal(s[2].price, null);
  assert.equal(s[3].price, 99);
  assert.equal(s[1].source, "https://example.invalid/bar");
});
test("quarantine, missing and unknown never contribute chart points", () => {
  for (const s of [
    { ...signal, measurement_eligible: false },
    { ...signal, tracking_status: "quarantined" },
    { ...signal, data_status: "missing" },
    { ...signal, payload: { assessment_status: "unknown" } },
  ])
    assert.deepEqual(evolution(s), []);
});
test("no invented J0 for absent baseline and no future empty sessions", () => {
  assert.equal(evolution({ ...signal, signal_price: null })[0].price, null);
  assert.equal(evolution({ ...signal, observations: [] }).length, 1);
});
test("levels require exact native instrument, venue and currency; stored ranges only", () => {
  const setup = {
    listing: { identifier: "TEST:XNYS", venue: "XNYS", currency: "USD" },
    support: { low: 90, high: 92, basis: "evidence" },
    alert: { low: 93, high: 95 },
  };
  assert.equal(levels({ ...signal, payload: { setup } }).length, 4);
  for (const listing of [
    { ...setup.listing, currency: "EUR" },
    { ...setup.listing, identifier: "FR0000000000" },
    { ...setup.listing, venue: "XNAS" },
  ])
    assert.deepEqual(
      levels({ ...signal, payload: { setup: { ...setup, listing } } }),
      [],
    );
});
test("cohorts omit empty/absent samples and retain real zero; each checkpoint has its n", () => {
  const a = {
    by_tag: {
      GREEN: { total: 0, checkpoints: { 5: { n: 0, mean: null } } },
      ORANGE: {
        total: 2,
        checkpoints: {
          5: { n: 2, mean: 0, median: 0 },
          10: { n: 0, mean: null },
        },
      },
    },
  };
  assert.deepEqual(cohorts(a, 5), [
    { tag: "ORANGE", n: 2, mean: 0, median: 0, total: 2 },
  ]);
  assert.deepEqual(cohorts(a, 10), []);
});
