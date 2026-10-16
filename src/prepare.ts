import pg from "pg";
import { watchlist } from "./core.js";
import { cutoffForDate, quoteBeforeCutoff } from "./quotes.js";
import { fetchChart } from "./market.js";
import { technicalContext } from "./technical.js";
const date =
  process.argv[2] ??
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const cutoff_at = cutoffForDate(date);
if (Date.parse(cutoff_at) > Date.now())
  throw Error("Cannot prepare before cutoff");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const existing = (
    await pool.query(
      "SELECT id,raw_report,payload FROM radar_runs WHERE run_key=$1",
      ["daily:" + date],
    )
  ).rows[0];
  if (existing) {
    console.log(JSON.stringify({ existing_run: existing }));
  } else {
    const extras = process.argv[3] ? JSON.parse(process.argv[3]) : [];
    if (!Array.isArray(extras) || extras.length === 1 || extras.length > 5)
      throw Error("Extras: zero or 2–5");
    const securities = [...watchlist, ...extras];
    const results = [];
    for (const w of securities) {
      try {
        const f = await fetchChart(w.market_symbol, "1m", pool);
        const quote = quoteBeforeCutoff(f.chart, cutoff_at, w.currency);
        let technical = null,
          daily_fetch_id = null,
          technical_error = null;
        try {
          const d = await fetchChart(w.market_symbol, "1d", pool);
          daily_fetch_id = d.id;
          technical = technicalContext(
            d.chart,
            cutoff_at,
            w.currency,
            quote.signal_price,
          );
        } catch (e) {
          technical_error =
            e instanceof Error ? e.message : "Daily data unavailable";
        }
        const daily = technical?.daily_history ?? [];
        const prev = daily.at(-1);
        const perf = (n: number) =>
          daily.length >= n && quote.signal_price !== null
            ? 100 * (quote.signal_price / daily.at(-n)!.close - 1)
            : null;
        results.push({
          ...w,
          ...quote,
          quote_source:
            quote.signal_price === null
              ? null
              : `https://query1.finance.yahoo.com/v8/finance/chart/${w.market_symbol}?interval=1m`,
          fetch_id: f.id,
          daily_performance_pct: perf(1),
          five_session_performance_pct: perf(5),
          month_approx_performance_pct: perf(20),
          last_closed_session: prev,
          daily_history: daily,
          technical_context: technical,
          technical_error,
          daily_fetch_id,
          sources_available_until: cutoff_at,
        });
      } catch (e) {
        results.push({
          ...w,
          signal_price: null,
          quote_at: null,
          quote_source: null,
          data_status: "missing",
          data_reason: e instanceof Error ? e.message : "Data failure",
        });
      }
    }
    console.log(
      JSON.stringify(
        {
          run_key: "daily:" + date,
          run_date: date,
          cutoff_at,
          prepared_at: new Date().toISOString(),
          run_type: "live",
          warning:
            "Market context only, not predictions. News must be independently researched with publication times <= cutoff. Minute quotes strictly predate cutoff.",
          securities: results,
        },
        null,
        2,
      ),
    );
  }
} finally {
  await pool.end();
}
