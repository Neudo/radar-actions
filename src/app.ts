import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { timingSafeEqual } from "node:crypto";
import pg from "pg";
import { z } from "zod";
import { validateRun, aggregate, tags, watchlist } from "./core.js";
import { ingest, Conflict } from "./db.js";
const equal = (a: string, b: string) => {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const qs = z.object({
  tag: z.enum(tags).optional(),
  ticker: z.string().max(20).optional(),
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
  const q = qs.parse(input),
    values: any[] = [],
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
const select =
  "SELECT s.*,r.run_date,r.cutoff_at,r.run_type,p.metrics AS performance,p.status AS tracking_status,p.error AS tracking_error";
const dashboard = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Investment Radar — Forward Test</title><style>body{font:16px system-ui;margin:2rem;max-width:1400px;background:#101827;color:#e5edf8}table{border-collapse:collapse;width:100%;margin:1em 0}td,th{padding:.5rem;border-bottom:1px solid #46516b;text-align:left}input,select,button{padding:.5rem;margin:.25rem}pre{white-space:pre-wrap}.warning{color:#ffc978}</style></head><body><h1>Investment Radar — expérimentation</h1><p class="warning">Aucun ordre, aucune recommandation. Rendements bruts en devise native. Seuls les échantillons arrivés à maturité entrent dans les taux à 30 séances. Drawdown exact en clôture ; bornes intrajournalières OHLC.</p><div id="overview"></div><h2>Comparaison par tag</h2><div id="tags"></div><h2>Historique / signaux actifs</h2><form id="filter"><select name="tag"><option value="">Tous tags</option><option>RED</option><option>ORANGE</option><option>GREEN</option><option>DOUBLE_GREEN</option></select><input name="ticker" placeholder="Ticker"><input name="sector" placeholder="Secteur"><input name="catalyst_type" placeholder="Catalyseur"><input name="from" type="date"><input name="to" type="date"><label><input name="active" type="checkbox" value="true">Actifs seuls</label><button>Filtrer</button></form><div id="rows"></div><button id="prev">Précédent</button><button id="next">Suivant</button><pre id="detail"></pre><script src="/dashboard.js"></script></body></html>`;
const dashboardJS = `const f=v=>v==null?'—':typeof v==='number'?v.toFixed(2):String(v);function table(root,head,rows){root.replaceChildren();let t=document.createElement('table'),h=t.insertRow();head.forEach(x=>{let c=document.createElement('th');c.textContent=x;h.append(c)});rows.forEach(row=>{let r=t.insertRow();row.forEach(v=>{let c=r.insertCell();if(v instanceof Node)c.append(v);else c.textContent=f(v)})});root.append(t)}let offset=0;async function load(){let params=new URLSearchParams;for(let [k,v]of new FormData(document.querySelector('#filter')))if(v)params.set(k,v);params.set('offset',offset);params.set('limit',50);let [a,s,r]=await Promise.all(['/api/v1/radar/analytics?'+params,'/api/v1/radar/signals?'+params,'/api/v1/radar/runs?limit=1'].map(u=>fetch(u).then(r=>{if(!r.ok)throw Error(r.status);return r.json()})));document.querySelector('#overview').textContent='Runs: '+r.total+' | Signaux filtrés: '+s.total+' | Matures J30: '+a.overall.matured+' | +9% intraday: '+f(a.overall.target_rates['9'].intraday_pct)+'% | Moyenne J30: '+f(a.overall.checkpoints['30'].mean)+'% | Médiane J30: '+f(a.overall.checkpoints['30'].median)+'% | Drawdown clôture moyen: '+f(a.overall.drawdown.mean)+'%';table(document.querySelector('#tags'),['Tag','Total','Matures','Backlog','Moy J5','Moy J10','Moy J20','Moy J30','Méd J30','+9% haut','+9% clôture','DD moy'],Object.entries(a.by_tag).map(([k,v])=>[k,v.total,v.matured,v.backlog,...[5,10,20,30].map(n=>v.checkpoints[n].mean),v.checkpoints[30].median,v.target_rates[9].intraday_pct,v.target_rates[9].close_pct,v.drawdown.mean]));table(document.querySelector('#rows'),['Détail','Tag','Date','Devise','Entrée','Dernière clôture','Perf %','Max gain %','DD clôture %','Séances restantes','Données'],s.items.map(x=>{let b=document.createElement('button');b.textContent=x.ticker;b.onclick=()=>{document.querySelector('#detail').textContent=JSON.stringify(x,null,2)};return [b,x.tag,x.run_date.slice(0,10),x.currency,x.signal_price,x.performance?.current_price,x.performance?.current_return_pct,x.performance?.max_gain_pct,x.performance?.close_drawdown_pct,x.performance?.sessions_remaining??30,x.tracking_status??x.data_status]}));document.querySelector('#next').disabled=offset+50>=s.total;document.querySelector('#prev').disabled=offset===0;}document.querySelector('#filter').onsubmit=e=>{e.preventDefault();offset=0;load().catch(alert)};document.querySelector('#next').onclick=()=>{offset+=50;load().catch(alert)};document.querySelector('#prev').onclick=()=>{offset=Math.max(0,offset-50);load().catch(alert)};load().catch(alert);`;
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
      return reply
        .code(400)
        .send({
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
            "SELECT started_at,finished_at,status,processed,errors FROM worker_runs ORDER BY started_at DESC LIMIT 1",
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
            ` ORDER BY r.run_date DESC,s.ticker LIMIT $${values.length - 1} OFFSET $${values.length}`,
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
      observations: (
        await pool.query(
          "SELECT * FROM price_observations WHERE signal_id=$1 ORDER BY trading_days_since_signal",
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
        "SELECT s.tag,s.currency,p.metrics performance,p.status" + join + where,
        values,
      )
    ).rows;
    const normalized = rows.map((r) => ({
      ...r,
      performance: ["missing", "quarantined"].includes(r.status)
        ? null
        : r.performance,
    }));
    return {
      ...aggregate(normalized),
      by_currency: Object.fromEntries(
        ["USD", "EUR"].map((c) => [
          c,
          aggregate(normalized.filter((r) => r.currency === c)),
        ]),
      ),
    };
  });
  app.get("/dashboard", async (req, reply) =>
    reply.type("text/html; charset=utf-8").send(dashboard),
  );
  app.get("/dashboard.js", async (req, reply) =>
    reply.type("application/javascript; charset=utf-8").send(dashboardJS),
  );
  return app;
}
