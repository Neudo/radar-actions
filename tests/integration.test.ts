import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { migrate } from "../src/migrate.js";
import { ingest } from "../src/db.js";
import { calendar } from "../src/market.js";
import { hash } from "../src/core.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const fixture = {
  run_key: "FIXTURE:integration",
  run_date: "2026-01-02",
  cutoff_at: "2026-01-02T16:45:00Z",
  generated_at: "2026-01-02T16:46:00Z",
  market_context: "EXPLICIT TEST FIXTURE NOT A PREDICTION",
  raw_report: "EXPLICIT TEST FIXTURE NOT LIVE",
  run_type: "fixture",
  signals: [
    {
      ticker: "TEST",
      exchange: "XNYS",
      market_symbol: "TEST",
      company: "TEST FIXTURE",
      sector: "test",
      tag: "GREEN",
      signal_price: 100,
      currency: "USD",
      quote_at: "2026-01-02T16:44:00Z",
      quote_source: "https://example.invalid/fixture",
      data_status: "verified",
      data_reason: "test only",
      catalyst_type: "fixture",
      catalyst_summary: "test fixture",
      thesis: "test fixture",
      risks: "fixture",
      invalidation: "fixture",
      target_pct: 9,
      horizon_days: 30,
      sources: [],
      discovery_reason: null,
    },
  ],
};
test(
  "real PostgreSQL atomic ingest/auth/immutable history/concurrency",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = new pg.Pool({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    await migrate(pool);
    const app = await buildApp(pool, {
      key: "fixture-test-key",
      readKey: "fixture-read-key",
      allowFixtures: true,
    });
    const h = { authorization: "Bearer fixture-test-key" };
    assert.equal((await app.inject("/health")).statusCode, 200);
    assert.equal((await app.inject("/api/v1/radar/runs")).statusCode, 401);
    assert.equal((await app.inject("/dashboard")).statusCode, 401);
    assert.equal(
      (
        await app.inject({
          url: "/dashboard",
          headers: {
            authorization:
              "Basic " +
              Buffer.from("radar:fixture-read-key").toString("base64"),
          },
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/radar/runs",
          headers: { authorization: "Bearer fixture-read-key" },
          payload: fixture,
        })
      ).statusCode,
      401,
    );
    const first = await app.inject({
      method: "POST",
      url: "/api/v1/radar/runs",
      headers: h,
      payload: fixture,
    });
    assert.equal(first.statusCode, 201, first.body);
    const id = first.json().id;
    const broken = structuredClone(fixture);
    broken.run_key = "FIXTURE:rollback";
    broken.signals.push(structuredClone(broken.signals[0]));
    await assert.rejects(ingest(pool, broken as any));
    assert.equal(
      (await pool.query("select count(*)::int n from radar_runs")).rows[0].n,
      1,
      "partial transaction rolled back",
    );
    const late = { ...fixture, run_key: "daily:2026-01-02", run_type: "live" };
    await assert.rejects(ingest(pool, late as any), /Late live run/);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        app.inject({
          method: "POST",
          url: "/api/v1/radar/runs",
          headers: h,
          payload: fixture,
        }),
      ),
    );
    assert.ok(results.every((r) => r.statusCode === 200 && r.json().id === id));
    const changed = structuredClone(fixture);
    changed.signals[0].tag = "RED";
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/radar/runs",
          headers: h,
          payload: changed,
        })
      ).statusCode,
      409,
    );
    for (const sql of [
      "UPDATE radar_runs SET market_context='changed'",
      "DELETE FROM radar_signals",
      "TRUNCATE radar_runs CASCADE",
    ])
      await assert.rejects(pool.query(sql), /immutable/);
    assert.equal(
      (await pool.query("select count(*)::int n from radar_signals")).rows[0].n,
      1,
    );
    const invalid = structuredClone(fixture);
    invalid.run_key = "FIXTURE:invalid";
    invalid.signals[0].quote_at = invalid.cutoff_at;
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/radar/runs",
          headers: h,
          payload: invalid,
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (await pool.query("select count(*)::int n from radar_runs")).rows[0].n,
      1,
    );
    const a = await app.inject({ url: "/api/v1/radar/analytics", headers: h });
    assert.equal(a.statusCode, 200);
    assert.equal(a.json().overall.total, 0, "fixtures excluded by default");
    assert.equal(
      (
        await app.inject({
          url: "/api/v1/radar/signals?include_fixtures=true",
          headers: h,
        })
      ).json().items.length,
      1,
    );
    assert.equal(
      (await app.inject({ url: "/dashboard", headers: h })).statusCode,
      200,
    );
    const sessions = (await calendar("XNYS", fixture.cutoff_at))
      .filter((s) => s.session > "2026-01-02")
      .slice(0, 30);
    assert.equal(sessions[0].session, "2026-01-05", "weekend excluded");
    assert.ok(
      !sessions.some((s) => s.session === "2026-01-19"),
      "NYSE holiday excluded",
    );
    const prices = sessions.map((_, i) => 101 + i);
    const chart = {
      meta: { currency: "USD" },
      timestamp: sessions.map((s) => Date.parse(s.close_at) / 1000 - 21600),
      indicators: {
        quote: [
          {
            open: prices,
            close: prices,
            high: prices.map((v) => v + 1),
            low: prices.map((v) => v - 1),
          },
        ],
      },
      events: { splits: {} },
      fixture_notice: "EXPLICIT OHLC TEST FIXTURE NOT MARKET DATA",
    };
    await pool.query(
      "INSERT INTO market_fetches(symbol,interval,source,payload,payload_hash) VALUES($1,$2,$3,$4,$5)",
      [
        "TEST",
        "1d",
        "https://example.invalid/EXPLICIT-TEST-FIXTURE",
        chart,
        hash(chart),
      ],
    );
    const env = {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      RADAR_TRACK_FIXTURES: "1",
    };
    const worker = await promisify(execFile)("node", ["dist/worker.js"], {
      env,
      timeout: 30000,
    });
    assert.equal(JSON.parse(worker.stdout).processed, 1, worker.stdout);
    let perf = (
      await pool.query("SELECT metrics,status FROM signal_performance")
    ).rows[0];
    assert.equal(perf.status, "completed");
    assert.equal(perf.metrics.checkpoints["5"], 5);
    assert.equal(perf.metrics.checkpoints["30"], 30);
    assert.equal(perf.metrics.targets["9"].intraday_day, 8);
    assert.equal(perf.metrics.targets["9"].close_day, 9);
    assert.equal(
      (await pool.query("SELECT count(*)::int n FROM price_observations"))
        .rows[0].n,
      30,
    );
    await assert.rejects(
      pool.query("UPDATE price_observations SET price=1"),
      /immutable/,
    );
    await promisify(execFile)("node", ["dist/worker.js"], {
      env,
      timeout: 30000,
    });
    assert.equal(
      (await pool.query("SELECT count(*)::int n FROM price_observations"))
        .rows[0].n,
      30,
    );
    // Explicit fixtures only: a cent-normalized retry must use the frozen bar,
    // while a material revision must remain audited and quarantined.
    const frozen = (
      await pool.query(
        "SELECT row_to_json(o) AS row FROM price_observations o ORDER BY trading_days_since_signal",
      )
    ).rows;
    const precisionChart = structuredClone(chart);
    precisionChart.indicators.quote[0].high[0] = 102.001708984375;
    await pool.query(
      "INSERT INTO market_fetches(symbol,interval,source,payload,payload_hash) VALUES($1,$2,$3,$4,$5)",
      [
        "TEST",
        "1d",
        "https://example.invalid/EXPLICIT-PRECISION-FIXTURE",
        precisionChart,
        hash(precisionChart),
      ],
    );
    await pool.query("UPDATE signal_performance SET status='active'");
    const precisionWorker = await promisify(execFile)(
      "node",
      ["dist/worker.js"],
      {
        env,
        timeout: 30000,
      },
    );
    assert.equal(JSON.parse(precisionWorker.stdout).status, "ok");
    assert.equal(
      (await pool.query("SELECT count(*)::int n FROM data_conflicts")).rows[0]
        .n,
      0,
    );
    assert.deepEqual(
      (
        await pool.query(
          "SELECT row_to_json(o) AS row FROM price_observations o ORDER BY trading_days_since_signal",
        )
      ).rows,
      frozen,
      "precision retry cannot rewrite immutable observations",
    );

    const revisedChart = structuredClone(chart);
    revisedChart.indicators.quote[0].high[0] = 102.02;
    await pool.query(
      "INSERT INTO market_fetches(symbol,interval,source,payload,payload_hash) VALUES($1,$2,$3,$4,$5)",
      [
        "TEST",
        "1d",
        "https://example.invalid/EXPLICIT-MATERIAL-REVISION-FIXTURE",
        revisedChart,
        hash(revisedChart),
      ],
    );
    await pool.query("UPDATE signal_performance SET status='active'");
    await assert.rejects(
      promisify(execFile)("node", ["dist/worker.js"], {
        env,
        timeout: 30000,
      }),
      (e: any) =>
        e.code === 2 &&
        JSON.parse(e.stdout).errors[0].error.includes("quarantined"),
    );
    assert.equal(
      (await pool.query("SELECT status FROM signal_performance")).rows[0]
        .status,
      "quarantined",
    );
    assert.equal(
      (await pool.query("SELECT count(*)::int n FROM data_conflicts")).rows[0]
        .n,
      1,
    );
    assert.deepEqual(
      (
        await pool.query(
          "SELECT row_to_json(o) AS row FROM price_observations o ORDER BY trading_days_since_signal",
        )
      ).rows,
      frozen,
      "material revisions cannot rewrite immutable observations",
    );
    const splitChart = structuredClone(chart);
    splitChart.events.splits = {
      fixture: {
        date: Date.parse("2026-01-06T14:30:00Z") / 1000,
        numerator: 2,
        denominator: 1,
      },
    } as any;
    const splitFetch = (
      await pool.query(
        "INSERT INTO market_fetches(symbol,interval,source,payload,payload_hash) VALUES($1,$2,$3,$4,$5) RETURNING id",
        [
          "TEST",
          "1d",
          "https://example.invalid/EXPLICIT-SPLIT-FIXTURE",
          splitChart,
          hash(splitChart),
        ],
      )
    ).rows[0].id;
    const signalId = (await pool.query("SELECT id FROM radar_signals")).rows[0]
      .id;
    const approval = {
      signal_id: signalId,
      fetch_id: splitFetch,
      factor: 2,
      reason:
        "EXPLICIT SPLIT TEST FIXTURE ONLY; fixture normalized and verified",
      source: "https://example.invalid/EXPLICIT-SPLIT-FIXTURE",
      approved_by: "test-fixture-auditor",
      normalized_post_cutoff_ohlc_confirmed: true,
    };
    const audit = await promisify(execFile)(
      "node",
      ["dist/approve-split.js", JSON.stringify(approval)],
      { env, timeout: 15000 },
    );
    assert.equal(JSON.parse(audit.stdout).verified, true);
    await assert.rejects(
      pool.query("UPDATE split_audits SET factor=1"),
      /immutable/,
    );
    await assert.rejects(
      promisify(execFile)(
        "node",
        ["dist/approve-split.js", JSON.stringify({ ...approval, factor: 3 })],
        { env, timeout: 15000 },
      ),
      /Factor differs/,
    );
    // Read-only dashboard contracts on more than one full page. Explicit test
    // fixtures only, in the disposable database; never a historical live backfill.
    for (let batch = 0; batch < 3; batch++) {
      const sample = structuredClone(fixture);
      sample.run_key = `FIXTURE:dashboard-${batch}`;
      sample.signals = Array.from({ length: 25 }, (_, i) => ({
        ...fixture.signals[0],
        ticker: i === 0 ? "NVDA" : `TEST${batch}${String(i).padStart(2, "0")}`,
        market_symbol:
          i === 0 ? "NVDA" : `TEST${batch}${String(i).padStart(2, "0")}`,
        company: i === 0 ? "Nvidia TEST FIXTURE" : `Fixture ${batch}-${i}`,
      }));
      await ingest(pool, sample as any);
    }
    const get = async (path: string) => {
      const response = await app.inject({
        url: "/api/v1/radar/" + path,
        headers: h,
      });
      assert.equal(response.statusCode, 200, response.body);
      return response.json();
    };
    const all = await get("signals?include_fixtures=true&limit=500");
    assert.equal(all.total, 76);
    const page1 = await get("signals?include_fixtures=true&limit=50");
    const page2 = await get("signals?include_fixtures=true&limit=50&offset=50");
    assert.equal(page1.items.length, 50);
    assert.equal(page2.items.length, 26);
    assert.equal(
      new Set([...page1.items, ...page2.items].map((s: any) => s.id)).size,
      76,
    );
    for (const search of ["NVDA", "nvda", "Nvidia"]) {
      const found = await get(
        "signals?include_fixtures=true&limit=1&offset=1&search=" + search,
      );
      assert.equal(found.total, 3);
      assert.equal(found.items.length, 1);
      assert.equal(found.items[0].ticker, "NVDA");
      const analytics = await get(
        "analytics?include_fixtures=true&search=" + search + "&limit=1",
      );
      assert.equal(
        analytics.overall.total,
        3,
        "analytics uses complete search scope",
      );
    }
    assert.equal(
      (await get("signals?include_fixtures=true&search=%25")).total,
      0,
      "literal % is not a wildcard",
    );
    const selected = all.items.filter((s: any) => s.ticker === "NVDA");
    for (let i = 0; i < selected.length; i++) {
      await pool.query(
        "INSERT INTO signal_performance(signal_id,metrics,status) VALUES($1,$2,$3)",
        [
          selected[i].id,
          {
            current_return_pct: i === 2 ? 999 : i,
            checkpoints: { 5: null, 10: null, 20: null, 30: null },
            matured: false,
          },
          i === 2 ? "quarantined" : "active",
        ],
      );
    }
    for (const direction of ["asc", "desc"]) {
      const sorted = await get(
        "signals?include_fixtures=true&sort=return_" + direction + "&limit=500",
      );
      assert.deepEqual(
        sorted.items
          .slice(0, 2)
          .map((s: any) => s.performance.current_return_pct),
        direction === "asc" ? [0, 1] : [1, 0],
      );
      assert.ok(
        sorted.items
          .slice(2)
          .every(
            (s: any) =>
              s.tracking_status === "quarantined" ||
              s.performance?.current_return_pct == null,
          ),
        "null and quarantined measures last in both directions",
      );
      const again = await get(
        "signals?include_fixtures=true&sort=return_" + direction + "&limit=500",
      );
      assert.deepEqual(
        again.items.map((s: any) => s.id),
        sorted.items.map((s: any) => s.id),
        "stable ties",
      );
    }
    const eligible = await get(
      "signals?include_fixtures=true&eligible=true&search=nvda",
    );
    assert.equal(eligible.total, 2);
    const quarantined = await get(
      "analytics?include_fixtures=true&tracking=quarantined",
    );
    assert.equal(quarantined.overall.checkpoints[30].n, 0);
    assert.equal(quarantined.overall.checkpoints[30].mean, null);
    assert.equal(quarantined.tracking_counts.quarantined, 2);
    const native = await get("signals?include_fixtures=true&currency=EUR");
    assert.equal(native.total, 0);
    const detail = await get("signals/" + selected[0].id);
    assert.ok(Array.isArray(detail.observations));
    assert.ok(Array.isArray(detail.audits));
    assert.equal((await get("runs/" + selected[0].run_id)).run_type, "fixture");
    const status = await get("status");
    assert.equal(status.schedule, "unknown");
    assert.equal("errors" in status.last_worker, false);
    await app.close();
    await pool.end();
  },
);
