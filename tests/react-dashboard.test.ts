import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
const headers = { authorization: "Bearer read-test" };
test("React build is authenticated and preserves inline-style CSP without unsafe scripts", async () => {
  const app = await buildApp({ query: async () => ({ rows: [] }) } as any, {
    key: "write-test",
    readKey: "read-test",
  });
  try {
    const r = await app.inject({ url: "/dashboard", headers });
    assert.match(r.body, /id="root"/);
    assert.match(r.body, /<style>/);
    assert.doesNotMatch(r.body, /<link[^>]+stylesheet/);
    const asset = r.body.match(/src="(\/dashboard-app\/assets\/[^"]+\.js)"/);
    assert.ok(asset);
    assert.equal((await app.inject(asset[1])).statusCode, 401);
    const js = await app.inject({ url: asset[1], headers });
    assert.equal(js.statusCode, 200);
    assert.match(String(js.headers["content-type"]), /javascript/);
    assert.equal(
      (await app.inject({ url: "/dashboard-app/assets/missing.js", headers }))
        .statusCode,
      404,
    );
    assert.equal(
      r.headers["content-security-policy"],
      "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'",
    );
  } finally {
    await app.close();
  }
});
test("detail observations retain every row and add fetch provenance read-only", async () => {
  const calls: string[] = [];
  const app = await buildApp(
    {
      query: async (sql: string) => {
        calls.push(sql);
        return {
          rows: sql.includes("WHERE s.id")
            ? [{ id: "351290f9-6a42-49c4-9279-5e20c9474e3b" }]
            : [],
        };
      },
    } as any,
    { key: "write-test", readKey: "read-test" },
  );
  try {
    const r = await app.inject({
      url: "/api/v1/radar/signals/351290f9-6a42-49c4-9279-5e20c9474e3b",
      headers,
    });
    assert.equal(r.statusCode, 200);
    assert.ok(
      calls.some(
        (s) =>
          s.includes("LEFT JOIN market_fetches") &&
          s.includes("f.source") &&
          s.includes("f.fetched_at"),
      ),
    );
    assert.ok(calls.every((s) => s.startsWith("SELECT")));
  } finally {
    await app.close();
  }
});
