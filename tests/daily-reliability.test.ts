import { test } from "node:test";
import assert from "node:assert/strict";
import { selectBars, fetchChart } from "../src/market.js";
import { nextScheduledRetry } from "../src/worker.js";

test("retry is next scheduled weekday Paris morning across weekends and DST", () => {
  assert.equal(
    nextScheduledRetry(Date.parse("2026-10-23T07:30:00Z")),
    "2026-10-26T08:30:00.000Z",
  );
  assert.equal(
    nextScheduledRetry(Date.parse("2027-03-26T08:30:00Z")),
    "2027-03-29T07:30:00.000Z",
  );
});
test("invalid history dates reject before network", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw Error("Unexpected network for invalid window");
  };
  try {
    await assert.rejects(
      fetchChart("MC.PA", "1d", undefined, {
        start: "2026-99-01",
        end: "2026-99-03",
      }),
      /Invalid history window/,
    );
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
  }
});
test("truncated OHLC array is structural corruption, not a pending session", () => {
  const c = structuredClone(base);
  c.indicators.quote[0].close = [];
  assert.throws(
    () =>
      selectBars(
        c,
        sessions,
        "2026-10-19T07:00:00Z",
        "EUR",
        Date.parse("2026-10-21T07:30:00Z"),
      ),
    /Malformed provider OHLC arrays/,
  );
});
const sessions = [{ session: "2026-10-20", close_at: "2026-10-20T15:30:00Z" }];
const base = {
  meta: { currency: "EUR", exchangeTimezoneName: "Europe/Paris" },
  timestamp: [1792479600],
  indicators: {
    quote: [{ open: [null], high: [null], low: [null], close: [null] }],
  },
};
test("exact Oct21 Yahoo all-null completed Paris bar remains absent, never invented from current live bar", () => {
  assert.deepEqual(
    selectBars(
      base,
      sessions,
      "2026-10-19T07:00:00Z",
      "EUR",
      Date.parse("2026-10-21T07:30:00Z"),
    ),
    [],
  );
});
test("partially populated completed Yahoo OHLC is a pending absence, never a fabricated close", () => {
  const c = structuredClone(base);
  Object.assign(c.indicators.quote[0], {
    open: [387.1499938964844],
    high: [388.6499938964844],
    low: [384.45001220703125],
  });
  assert.deepEqual(
    selectBars(
      c,
      sessions,
      "2026-10-19T07:00:00Z",
      "EUR",
      Date.parse("2026-10-21T07:30:00Z"),
    ),
    [],
  );
});
test("non-null invalid numeric completed OHLC is structural corruption, not pending absence", () => {
  const c: any = structuredClone(base);
  Object.assign(c.indicators.quote[0], {
    open: [-1],
    high: [2],
    low: [1],
    close: [1],
  });
  assert.throws(
    () =>
      selectBars(
        c,
        sessions,
        "2026-10-19T07:00:00Z",
        "EUR",
        Date.parse("2026-10-21T07:30:00Z"),
      ),
    /Invalid provider OHLC/,
  );
});
