import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
const headers = { authorization: "Bearer read-test" };
function setup() {
  const calls: { sql: string; values: unknown[] }[] = [];
  const pool = {
    query: async (sql: string, values: unknown[] = []) => {
      calls.push({ sql, values: [...values] });
      if (sql.includes("count(*)")) return { rows: [{ n: "0" }] };
      return { rows: [] };
    },
  };
  return { calls, pool };
}
test("global search is parameterized, case insensitive and shared with analytics", async () => {
  const { pool, calls } = setup();
  const app = await buildApp(pool as any, {
    key: "write-test",
    readKey: "read-test",
  });
  try {
    for (const path of ["signals", "analytics"]) {
      assert.equal(
        (
          await app.inject({
            url:
              "/api/v1/radar/" +
              path +
              "?search=nvda&currency=USD&tracking=active&eligible=true",
            headers,
          })
        ).statusCode,
        200,
      );
    }
    const queries = calls.filter((c) => c.sql.includes("radar_signals"));
    assert.ok(
      queries.every((c) => c.sql.includes("ILIKE")),
      "search applies to all queries, not one page",
    );
    assert.ok(
      queries.every(
        (c) => c.sql.includes("s.company") && c.sql.includes("s.ticker"),
      ),
    );
    assert.ok(queries.every((c) => c.values.includes("%nvda%")));
    assert.ok(
      queries.every(
        (c) => c.values.includes("USD") && c.values.includes("active"),
      ),
    );
    assert.ok(queries.every((c) => !c.sql.includes("nvda")));
    assert.equal(
      (await app.inject({ url: "/api/v1/radar/analytics", headers })).json()
        .analysis_count,
      0,
    );
  } finally {
    await app.close();
  }
});
test("allowlisted deterministic sorting excludes quarantined measures and leaves nulls last", async () => {
  const { pool, calls } = setup();
  const app = await buildApp(pool as any, {
    key: "write-test",
    readKey: "read-test",
  });
  try {
    assert.equal(
      (
        await app.inject({
          url: "/api/v1/radar/signals?sort=return_asc",
          headers,
        })
      ).statusCode,
      200,
    );
    const sql = calls.at(-1)!.sql;
    assert.match(sql, /CASE WHEN/);
    assert.match(sql, /quarantined/);
    assert.match(sql, /NULLS LAST/);
    assert.match(sql, /s.id/);
    assert.equal(
      (await app.inject({ url: "/api/v1/radar/signals?sort=DROP", headers }))
        .statusCode,
      400,
    );
    assert.equal(
      (
        await app.inject({
          url: "/api/v1/radar/signals?from=2026-10-10&to=2026-10-01",
          headers,
        })
      ).statusCode,
      400,
    );
  } finally {
    await app.close();
  }
});
test("dashboard direct routes remain authenticated with semantic reading views", async () => {
  const { pool } = setup();
  const app = await buildApp(pool as any, {
    key: "write-test",
    readKey: "read-test",
  });
  try {
    assert.equal(
      (
        await app.inject(
          "/dashboard/signaux/351290f9-6a42-49c4-9279-5e20c9474e3b",
        )
      ).statusCode,
      401,
    );
    for (const path of [
      "/dashboard",
      "/dashboard/bilan",
      "/dashboard/methode",
      "/dashboard/signaux/351290f9-6a42-49c4-9279-5e20c9474e3b",
    ]) {
      const r = await app.inject({ url: path, headers });
      assert.equal(r.statusCode, 200);
      assert.match(r.body, /Journal de recherche/);
      assert.match(r.body, /id="root"/);
      assert.match(r.body, /<style>/);
      assert.equal(r.headers["cache-control"], "no-store");
    }
    assert.equal(
      (
        await app.inject({
          url: "/api/v1/radar/runs/351290f9-6a42-49c4-9279-5e20c9474e3b",
          headers,
        })
      ).statusCode,
      404,
    );
    const r = await app.inject({ url: "/api/v1/radar/status", headers });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().schedule, "unknown");
    assert.equal("errors" in (r.json().last_worker ?? {}), false);
  } finally {
    await app.close();
  }
});
