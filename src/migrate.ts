import pg from "pg";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
export async function migrate(pool: pg.Pool) {
  await pool.query(
    await readFile(new URL("../migrations/001.sql", import.meta.url), "utf8"),
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await migrate(pool);
    if (process.env.IR_APP_PASSWORD) {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const exists = await c.query(
          "SELECT 1 FROM pg_roles WHERE rolname='radar_app'",
        );
        if (!exists.rowCount) await c.query("CREATE ROLE radar_app LOGIN");
        await c
          .query(
            "SELECT format('ALTER ROLE radar_app PASSWORD %L',$1::text) sql",
            [process.env.IR_APP_PASSWORD],
          )
          .then((r) => c.query(r.rows[0].sql));
        await c.query(
          "GRANT CONNECT ON DATABASE investment_radar TO radar_app; GRANT USAGE ON SCHEMA public TO radar_app; GRANT SELECT,INSERT ON radar_runs,radar_signals,price_observations,market_fetches,worker_runs,data_conflicts TO radar_app; GRANT SELECT ON split_audits TO radar_app; REVOKE INSERT ON split_audits FROM radar_app; GRANT SELECT,INSERT,UPDATE ON signal_performance TO radar_app; GRANT UPDATE ON worker_runs TO radar_app; REVOKE CREATE ON SCHEMA public FROM PUBLIC",
        );
        await c.query("COMMIT");
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }
    console.log("Migration OK");
  } finally {
    await pool.end();
  }
}
