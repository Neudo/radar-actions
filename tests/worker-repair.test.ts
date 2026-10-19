import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { migrate } from "../src/migrate.js";
import { runWorker } from "../src/worker.js";
import { hash } from "../src/core.js";
import { buildApp } from "../src/app.js";

const cutoff = "2026-01-02T16:45:00Z";
const sessions = Array.from({ length: 30 }, (_, i) => ({
  session: new Date(Date.UTC(2026, 0, 5 + i)).toISOString().slice(0, 10),
  close_at: new Date(Date.UTC(2026, 0, 5 + i, 21)).toISOString(),
}));
// EXPLICIT SYNTHETIC TEST CALENDAR AND OHLC, NEVER PRODUCTION DATA.
const now = Date.parse("2026-01-07T23:00:00Z");
const chart = (symbol = "TEST", count = 3): any => ({
  meta: { currency: "USD", symbol, exchangeName: "NYQ" },
  timestamp: sessions.slice(0, count).map((x) => Date.parse(x.close_at) / 1000),
  indicators: {
    quote: [
      {
        open: Array(count).fill(100),
        high: Array(count).fill(102),
        low: Array(count).fill(99),
        close: Array(count).fill(101),
      },
    ],
  },
  events: {},
  fixture_notice: "EXPLICIT SYNTHETIC OHLC TEST FIXTURE",
});
isolated(
  "empty closed-bar feed is an unexpected outage on each retry, not a known missing-session exclusion",
  async (pool) => {
    await signal(pool);
    for (let i = 0; i < 2; i++) {
      const result = await runWorker(pool, deps(pool, chart("TEST", 0)));
      assert.equal(result.exitCode, 2);
      assert.equal(result.summary.unexpected_failures, 1);
    }
  },
);
isolated(
  "legacy conflicts classify actual archived evidence, not reversion; precision remains frozen and material remains excluded",
  async (pool) => {
    const id = await signal(pool);
    await runWorker(pool, deps(pool, chart()));
    const before = await snapshot(pool);
    const old = (
      await pool.query(
        "SELECT * FROM price_observations ORDER BY trading_days_since_signal LIMIT 1",
      )
    ).rows[0];
    for (const high of [102.001708984375, 102.02]) {
      const c = chart();
      c.indicators.quote[0].high[0] = high;
      const f = await fetcher(pool, c);
      const b = {
        session: old.ohlc.session,
        n: old.ohlc.n,
        open: 100,
        high,
        low: 99,
        close: 101,
      };
      await pool.query(
        "INSERT INTO data_conflicts(signal_id,session,existing_hash,new_hash,fetch_id) VALUES($1,$2,$3,$4,$5)",
        [id, old.session, old.payload_hash, hash(b), f.id],
      );
    }
    const result = await runWorker(pool, deps(pool, chart()));
    assert.equal(result.status, "ok_with_exclusions");
    assert.equal(result.exitCode, 0);
    assert.deepEqual(
      (
        await pool.query(
          "SELECT classification,decision FROM price_revisions ORDER BY classification",
        )
      ).rows,
      [
        { classification: "cent_precision", decision: "retain_frozen" },
        { classification: "material", decision: "exclude" },
      ],
    );
    assert.equal(
      (await pool.query("SELECT status FROM signal_performance")).rows[0]
        .status,
      "quarantined",
    );
    assert.deepEqual(await snapshot(pool), before);
  },
);
isolated(
  "dividend-adjusted close is not mixed into native price-return observations",
  async (pool) => {
    await signal(pool);
    const c = chart();
    c.events.dividends = {
      fixture: {
        date: Date.parse("2026-01-06T14:30:00Z") / 1000,
        amount: 1.65,
      },
    };
    c.indicators.adjclose = [{ adjclose: [97, 98, 99] }];
    await runWorker(pool, deps(pool, c));
    const before = await snapshot(pool);
    c.indicators.adjclose[0].adjclose = [95, 96, 97];
    assert.equal((await runWorker(pool, deps(pool, c))).exitCode, 0);
    assert.deepEqual(await snapshot(pool), before);
    assert.equal(
      (await pool.query("SELECT count(*)::int n FROM price_revisions")).rows[0]
        .n,
      0,
    );
  },
);
let serial = 0;
function isolated(name: string, f: (pool: pg.Pool) => Promise<void>) {
  test(name, { skip: !process.env.TEST_DATABASE_URL }, async () => {
    const admin = new pg.Pool({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    const db = `radar_test_repair_${process.pid}_${++serial}`;
    const url = new URL(process.env.TEST_DATABASE_URL!);
    url.pathname = "/" + db;
    let pool: pg.Pool | undefined;
    try {
      await admin.query(`CREATE DATABASE ${db}`);
      pool = new pg.Pool({ connectionString: url.href });
      await migrate(pool);
      await f(pool);
    } finally {
      await pool?.end();
      await admin.query(`DROP DATABASE IF EXISTS ${db}`);
      await admin.end();
    }
  });
}
async function signal(pool: pg.Pool, symbol = "TEST") {
  const r = (
    await pool.query(
      "INSERT INTO radar_runs(run_key,run_date,cutoff_at,generated_at,run_type,market_context,raw_report,payload,payload_hash) VALUES($1,'2026-01-02',$2,$2,'fixture','EXPLICIT TEST FIXTURE','EXPLICIT TEST FIXTURE','{}','fixture') RETURNING id",
      ["FIXTURE:" + symbol, cutoff],
    )
  ).rows[0].id;
  return (
    await pool.query(
      "INSERT INTO radar_signals(run_id,ticker,exchange,market_symbol,company,sector,tag,signal_price,currency,catalyst_type,data_status,payload) VALUES($1,$2,'XNYS',$2,'EXPLICIT TEST FIXTURE','test','GREEN',100,'USD','fixture','verified','{}') RETURNING id",
      [r, symbol],
    )
  ).rows[0].id;
}
async function fetcher(pool: pg.Pool, c: any) {
  const id = (
    await pool.query(
      "INSERT INTO market_fetches(symbol,interval,source,payload,payload_hash) VALUES($1,'1d','https://example.invalid/EXPLICIT-TEST-FIXTURE',$2,$3) RETURNING id",
      [c.meta.symbol, c, hash(c)],
    )
  ).rows[0].id;
  return { id, chart: c, cache: false };
}
function deps(pool: pg.Pool, c: any, time = now) {
  return {
    fixtureMode: true,
    now: () => time,
    calendar: async () => sessions,
    fetchChart: async () => fetcher(pool, c),
  };
}
async function snapshot(pool: pg.Pool) {
  return (
    await pool.query(
      "SELECT (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM radar_runs r) runs,(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM radar_signals s) signals,(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM price_observations o) observations",
    )
  ).rows[0];
}

isolated(
  "worker exact regression: known revision excluded, healthy signal progresses, immutable rows and idempotent conflicts",
  async (pool) => {
    const bad = await signal(pool);
    const healthy = await signal(pool, "GOOD");
    let c = chart();
    let g = chart("GOOD");
    const options = {
      fixtureMode: true,
      now: () => now,
      calendar: async () => sessions,
      fetchChart: async (symbol: string) =>
        fetcher(pool, symbol === "GOOD" ? g : c),
    };
    await runWorker(pool, options);
    const before = await snapshot(pool);
    c = chart();
    c.indicators.quote[0].open[0] = 100.4;
    g = chart("GOOD", 4);
    options.now = () => Date.parse("2026-01-08T23:00:00Z");
    const first = await runWorker(pool, options);
    assert.equal(first.exitCode, 2);
    assert.equal(first.status, "partial");
    assert.equal(first.summary.new_failures, 1);
    assert.equal(first.summary.excluded, 1);
    assert.equal(first.summary.eligible, 1);
    assert.equal(
      (
        await pool.query(
          "SELECT metrics FROM signal_performance WHERE signal_id=$1",
          [healthy],
        )
      ).rows[0].metrics.sessions,
      4,
    );
    const after = await snapshot(pool);
    assert.deepEqual(after.runs, before.runs);
    assert.deepEqual(after.signals, before.signals);
    for (const row of before.observations)
      assert.deepEqual(
        after.observations.find((x: any) => x.id === row.id),
        row,
      );
    const repeat = await runWorker(pool, options);
    assert.equal(repeat.exitCode, 0);
    assert.equal(repeat.status, "ok_with_exclusions");
    assert.equal(repeat.summary.new_failures, 0);
    assert.equal(repeat.summary.known_exclusions, 1);
    assert.equal(
      (await pool.query("SELECT count(*)::int n FROM data_conflicts")).rows[0]
        .n,
      1,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM price_revisions WHERE classification='material'",
        )
      ).rows[0].n,
      1,
    );
    c.indicators.quote[0].open[0] = 100.7;
    assert.equal(
      (await runWorker(pool, options)).exitCode,
      2,
      "novel revision must still alert",
    );
    assert.equal(
      (await pool.query("SELECT count(*)::int n FROM data_conflicts")).rows[0]
        .n,
      2,
    );
    // Provider reversion must not silently clear an unresolved historical conflict.
    c = chart();
    await runWorker(pool, options);
    assert.equal(
      (
        await pool.query(
          "SELECT status FROM signal_performance WHERE signal_id=$1",
          [bad],
        )
      ).rows[0].status,
      "quarantined",
    );
    const app = await buildApp(pool, { key: "fixture", allowFixtures: true });
    try {
      const a = (
        await app.inject({
          url: "/api/v1/radar/analytics?include_fixtures=true",
          headers: { authorization: "Bearer fixture" },
        })
      ).json();
      assert.equal(a.measurement_counts.excluded, 1);
      assert.equal(a.overall.matured, 0);
      assert.equal(a.overall.checkpoints[30].n, 0);
      assert.equal(a.overall.target_rates[9].intraday_pct, null);
      const detail = (
        await app.inject({
          url: "/api/v1/radar/signals/" + bad,
          headers: { authorization: "Bearer fixture" },
        })
      ).json();
      assert.equal(detail.measurement_eligible, false);
      assert.equal(detail.performance, null);
      assert.equal(detail.revisions.length, 2);
      assert.equal(detail.source_data.policy, "frozen-first-v1");
      assert.equal(
        detail.observations.length,
        3,
        "excluded history still accessible",
      );
    } finally {
      await app.close();
    }
  },
);
isolated(
  "precision revisions are versioned provenance but accepted frozen prices never rounded or replaced",
  async (pool) => {
    await signal(pool);
    const c = chart();
    await runWorker(pool, deps(pool, c));
    const before = await snapshot(pool);
    c.indicators.quote[0].high[0] = 102.001708984375;
    const result = await runWorker(pool, deps(pool, c));
    assert.equal(result.status, "ok");
    assert.equal(result.exitCode, 0);
    assert.deepEqual(await snapshot(pool), before);
    const r = (await pool.query("SELECT * FROM price_revisions")).rows[0];
    assert.equal(r.classification, "cent_precision");
    assert.equal(r.decision, "retain_frozen");
    assert.ok(r.fetch_id);
    assert.equal(r.policy, "frozen-first-v1");
    await runWorker(pool, deps(pool, c));
    assert.equal(
      (await pool.query("SELECT count(*)::int n FROM price_revisions")).rows[0]
        .n,
      1,
    );
  },
);
isolated(
  "missing feed sessions are honest exclusions; repeated known gap not a new outage and recovery requires actual bars",
  async (pool) => {
    const id = await signal(pool);
    const c = chart();
    c.timestamp.splice(1, 1);
    for (const k of ["open", "high", "low", "close"])
      c.indicators.quote[0][k].splice(1, 1);
    const a = await runWorker(pool, deps(pool, c));
    assert.equal(a.exitCode, 2);
    assert.equal(a.summary.excluded, 1);
    let perf = (
      await pool.query("SELECT * FROM signal_performance WHERE signal_id=$1", [
        id,
      ])
    ).rows[0];
    assert.equal(perf.status, "missing");
    assert.equal(perf.metrics.sessions, 1);
    assert.equal(perf.metrics.checkpoints[5], null);
    const b = await runWorker(pool, deps(pool, c));
    assert.equal(b.status, "ok_with_exclusions");
    assert.equal(b.exitCode, 0);
    const recovered = await runWorker(pool, deps(pool, chart()));
    assert.equal(recovered.status, "ok");
    perf = (
      await pool.query("SELECT * FROM signal_performance WHERE signal_id=$1", [
        id,
      ])
    ).rows[0];
    assert.equal(perf.metrics.sessions, 3);
    assert.equal(perf.status, "active");
  },
);
isolated(
  "real provider/transport errors stay nonzero on EVERY retry, never known-quarantine suppression",
  async (pool) => {
    await signal(pool);
    await runWorker(pool, deps(pool, chart()));
    const options = {
      ...deps(pool, chart()),
      fetchChart: async () => {
        throw Error("Market HTTP 503 fixture outage");
      },
    };
    for (let i = 0; i < 2; i++) {
      const r = await runWorker(pool, options);
      assert.equal(r.exitCode, 2);
      assert.equal(r.status, "partial");
      assert.equal(r.summary.unexpected_failures, 1);
    }
    assert.equal(
      (await pool.query("SELECT count(*)::int n FROM price_observations"))
        .rows[0].n,
      3,
    );
  },
);
isolated(
  "split quarantine is audited and idempotent, never silently multiplied, recovery only after approved split audit",
  async (pool) => {
    const id = await signal(pool);
    const c = chart();
    c.events.splits = {
      fixture: {
        date: Date.parse("2026-01-06T14:30:00Z") / 1000,
        numerator: 2,
        denominator: 1,
      },
    };
    const a = await runWorker(pool, deps(pool, c));
    assert.equal(a.exitCode, 2);
    assert.equal(a.summary.excluded, 1);
    const b = await runWorker(pool, deps(pool, c));
    assert.equal(b.exitCode, 0);
    assert.equal(b.status, "ok_with_exclusions");
    assert.equal(
      (await pool.query("SELECT count(*)::int n FROM worker_issues")).rows[0].n,
      1,
    );
    assert.equal(
      (await pool.query("SELECT count(*)::int n FROM price_observations"))
        .rows[0].n,
      0,
    );
    await pool.query(
      "INSERT INTO split_audits(signal_id,event_hash,factor,reason,source,approved_by) VALUES($1,$2,2,'EXPLICIT TEST FIXTURE','https://example.invalid','fixture-auditor')",
      [id, hash(Object.values(c.events.splits))],
    );
    assert.equal((await runWorker(pool, deps(pool, c))).exitCode, 0);
    assert.equal(
      Number(
        (await pool.query("SELECT price FROM price_observations LIMIT 1"))
          .rows[0].price,
      ),
      202,
    );
  },
);
isolated(
  "wrong currency/listing and impossible OHLC are unexpected errors, never accepted revisions",
  async (pool) => {
    await signal(pool);
    for (const kind of ["currency", "listing", "ohlc"]) {
      const c = chart();
      if (kind === "currency") c.meta.currency = "EUR";
      if (kind === "listing") c.meta.symbol = "OTHER";
      if (kind === "ohlc") c.indicators.quote[0].high[0] = 90;
      const r = await runWorker(pool, deps(pool, c));
      assert.equal(r.exitCode, 2, kind);
      assert.equal(r.summary.unexpected_failures, 1, kind);
    }
    assert.equal(
      (await pool.query("SELECT count(*)::int n FROM price_observations"))
        .rows[0].n,
      0,
    );
  },
);
isolated(
  "immature signals do not fetch before first closed session; completed 30 sessions stop network calls",
  async (pool) => {
    await signal(pool);
    let calls = 0;
    const options = {
      ...deps(pool, chart()),
      fetchChart: async () => {
        calls++;
        return fetcher(pool, chart());
      },
    };
    const early = await runWorker(pool, {
      ...options,
      now: () => Date.parse("2026-01-05T21:30:00Z"),
    });
    assert.equal(early.exitCode, 0);
    assert.equal(calls, 0);
    assert.equal(early.summary.immature, 1);
    const c = chart("TEST", 30);
    await runWorker(pool, deps(pool, c, Date.parse("2026-02-20T23:00:00Z")));
    const complete = await runWorker(pool, options);
    assert.equal(calls, 0);
    assert.equal(complete.summary.completed, 1);
  },
);
isolated(
  "additive migration replay, runtime non-owner cannot mutate versioned evidence or approve splits",
  async (pool) => {
    await migrate(pool);
    await signal(pool);
    await runWorker(pool, deps(pool, chart()));
    const c = chart();
    c.indicators.quote[0].high[0] = 102.02;
    await runWorker(pool, deps(pool, c));
    await pool.query(
      "GRANT USAGE ON SCHEMA public TO radar_app; GRANT SELECT,INSERT ON price_revisions,worker_issues TO radar_app",
    );
    const client = await pool.connect();
    try {
      await client.query("SET ROLE radar_app");
      assert.equal(
        (await client.query("SELECT current_user")).rows[0].current_user,
        "radar_app",
      );
      for (const table of [
        "radar_runs",
        "radar_signals",
        "price_observations",
        "price_revisions",
        "worker_issues",
        "data_conflicts",
      ])
        for (const op of [`DELETE FROM ${table}`, `TRUNCATE ${table} CASCADE`])
          await assert.rejects(client.query(op), /permission denied|immutable/);
      await assert.rejects(
        client.query("UPDATE price_revisions SET policy='changed'"),
        /permission denied|immutable/,
      );
      await assert.rejects(
        client.query(
          "INSERT INTO split_audits(signal_id,event_hash,factor,reason,source,approved_by) SELECT id,'bad',2,'bad','bad','bad' FROM radar_signals LIMIT 1",
        ),
        /permission denied/,
      );
    } finally {
      await client.query("RESET ROLE");
      client.release();
    }
  },
);
