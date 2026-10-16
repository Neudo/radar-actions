import pg from "pg";
import { Run, hash, calculate, Bar } from "./core.js";
export class Conflict extends Error {}
export class LateRun extends Error {
  statusCode = 400;
}
export async function ingest(pool: pg.Pool, r: Run) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const h = hash(r);
    if (
      r.run_type === "live" &&
      Date.now() - Date.parse(r.cutoff_at) > 15 * 60000
    ) {
      const old = (
        await c.query(
          "SELECT id,payload_hash FROM radar_runs WHERE run_key=$1",
          [r.run_key],
        )
      ).rows[0];
      if (!old)
        throw new LateRun("Late live run refused: no hindsight backfill");
      if (old.payload_hash !== h)
        throw new Conflict("Immutable run_key conflict");
      await c.query("COMMIT");
      return { id: old.id, created: false };
    }
    const ins = await c.query(
      "INSERT INTO radar_runs(run_key,run_date,cutoff_at,generated_at,run_type,market_context,raw_report,payload,payload_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(run_key) DO NOTHING RETURNING id",
      [
        r.run_key,
        r.run_date,
        r.cutoff_at,
        r.generated_at,
        r.run_type,
        r.market_context,
        r.raw_report,
        r,
        h,
      ],
    );
    if (!ins.rowCount) {
      const old = (
        await c.query(
          "SELECT id,payload_hash FROM radar_runs WHERE run_key=$1",
          [r.run_key],
        )
      ).rows[0];
      if (!old || old.payload_hash !== h)
        throw new Conflict(
          "Immutable run_key already exists with different payload",
        );
      await c.query("COMMIT");
      return { id: old.id, created: false };
    }
    const id = ins.rows[0].id;
    for (const s of r.signals)
      await c.query(
        "INSERT INTO radar_signals(run_id,ticker,exchange,market_symbol,company,sector,tag,signal_price,currency,catalyst_type,data_status,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
        [
          id,
          s.ticker,
          s.exchange,
          s.market_symbol,
          s.company,
          s.sector,
          s.tag,
          s.signal_price,
          s.currency,
          s.catalyst_type,
          s.data_status,
          s,
        ],
      );
    await c.query("COMMIT");
    return { id, created: true };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function observations(pool: pg.Pool, id: string): Promise<Bar[]> {
  return (
    await pool.query(
      "SELECT ohlc FROM price_observations WHERE signal_id=$1 ORDER BY trading_days_since_signal",
      [id],
    )
  ).rows.map((r) => r.ohlc);
}
