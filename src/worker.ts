import pg from "pg";
import { pathToFileURL } from "node:url";
import { Bar, calculate, hash } from "./core.js";
import { observations } from "./db.js";
import {
  calendar,
  centPrecisionEquivalent,
  fetchChart,
  selectBars,
  splitEvents,
} from "./market.js";
import {
  eligibleSQL,
  measurementPolicy,
  unresolvedSQL,
} from "./measurement.js";

type DB = Pick<pg.Pool, "query">;
type Dependencies = {
  fixtureMode?: boolean;
  now?: () => number;
  calendar?: typeof calendar;
  fetchChart?: (
    symbol: string,
    interval: string,
    pool: pg.Pool,
  ) => Promise<{ id: string | null; chart: any; cache: boolean }>;
};
class ExpectedIssue extends Error {
  constructor(
    public kind: "split" | "missing",
    public evidence: any,
    message: string,
  ) {
    super(message);
  }
}
const numeric = (b: Bar) => ({
  session: b.session,
  n: b.n,
  open: b.open,
  high: b.high,
  low: b.low,
  close: b.close,
});
function identity(chart: any, s: any, fixture: boolean) {
  if (chart.meta?.currency !== s.currency) throw Error("Currency mismatch");
  if (
    (!fixture || chart.meta?.symbol !== undefined) &&
    chart.meta?.symbol !== s.market_symbol
  )
    throw Error("Listing symbol mismatch");
  const venues: Record<string, string[]> = {
    XNAS: ["NMS", "NGM", "NCM"],
    XNYS: ["NYQ"],
    XPAR: ["PAR"],
  };
  if (
    (!fixture || chart.meta?.exchangeName !== undefined) &&
    !venues[s.exchange]?.includes(chart.meta?.exchangeName)
  )
    throw Error("Listing exchange mismatch");
}
async function revision(
  db: DB,
  s: any,
  old: any,
  b: Bar | null,
  newHash: string,
  fetchId: string,
  chart: any,
  fixture: boolean,
  legacy = false,
) {
  let sameUnits = false;
  try {
    identity(chart, s, fixture);
    sameUnits = !splitEvents(chart, new Date(s.cutoff_at).toISOString()).length;
  } catch {
    /* unresolved legacy evidence remains ambiguous */
  }
  const precision =
    !!b && sameUnits && centPrecisionEquivalent(old.ohlc, b, s.currency);
  const classification = precision
    ? "cent_precision"
    : b && sameUnits
      ? "material"
      : "ambiguous";
  await db.query(
    `INSERT INTO price_revisions(observation_id,signal_id,session,existing_hash,new_hash,fetch_id,ohlc,classification,decision,policy,provenance)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
    [
      old.id,
      s.id,
      old.ohlc.session,
      old.payload_hash,
      newHash,
      fetchId,
      b,
      classification,
      precision ? "retain_frozen" : "exclude",
      measurementPolicy,
      {
        legacy,
        source_symbol: chart.meta?.symbol ?? null,
        currency: chart.meta?.currency ?? null,
        exchange: chart.meta?.exchangeName ?? null,
        events: chart.events ?? {},
        same_units_verified: sameUnits,
        reason: precision
          ? "Strict existing cent-equivalence; calculate only frozen bar"
          : "Unresolved provider revision; no correction authorized",
      },
    ],
  );
  if (precision) return false;
  const added = await db.query(
    "INSERT INTO data_conflicts(signal_id,session,existing_hash,new_hash,fetch_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id",
    [s.id, old.ohlc.session, old.payload_hash, newHash, fetchId],
  );
  return !!added.rowCount;
}
// Classify old conflicts from their ACTUAL archived fetch, not today's reverted feed.
// Inability to reproduce the original numeric hash is itself ambiguous evidence.
async function legacyRevisions(db: DB, s: any, fixture: boolean) {
  const rows = (
    await db.query(
      `SELECT c.new_hash,c.fetch_id,o.id,o.payload_hash,o.ohlc,f.payload
 FROM data_conflicts c JOIN price_observations o ON o.signal_id=c.signal_id AND o.session=c.session
 JOIN market_fetches f ON f.id=c.fetch_id LEFT JOIN price_revisions pr ON pr.observation_id=o.id AND pr.new_hash=c.new_hash
 WHERE c.signal_id=$1 AND pr.id IS NULL`,
      [s.id],
    )
  ).rows;
  for (const r of rows) {
    const i = (r.payload.timestamp ?? []).findIndex(
      (t: number) =>
        new Date(t * 1000).toISOString().slice(0, 10) === r.ohlc.session,
    );
    const q = r.payload.indicators?.quote?.[0];
    let b: Bar | null = null;
    if (i >= 0 && q) {
      const candidate = {
        ...r.ohlc,
        ...Object.fromEntries(
          ["open", "high", "low", "close"].map((k) => [k, q[k]?.[i]]),
        ),
      };
      if (
        ["open", "high", "low", "close"].every(
          (k) => Number.isFinite(candidate[k]) && candidate[k] > 0,
        ) &&
        hash(numeric(candidate)) === r.new_hash
      )
        b = candidate;
    }
    await revision(
      db,
      s,
      r,
      b,
      r.new_hash,
      r.fetch_id,
      r.payload,
      fixture,
      true,
    );
  }
}
async function save(db: DB, s: any, status: string, error: string | null) {
  const metrics = calculate(
    Number(s.signal_price),
    await observations(db, s.id),
  );
  await db.query(
    `INSERT INTO signal_performance(signal_id,metrics,status,error) VALUES($1,$2,$3,$4)
 ON CONFLICT(signal_id) DO UPDATE SET metrics=excluded.metrics,status=excluded.status,error=excluded.error,calculated_at=now()`,
    [s.id, metrics, status, error],
  );
  return metrics;
}
export async function runWorker(pool: pg.Pool, deps: Dependencies = {}) {
  const now = deps.now ?? Date.now,
    getCalendar = deps.calendar ?? calendar,
    getChart = deps.fetchChart ?? fetchChart;
  const fixture = deps.fixtureMode ?? process.env.RADAR_TRACK_FIXTURES === "1";
  if (fixture) {
    const name = (await pool.query("SELECT current_database() name")).rows[0]
      .name;
    if (!name.startsWith("radar_test_"))
      throw Error("Fixture worker forbidden outside isolated test DB");
  }
  const lock = await pool.connect();
  let runId: string | undefined;
  const errors: any[] = [];
  let processed = 0,
    newFailures = 0,
    unexpectedFailures = 0,
    knownExclusions = 0,
    immature = 0;
  try {
    if (
      !(await lock.query("SELECT pg_try_advisory_lock(74209917) ok")).rows[0].ok
    )
      return {
        status: "skipped",
        reason: "worker locked",
        exitCode: 0,
        processed: 0,
        errors: [],
        summary: {} as any,
      };
    runId = (
      await pool.query("INSERT INTO worker_runs DEFAULT VALUES RETURNING id")
    ).rows[0].id;
    const signals = (
      await pool.query(
        `SELECT s.*,r.cutoff_at,p.status previous_status,p.metrics previous_metrics FROM radar_signals s JOIN radar_runs r ON r.id=s.run_id
  LEFT JOIN signal_performance p ON p.signal_id=s.id WHERE r.run_type=$1 AND s.signal_price IS NOT NULL AND COALESCE(p.status,'pending')!='completed'
  ORDER BY p.calculated_at NULLS FIRST,r.cutoff_at,s.id LIMIT 50`,
        [fixture ? "fixture" : "live"],
      )
    ).rows;
    for (const s of signals) {
      const c = await pool.connect();
      let newRevision = false;
      try {
        await c.query("BEGIN");
        await legacyRevisions(c, s, fixture);
        const unresolved = async () =>
          !!(
            await c.query(
              `SELECT ${unresolvedSQL()} value FROM radar_signals s WHERE s.id=$1`,
              [s.id],
            )
          ).rows[0].value;
        if (
          s.previous_status === "quarantined" &&
          s.previous_metrics?.sessions === 30 &&
          (await unresolved())
        ) {
          await save(
            c,
            s,
            "quarantined",
            "Provider revised frozen observation; quarantined (unresolved archived evidence)",
          );
          knownExclusions++;
          processed++;
          await c.query("COMMIT");
          continue;
        }
        const cutoff = new Date(s.cutoff_at).toISOString();
        const sessions = await getCalendar(s.exchange, cutoff);
        const cutoffDay = new Intl.DateTimeFormat("en-CA", {
          timeZone: s.currency === "EUR" ? "Europe/Paris" : "America/New_York",
        }).format(new Date(cutoff));
        const due = sessions
          .filter((x) => x.session > cutoffDay)
          .slice(0, 30)
          .filter((x) => Date.parse(x.close_at) + 3600000 <= now());
        if (!due.length) {
          await save(
            c,
            s,
            (await unresolved()) ? "quarantined" : "active",
            (await unresolved()) ? "Unresolved provider revision" : null,
          );
          immature++;
          processed++;
          await c.query("COMMIT");
          continue;
        }
        const f = await getChart(s.market_symbol, "1d", pool);
        if (!f.id) throw Error("Missing archived source fetch");
        identity(f.chart, s, fixture);
        const events = splitEvents(f.chart, cutoff);
        const audit = events.length
          ? (
              await c.query(
                "SELECT id,event_hash,factor FROM split_audits WHERE signal_id=$1 AND event_hash=$2",
                [s.id, hash(events)],
              )
            ).rows[0]
          : null;
        if (events.length && !audit)
          throw new ExpectedIssue(
            "split",
            { event_hash: hash(events), events, fetch_id: f.id },
            "split requires audited adjustment " + hash(events),
          );
        const bs = selectBars(
          f.chart,
          sessions,
          cutoff,
          s.currency,
          now(),
          audit
            ? { event_hash: audit.event_hash, factor: Number(audit.factor) }
            : undefined,
        );
        if (!bs.length) throw Error("No valid closed bars from provider");
        // Validate EVERY incoming bar before appending anything. No invalid OHLC may
        // poison immutable history, including a bad bar after a missing ordinal.
        for (const b of bs) calculate(Number(s.signal_price), [{ ...b, n: 1 }]);
        for (const b of bs) {
          const h = hash(numeric(b));
          const old = (
            await c.query(
              "SELECT id,payload_hash,ohlc FROM price_observations WHERE signal_id=$1 AND session=$2",
              [s.id, b.session],
            )
          ).rows[0];
          if (old) {
            if (old.payload_hash !== h) {
              const added = await revision(
                c,
                s,
                old,
                b,
                h,
                f.id,
                f.chart,
                fixture,
              );
              newRevision = added || newRevision;
            }
            continue;
          }
          await c.query(
            `INSERT INTO price_observations(signal_id,session,trading_days_since_signal,observed_at,price,performance_pct,ohlc,fetch_id,split_audit_id,payload_hash)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
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
        const metrics = calculate(
          Number(s.signal_price),
          await observations(c, s.id),
        );
        const blocked = await unresolved();
        const missing = due.filter((_, i) => !bs.some((b) => b.n === i + 1));
        // A currently absent historical bar with a valid frozen observation is not
        // fabricated; the accepted frozen view can still supply that ordinal.
        const frozen = await observations(c, s.id);
        const absent = missing.filter(
          (_, i) => !frozen.some((b) => b.session === missing[i].session),
        );
        if (absent.length) {
          const issue = new ExpectedIssue(
            "missing",
            { sessions: absent.map((x) => x.session) },
            "Missing closed trading session",
          );
          const added = await c.query(
            "INSERT INTO worker_issues(signal_id,kind,fingerprint,evidence) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id",
            [
              s.id,
              issue.kind,
              hash(issue.evidence),
              { ...issue.evidence, fetch_id: f.id },
            ],
          );
          if (added.rowCount || newRevision) {
            newFailures++;
            errors.push({ signal_id: s.id, error: issue.message, new: true });
          } else knownExclusions++;
          await save(
            c,
            s,
            blocked ? "quarantined" : "missing",
            blocked
              ? "Provider revised frozen observation; quarantined"
              : issue.message,
          );
        } else if (blocked) {
          if (newRevision) {
            newFailures++;
            errors.push({
              signal_id: s.id,
              error: "Provider revised frozen observation; quarantined",
              new: true,
            });
          } else knownExclusions++;
          await save(
            c,
            s,
            "quarantined",
            "Provider revised frozen observation; quarantined (unresolved archived evidence)",
          );
        } else
          await save(
            c,
            s,
            metrics.sessions === 30 ? "completed" : "active",
            null,
          );
        processed++;
        await c.query("COMMIT");
      } catch (e) {
        // Preserve successful evidence and appended bars for expected exclusions.
        // Roll back unexpected SQL/transport/validation failures for this signal.
        if (e instanceof ExpectedIssue) {
          try {
            const fingerprint = hash(
              e.kind === "split"
                ? { event_hash: e.evidence.event_hash }
                : e.evidence,
            );
            const added = await c.query(
              "INSERT INTO worker_issues(signal_id,kind,fingerprint,evidence) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id",
              [s.id, e.kind, fingerprint, e.evidence],
            );
            if (added.rowCount) {
              newFailures++;
              errors.push({ signal_id: s.id, error: e.message, new: true });
            } else knownExclusions++;
            await save(c, s, "quarantined", e.message);
            await c.query("COMMIT");
            processed++;
          } catch (dbError) {
            await c.query("ROLLBACK");
            throw dbError;
          }
        } else {
          await c.query("ROLLBACK");
          const msg = e instanceof Error ? e.message : "worker error";
          unexpectedFailures++;
          errors.push({ signal_id: s.id, error: msg, unexpected: true });
          await save(pool, s, "quarantined", msg);
        }
      } finally {
        c.release();
      }
    }
    const counts = (
      await pool.query(
        `SELECT count(*)::int total,count(*) FILTER(WHERE ${eligibleSQL})::int eligible,
  count(*) FILTER(WHERE p.status='completed')::int completed FROM radar_signals s JOIN radar_runs r ON r.id=s.run_id
  LEFT JOIN signal_performance p ON p.signal_id=s.id WHERE r.run_type=$1`,
        [fixture ? "fixture" : "live"],
      )
    ).rows[0];
    const summary = {
      policy: measurementPolicy,
      selected: signals.length,
      processed,
      total: counts.total,
      eligible: counts.eligible,
      excluded: counts.total - counts.eligible,
      completed: counts.completed,
      immature,
      new_failures: newFailures,
      unexpected_failures: unexpectedFailures,
      known_exclusions: knownExclusions,
      remaining: Math.max(0, counts.total - counts.completed - signals.length),
      scope: "all signals; selected batch counts separately",
    };
    const status = errors.length
      ? "partial"
      : summary.excluded
        ? "ok_with_exclusions"
        : "ok";
    await pool.query(
      "UPDATE worker_runs SET finished_at=now(),status=$2,processed=$3,errors=$4,summary=$5 WHERE id=$1",
      [runId, status, processed, JSON.stringify(errors), summary],
    );
    return {
      id: runId,
      status,
      processed,
      errors,
      summary,
      exitCode: errors.length ? 2 : 0,
    };
  } catch (e) {
    if (runId)
      await pool.query(
        "UPDATE worker_runs SET finished_at=now(),status='failed',errors=$2 WHERE id=$1",
        [
          runId,
          JSON.stringify([
            { error: e instanceof Error ? e.message : "worker failed" },
          ]),
        ],
      );
    throw e;
  } finally {
    await lock.query("SELECT pg_advisory_unlock(74209917)");
    lock.release();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await runWorker(pool);
    console.log(JSON.stringify(result));
    process.exitCode = result.exitCode;
  } catch (e) {
    console.error("Worker failed", e instanceof Error ? e.message : "unknown");
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
