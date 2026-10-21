import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { timingSafeEqual } from "node:crypto";
import pg from "pg";
import { z } from "zod";
import { validateRun, aggregate, tags, watchlist } from "./core.js";
import { ingest, Conflict } from "./db.js";
import { eligibleSQL, measurementPolicy } from "./measurement.js";
import { dashboard, dashboardAssets } from "./dashboard.js";
const equal = (a: string, b: string) => {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const qs = z.object({
  tag: z.enum(tags).optional(),
  ticker: z.string().max(20).optional(),
  search: z.string().trim().max(100).optional(),
  currency: z.enum(["EUR", "USD"]).optional(),
  tracking: z
    .enum([
      "pending",
      "pending_data",
      "active",
      "missing",
      "quarantined",
      "completed",
    ])
    .optional(),
  eligible: z.enum(["true", "false"]).optional(),
  sort: z
    .enum([
      "date_desc",
      "date_asc",
      "company_asc",
      "tag_desc",
      "return_desc",
      "return_asc",
      "j30_desc",
      "j30_asc",
    ])
    .default("date_desc"),
  sector: z.string().max(100).optional(),
  catalyst_type: z.string().max(100).optional(),
  exchange: z.enum(["XNAS", "XNYS", "XPAR"]).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  active: z.enum(["true", "false"]).optional(),
  include_fixtures: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
});
function filter(input: unknown) {
  const q = qs.parse(input);
  if (q.from && q.to && q.from > q.to)
    throw new z.ZodError([
      {
        code: "custom",
        path: ["to"],
        message: "La date Au doit suivre la date Du",
      },
    ]);
  const values: any[] = [],
    where: string[] = [];
  const add = (sql: string, v: any) => {
    values.push(v);
    where.push(sql.replace("?", `$${values.length}`));
  };
  if (q.include_fixtures !== "true") where.push("r.run_type='live'");
  for (const k of [
    "tag",
    "ticker",
    "sector",
    "catalyst_type",
    "exchange",
  ] as const)
    if (q[k]) add(`s.${k}=?`, q[k]);
  if (q.search) {
    // Literal substring matching: user wildcard characters are not SQL patterns.
    values.push("%" + q.search.replace(/[\\%_]/g, "\\$&") + "%");
    where.push(
      `(s.ticker ILIKE $${values.length} OR s.company ILIKE $${values.length})`,
    );
  }
  if (q.currency) add("s.currency=?", q.currency);
  if (q.tracking) add("COALESCE(p.status,'pending')=?", q.tracking);
  if (q.eligible === "true") where.push(eligibleSQL);
  if (q.eligible === "false") where.push(`NOT (${eligibleSQL})`);
  if (q.from) add("r.run_date>=?", q.from);
  if (q.to) add("r.run_date<=?", q.to);
  if (q.active === "true")
    where.push("COALESCE(p.status,'pending')!='completed'");
  return {
    q,
    values,
    where: where.length ? "WHERE " + where.join(" AND ") : "",
  };
}
const join =
  " FROM radar_signals s JOIN radar_runs r ON r.id=s.run_id LEFT JOIN signal_performance p ON p.signal_id=s.id ";
const select = `SELECT s.*,r.run_date,r.cutoff_at,r.run_type,CASE WHEN ${eligibleSQL} THEN p.metrics END AS performance,p.status AS tracking_status,p.error AS tracking_error,p.metrics->'collection' AS collection,(${eligibleSQL}) AS measurement_eligible,'${measurementPolicy}' AS measurement_policy,(SELECT max(o.observed_at) FROM price_observations o WHERE o.signal_id=s.id) AS last_observed_at`;
function orderBy(sort: string) {
  const stable = ",s.ticker ASC,s.id ASC";
  const metric = (field: string, direction: string) =>
    `CASE WHEN ${eligibleSQL} THEN (${field})::numeric END ${direction} NULLS LAST` +
    stable;
  switch (sort) {
    case "date_asc":
      return "r.run_date ASC" + stable;
    case "company_asc":
      return "lower(s.company) ASC,r.run_date DESC" + stable;
    case "tag_desc":
      return (
        "CASE s.tag WHEN 'DOUBLE_GREEN' THEN 4 WHEN 'GREEN' THEN 3 WHEN 'ORANGE' THEN 2 ELSE 1 END DESC,r.run_date DESC" +
        stable
      );
    case "return_asc":
      return metric("p.metrics->>'current_return_pct'", "ASC");
    case "return_desc":
      return metric("p.metrics->>'current_return_pct'", "DESC");
    case "j30_asc":
      return metric("p.metrics->'checkpoints'->>'30'", "ASC");
    case "j30_desc":
      return metric("p.metrics->'checkpoints'->>'30'", "DESC");
    default:
      return "r.run_date DESC" + stable;
  }
}
export async function buildApp(
  pool: pg.Pool,
  opts: { key: string; readKey?: string; allowFixtures?: boolean },
) {
  if (!opts.key) throw Error("API key required");
  const app = Fastify({
    bodyLimit: 1048576,
    logger:
      process.env.NODE_ENV === "test"
        ? false
        : { redact: ["req.headers.authorization"] },
    trustProxy: false,
  });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  app.addHook("onRequest", async (req, reply) => {
    if (req.url === "/health") return;
    const auth = req.headers.authorization ?? "";
    let ok = false;
    if (auth.startsWith("Bearer "))
      ok =
        equal(auth.slice(7), opts.key) ||
        (req.method === "GET" &&
          !!opts.readKey &&
          equal(auth.slice(7), opts.readKey));
    if (req.method === "GET" && opts.readKey && auth.startsWith("Basic ")) {
      const s = Buffer.from(auth.slice(6), "base64").toString();
      ok = equal(s, "radar:" + opts.readKey);
    }
    if (!ok) {
      if (req.url.startsWith("/dashboard"))
        reply.header("www-authenticate", 'Basic realm="Investment Radar"');
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });
  app.addHook("onSend", async (req, reply, payload) => {
    reply
      .header("cache-control", "no-store")
      .header("x-content-type-options", "nosniff")
      .header("referrer-policy", "no-referrer")
      .header(
        "content-security-policy",
        "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'",
      );
    return payload;
  });
  app.setErrorHandler((e: any, req, reply) => {
    if (e instanceof Conflict || e.code === "23505")
      return reply.code(409).send({ error: "Immutable conflict" });
    if (e instanceof z.ZodError)
      return reply.code(400).send({
        error: "Invalid payload",
        issues: e.issues.map((i) => ({ path: i.path, message: i.message })),
      });
    if (e.statusCode && e.statusCode < 500)
      return reply.code(e.statusCode).send({ error: e.message });
    req.log.error({ name: e.name, code: e.code }, "Request failed");
    return reply.code(500).send({ error: "Internal server error" });
  });
  app.get("/health", async (req, reply) => {
    try {
      await pool.query("SELECT 1");
      const w =
        (
          await pool.query(
            "SELECT started_at,finished_at,status,processed,errors,summary FROM worker_runs ORDER BY started_at DESC LIMIT 1",
          )
        ).rows[0] ?? null;
      return {
        status: "ok",
        database: "ok",
        last_worker: w,
        worker_stale:
          !w?.finished_at ||
          Date.now() - new Date(w.finished_at).getTime() > 36 * 3600000,
      };
    } catch {
      return reply.code(503).send({ status: "error", database: "unavailable" });
    }
  });
  app.post("/api/v1/radar/runs", async (req, reply) => {
    let run;
    try {
      run = validateRun(req.body);
      if (run.run_type === "fixture" && !opts.allowFixtures)
        return reply
          .code(400)
          .send({ error: "Fixtures forbidden on production API" });
    } catch (e) {
      if (e instanceof z.ZodError) throw e;
      return reply
        .code(400)
        .send({ error: e instanceof Error ? e.message : "Invalid payload" });
    }
    const result = await ingest(pool, run);
    return reply.code(result.created ? 201 : 200).send(result);
  });
  app.get("/api/v1/radar/watchlist", async () => watchlist);
  app.get("/api/v1/radar/runs", async (req) => {
    const q = z
      .object({
        run_key: z.string().max(100).optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
        offset: z.coerce.number().int().min(0).default(0),
        include_fixtures: z.enum(["true", "false"]).optional(),
      })
      .parse(req.query);
    const values: any[] = [];
    let where = q.include_fixtures === "true" ? "TRUE" : "run_type='live'";
    if (q.run_key) {
      values.push(q.run_key);
      where += " AND run_key=$1";
    }
    const total = Number(
      (
        await pool.query(
          "SELECT count(*) n FROM radar_runs WHERE " + where,
          values,
        )
      ).rows[0].n,
    );
    values.push(q.limit, q.offset);
    return {
      total,
      items: (
        await pool.query(
          `SELECT * FROM radar_runs WHERE ${where} ORDER BY run_date DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
          values,
        )
      ).rows,
    };
  });
  app.get("/api/v1/radar/runs/:id", async (req, reply) => {
    const id = z.uuid().parse((req.params as any).id);
    const run = (await pool.query("SELECT * FROM radar_runs WHERE id=$1", [id]))
      .rows[0];
    return run ?? reply.code(404).send({ error: "Not found" });
  });
  app.get("/api/v1/radar/signals", async (req) => {
    const { q, values, where } = filter(req.query);
    const total = Number(
      (await pool.query("SELECT count(*) n" + join + where, values)).rows[0].n,
    );
    values.push(q.limit, q.offset);
    return {
      total,
      items: (
        await pool.query(
          select +
            join +
            where +
            ` ORDER BY ${orderBy(q.sort)} LIMIT $${values.length - 1} OFFSET $${values.length}`,
          values,
        )
      ).rows,
    };
  });
  app.get("/api/v1/radar/signals/:id", async (req, reply) => {
    const id = z.uuid().parse((req.params as any).id);
    const s = (await pool.query(select + join + "WHERE s.id=$1", [id])).rows[0];
    if (!s) return reply.code(404).send({ error: "Not found" });
    return {
      ...s,
      source_data: {
        policy: measurementPolicy,
        accepted_view: "original frozen observations only",
        eligible: s.measurement_eligible,
        exclusion_reason: s.measurement_eligible
          ? null
          : (s.tracking_error ?? "Baseline or assessment not eligible"),
        unresolved_revisions: "No revised price is automatically accepted",
      },
      revisions: (
        await pool.query(
          "SELECT pr.*,f.source,f.fetched_at FROM price_revisions pr JOIN market_fetches f ON f.id=pr.fetch_id WHERE pr.signal_id=$1 ORDER BY pr.session,pr.created_at,pr.id",
          [id],
        )
      ).rows,
      conflicts: (
        await pool.query(
          "SELECT * FROM data_conflicts WHERE signal_id=$1 ORDER BY created_at,id",
          [id],
        )
      ).rows,
      observations: (
        await pool.query(
          "SELECT o.*,f.source,f.fetched_at FROM price_observations o LEFT JOIN market_fetches f ON f.id=o.fetch_id WHERE o.signal_id=$1 ORDER BY o.trading_days_since_signal",
          [id],
        )
      ).rows,
      audits: (
        await pool.query("SELECT * FROM split_audits WHERE signal_id=$1", [id])
      ).rows,
    };
  });
  app.get("/api/v1/radar/analytics", async (req) => {
    const { values, where } = filter(req.query);
    const rows = (
      await pool.query(
        `SELECT s.run_id,s.tag,s.currency,s.data_status,s.payload->>'assessment_status' AS assessment_status,p.metrics performance,p.status,(${eligibleSQL}) AS measurement_eligible` +
          join +
          where,
        values,
      )
    ).rows;
    const normalized = rows.map((r) => ({
      ...r,
      performance:
        r.measurement_eligible === false ||
        ["missing", "quarantined", "pending_data"].includes(r.status) ||
        r.data_status === "missing" ||
        r.assessment_status === "unknown"
          ? null
          : r.performance,
    }));
    return {
      ...aggregate(normalized),
      measurement_policy: measurementPolicy,
      measurement_counts: {
        eligible: rows.filter(
          (r) =>
            r.measurement_eligible !== false &&
            !["missing", "quarantined", "pending_data"].includes(r.status) &&
            r.data_status !== "missing" &&
            r.assessment_status !== "unknown",
        ).length,
        excluded: rows.filter(
          (r) =>
            r.measurement_eligible === false ||
            ["missing", "quarantined", "pending_data"].includes(r.status) ||
            r.data_status === "missing" ||
            r.assessment_status === "unknown",
        ).length,
      },
      analysis_count: new Set(rows.map((r) => r.run_id)).size,
      tracking_counts: Object.fromEntries(
        [
          "pending",
          "pending_data",
          "active",
          "missing",
          "quarantined",
          "completed",
        ].map((status) => [
          status,
          rows.filter((r) => (r.status ?? "pending") === status).length,
        ]),
      ),
      by_currency: Object.fromEntries(
        ["USD", "EUR"].map((c) => [
          c,
          aggregate(normalized.filter((r) => r.currency === c)),
        ]),
      ),
    };
  });
  app.get("/api/v1/radar/status", async () => {
    await pool.query("SELECT 1");
    const w =
      (
        await pool.query(
          "SELECT started_at,finished_at,status,summary FROM worker_runs ORDER BY started_at DESC LIMIT 1",
        )
      ).rows[0] ?? null;
    const dates =
      (
        await pool.query(
          "SELECT (SELECT max(run_date) FROM radar_runs WHERE run_type='live') AS last_analysis,(SELECT max(observed_at) FROM price_observations o JOIN radar_signals s ON s.id=o.signal_id JOIN radar_runs r ON r.id=s.run_id WHERE r.run_type='live') AS last_observation",
        )
      ).rows[0] ?? {};
    return {
      database: "ok",
      schedule: "unknown",
      last_worker: w,
      worker_stale:
        !w?.finished_at ||
        Date.now() - new Date(w.finished_at).getTime() > 36 * 3600000,
      ...dates,
    };
  });
  app.get("/api/v1/radar/filter-options", async () => {
    const rows = (
      await pool.query(
        "SELECT DISTINCT s.sector,s.catalyst_type,s.exchange,s.currency FROM radar_signals s JOIN radar_runs r ON r.id=s.run_id WHERE r.run_type='live'",
      )
    ).rows;
    return Object.fromEntries(
      ["sector", "catalyst_type", "exchange", "currency"].map((k) => [
        k,
        [...new Set(rows.map((r) => r[k]))].sort(),
      ]),
    );
  });
  for (const path of [
    "/dashboard/bilan",
    "/dashboard/methode",
    "/dashboard/signaux/:id",
  ])
    app.get(path, async (req, reply) =>
      reply.type("text/html; charset=utf-8").send(dashboard),
    );
  app.get("/dashboard-app/assets/:name", async (req, reply) => {
    const asset = dashboardAssets.get((req.params as { name: string }).name);
    if (!asset) return reply.code(404).send({ error: "Not found" });
    return reply.type(asset.type).send(asset.body);
  });
  app.get("/dashboard", async (req, reply) =>
    reply.type("text/html; charset=utf-8").send(dashboard),
  );

  return app;
}
