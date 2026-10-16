import pg from "pg";
import { fetchChart, calendar, selectBars } from "./market.js";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const result = [];
  for (const [symbol, exchange, currency] of [
    ["NVDA", "XNAS", "USD"],
    ["MC.PA", "XPAR", "EUR"],
  ]) {
    const f = await fetchChart(symbol, "1d", pool);
    const cutoff = "2026-09-01T15:45:00Z";
    const dates = await calendar(exchange, cutoff);
    const b = selectBars(f.chart, dates, cutoff, currency);
    result.push({
      symbol,
      exchange,
      currency,
      source_fetch_id: f.id,
      closed_subsequent_sessions: b.length,
      first: b[0]?.session,
      last: b.at(-1)?.session,
      notice: "REAL MARKET SOURCE PROBE, NOT A SIGNAL OR PREDICTION",
    });
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  await pool.end();
}
