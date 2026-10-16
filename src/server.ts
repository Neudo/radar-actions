import pg from "pg";
import { buildApp } from "./app.js";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});
const app = await buildApp(pool, {
  key: process.env.RADAR_API_KEY ?? "",
  readKey: process.env.RADAR_READ_KEY,
});
await app.listen({ port: 3000, host: "0.0.0.0" });
for (const sig of ["SIGTERM", "SIGINT"])
  process.on(sig, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
