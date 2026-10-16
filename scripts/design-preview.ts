// Local review server: real DB reads, database-level read-only sessions, loopback
// only. No migrations, worker execution, scheduler changes, or production restart.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { buildApp } from "../src/app.js";
const env = Object.fromEntries(
  readFileSync(homedir() + "/.hermes/.env", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_][A-Z_0-9]*=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      let v = l.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      )
        v = v.slice(1, -1);
      return [l.slice(0, i), v];
    }),
);
if (!env.IR_APP_PASSWORD || !env.IR_READ_KEY)
  throw Error("Preview credentials unavailable");
const inspect = JSON.parse(
  execFileSync("docker", ["inspect", "investment-radar-db-1"], {
    encoding: "utf8",
  }),
);
const network = Object.values(inspect[0].NetworkSettings.Networks) as {
  IPAddress: string;
}[];
const host = network.find((n) => n.IPAddress)?.IPAddress;
if (!host) throw Error("Private database network unavailable");
const pool = new pg.Pool({
  host,
  port: 5432,
  user: "radar_app",
  password: env.IR_APP_PASSWORD,
  database: "investment_radar",
  options: "-c default_transaction_read_only=on",
  max: 5,
});
if (
  (await pool.query("SHOW default_transaction_read_only")).rows[0]
    .default_transaction_read_only !== "on"
)
  throw Error("Read-only prerequisite failed");
const app = await buildApp(pool, {
  key: randomBytes(32).toString("hex"),
  readKey: env.IR_READ_KEY,
});
await app.listen({
  host: "127.0.0.1",
  port: Number(process.env.RADAR_PREVIEW_PORT || 17846),
});
console.log(
  "Design preview ready: http://127.0.0.1:" +
    (process.env.RADAR_PREVIEW_PORT || 17846) +
    "/dashboard (Basic radar; existing read credential; SQL read-only)",
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
