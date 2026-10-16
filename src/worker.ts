import pg from "pg";
import { calculate, hash } from "./core.js";
import { observations } from "./db.js";
import {
  calendar,
  centPrecisionEquivalent,
  fetchChart,
  selectBars,
  splitEvents,
} from "./market.js";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const lock = await pool.connect();
let runId: string | undefined;
let errors: any[] = [];
let processed = 0;
try {
  if (
    !(await lock.query("SELECT pg_try_advisory_lock(74209917) ok")).rows[0].ok
  ) {
    console.log(JSON.stringify({ status: "skipped", reason: "worker locked" }));
  } else {
    runId = (
      await pool.query("INSERT INTO worker_runs DEFAULT VALUES RETURNING id")
    ).rows[0].id;
    const fixtureMode = process.env.RADAR_TRACK_FIXTURES === "1";
    if (
      fixtureMode &&
      !new URL(process.env.DATABASE_URL!).pathname.startsWith("/radar_test_")
    )
      throw Error("Fixture worker forbidden outside isolated test DB");
    const signals = (
      await pool.query(
        `SELECT s.*,r.cutoff_at FROM radar_signals s JOIN radar_runs r ON r.id=s.run_id LEFT JOIN signal_performance p ON p.signal_id=s.id WHERE r.run_type=$1 AND s.signal_price IS NOT NULL AND COALESCE(p.status,'pending')!='completed' ORDER BY p.calculated_at NULLS FIRST,r.cutoff_at,s.id LIMIT 50`,
        [fixtureMode ? "fixture" : "live"],
      )
    ).rows;
    for (const s of signals) {
      try {
        const cutoff = new Date(s.cutoff_at).toISOString();
        const f = await fetchChart(s.market_symbol, "1d", pool);
        const events = splitEvents(f.chart, cutoff);
        const audit = events.length
          ? (
              await pool.query(
                "SELECT id,event_hash,factor FROM split_audits WHERE signal_id=$1 AND event_hash=$2",
                [s.id, hash(events)],
              )
            ).rows[0]
          : null;
        const sessions = await calendar(s.exchange, cutoff);
        const bs = selectBars(
          f.chart,
          sessions,
          cutoff,
          s.currency,
          Date.now(),
          audit
            ? { event_hash: audit.event_hash, factor: Number(audit.factor) }
            : undefined,
        );
        let conflict = false;
        for (const b of bs) {
          const numeric = {
            session: b.session,
            n: b.n,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
          };
          const h = hash(numeric);
          const old = (
            await pool.query(
              "SELECT payload_hash,ohlc FROM price_observations WHERE signal_id=$1 AND session=$2",
              [s.id, b.session],
            )
          ).rows[0];
          if (old) {
            if (
              old.payload_hash !== h &&
              !centPrecisionEquivalent(old.ohlc, b, s.currency)
            ) {
              conflict = true;
              await pool.query(
                "INSERT INTO data_conflicts(signal_id,session,existing_hash,new_hash,fetch_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
                [s.id, b.session, old.payload_hash, h, f.id],
              );
            }
            continue;
          }
          await pool.query(
            "INSERT INTO price_observations(signal_id,session,trading_days_since_signal,observed_at,price,performance_pct,ohlc,fetch_id,split_audit_id,payload_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING",
            [
              s.id,
              b.session,
              b.n,
              b.observed_at,
              b.close,
              (b.close / Number(s.signal_price) - 1) * 100,
              b,
              f.id,
              audit?.id ?? null,
              h,
            ],
          );
        }
        if (conflict)
          throw Error("Provider revised frozen observation; quarantined");
        const metrics = calculate(
          Number(s.signal_price),
          await observations(pool, s.id),
        );
        const due = sessions
          .filter(
            (x) =>
              Date.parse(x.close_at) + 3600000 <= Date.now() &&
              x.session >
                new Intl.DateTimeFormat("en-CA", {
                  timeZone:
                    s.currency === "EUR" ? "Europe/Paris" : "America/New_York",
                }).format(new Date(cutoff)),
          )
          .slice(0, 30).length;
        const status =
          metrics.sessions === 30
            ? "completed"
            : metrics.sessions < due
              ? "missing"
              : "active";
        await pool.query(
          "INSERT INTO signal_performance(signal_id,metrics,status,error) VALUES($1,$2,$3,$4) ON CONFLICT(signal_id) DO UPDATE SET metrics=excluded.metrics,status=excluded.status,error=excluded.error,calculated_at=now()",
          [
            s.id,
            metrics,
            status,
            status === "missing" ? "Missing closed trading session" : null,
          ],
        );
        if (status === "missing")
          errors.push({
            signal_id: s.id,
            error: "Missing closed trading session",
          });
        processed++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "worker error";
        errors.push({ signal_id: s.id, error: msg });
        const metrics = calculate(
          Number(s.signal_price),
          await observations(pool, s.id),
        );
        await pool.query(
          "INSERT INTO signal_performance(signal_id,metrics,status,error) VALUES($1,$2,$3,$4) ON CONFLICT(signal_id) DO UPDATE SET status=excluded.status,error=excluded.error,calculated_at=now()",
          [s.id, metrics, "quarantined", msg],
        );
      }
    }
    await pool.query(
      "UPDATE worker_runs SET finished_at=now(),status=$2,processed=$3,errors=$4 WHERE id=$1",
      [
        runId,
        errors.length ? "degraded" : "ok",
        processed,
        JSON.stringify(errors),
      ],
    );
    console.log(
      JSON.stringify({
        id: runId,
        status: errors.length ? "degraded" : "ok",
        processed,
        errors,
      }),
    );
    if (errors.length) process.exitCode = 2;
  }
} catch (e) {
  console.error("Worker failed", e instanceof Error ? e.message : "unknown");
  process.exitCode = 1;
  if (runId)
    await pool.query(
      "UPDATE worker_runs SET finished_at=now(),status='failed',errors=$2 WHERE id=$1",
      [runId, JSON.stringify([{ error: "worker failed" }])],
    );
} finally {
  await lock.query("SELECT pg_advisory_unlock(74209917)");
  lock.release();
  await pool.end();
}
