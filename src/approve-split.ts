import pg from "pg";
import { z } from "zod";
import { hash } from "./core.js";
import { splitEvents } from "./market.js";
const input = z
  .strictObject({
    signal_id: z.uuid(),
    fetch_id: z.uuid(),
    factor: z.number().positive(),
    reason: z.string().min(20),
    source: z.string().url(),
    approved_by: z.string().min(3),
    normalized_post_cutoff_ohlc_confirmed: z.literal(true),
  })
  .parse(JSON.parse(process.argv[2] ?? "{}"));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const s = (
    await pool.query(
      "SELECT r.cutoff_at,s.market_symbol FROM radar_signals s JOIN radar_runs r ON r.id=s.run_id WHERE s.id=$1",
      [input.signal_id],
    )
  ).rows[0];
  const f = (
    await pool.query("SELECT payload,symbol FROM market_fetches WHERE id=$1", [
      input.fetch_id,
    ])
  ).rows[0];
  if (!s || !f || s.market_symbol !== f.symbol)
    throw Error("Signal/fetch not found or symbol mismatch");
  const events = splitEvents(
    f.payload,
    new Date(s.cutoff_at).toISOString(),
  ) as any[];
  if (!events.length) throw Error("No post-cutoff split");
  const expected = events.reduce(
    (v, e) => (v * e.numerator) / e.denominator,
    1,
  );
  if (Math.abs(expected - input.factor) > 1e-8)
    throw Error("Factor differs from cumulative split ratio");
  const h = hash(events);
  const result = await pool.query(
    "INSERT INTO split_audits(signal_id,event_hash,factor,reason,source,approved_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(signal_id,event_hash) DO NOTHING RETURNING id",
    [
      input.signal_id,
      h,
      input.factor,
      input.reason,
      input.source,
      input.approved_by,
    ],
  );
  const stored = (
    await pool.query(
      "SELECT id,factor FROM split_audits WHERE signal_id=$1 AND event_hash=$2",
      [input.signal_id, h],
    )
  ).rows[0];
  if (Number(stored.factor) !== input.factor)
    throw Error("Existing immutable split audit conflict");
  console.log(
    JSON.stringify({
      verified: true,
      id: stored.id,
      created: !!result.rowCount,
      event_hash: h,
    }),
  );
} finally {
  await pool.end();
}
