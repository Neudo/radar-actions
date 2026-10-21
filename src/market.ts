import { execFile } from "node:child_process";
import { promisify } from "node:util";
import pg from "pg";
import { Bar, hash } from "./core.js";
export async function retry<T>(
  f: () => Promise<T>,
  attempts = 3,
  base = 500,
): Promise<T> {
  let error;
  for (let i = 0; i < attempts; i++) {
    try {
      return await f();
    } catch (e) {
      error = e;
      if (i + 1 < attempts)
        await new Promise((r) =>
          setTimeout(r, base * 2 ** i + Math.random() * base),
        );
    }
  }
  throw error;
}
export async function fetchChart(
  symbol: string,
  interval = "1d",
  pool?: pg.Pool,
  window?: { start: string; end: string },
) {
  if (!/^[A-Z0-9.-]{1,20}$/.test(symbol)) throw Error("Invalid symbol");
  if (!["1d", "1m"].includes(interval)) throw Error("Invalid interval");
  if (
    window &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(window.start) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(window.end) ||
      !Number.isFinite(Date.parse(window.start)) ||
      !Number.isFinite(Date.parse(window.end)) ||
      new Date(window.start).toISOString().slice(0, 10) !== window.start ||
      new Date(window.end).toISOString().slice(0, 10) !== window.end ||
      window.start >= window.end ||
      Date.parse(window.end) - Date.parse(window.start) > 120 * 86400000)
  )
    throw Error("Invalid history window");
  const source = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?${window ? `period1=${Date.parse(window.start) / 1000}&period2=${Date.parse(window.end) / 1000}` : `range=${interval === "1m" ? "7d" : "6mo"}`}&interval=${interval}&events=splits%2Cdiv`;
  let fixtureCache = false;
  if (pool && process.env.RADAR_TRACK_FIXTURES === "1") {
    const name = (await pool.query("SELECT current_database() name")).rows[0]
      .name;
    if (!name.startsWith("radar_test_"))
      throw Error("Fixture cache forbidden outside isolated test DB");
    fixtureCache = true;
  }
  if (pool) {
    const cached = await pool.query(
      "SELECT id,payload FROM market_fetches WHERE symbol=$1 AND interval=$2 AND (source=$3 OR ($4 AND source LIKE 'https://example.invalid/%')) AND fetched_at>now()-interval '30 minutes' ORDER BY fetched_at DESC LIMIT 1",
      [symbol, interval, source, fixtureCache],
    );
    if (cached.rowCount)
      return {
        id: cached.rows[0].id,
        chart: cached.rows[0].payload,
        cache: true,
      };
  }
  const chart = await retry(async () => {
    const r = await fetch(source, {
      headers: {
        "User-Agent": "Mozilla/5.0 InvestmentRadarPersonalResearch/1.0",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw Error("Market HTTP " + r.status);
    const json = (await r.json()) as any;
    if (json.chart?.error || !json.chart?.result?.[0])
      throw Error("Market empty/error");
    return json.chart.result[0];
  });
  let id = null;
  if (pool) {
    id = (
      await pool.query(
        "INSERT INTO market_fetches(symbol,interval,source,payload,payload_hash) VALUES($1,$2,$3,$4,$5) RETURNING id",
        [symbol, interval, source, chart, hash(chart)],
      )
    ).rows[0].id;
  }
  return { id, chart, source, cache: false };
}
// Yahoo final daily bars can normalize sub-cent highs/lows to cents later.
// This is equivalence for retry detection ONLY: never round stored prices/hashes.
// Require one endpoint to be the exact decimal-cent or Yahoo float32-cent form,
// not arbitrary nearby values; reject cent changes, identity and split changes.
export function centPrecisionEquivalent(
  frozen: Bar,
  current: Bar,
  currency: string,
): boolean {
  if (
    !["USD", "EUR"].includes(currency) ||
    frozen.session !== current.session ||
    frozen.n !== current.n ||
    frozen.adjustment_factor !== current.adjustment_factor
  )
    return false;
  return (["open", "high", "low", "close"] as const).every((key) => {
    const a = frozen[key],
      b = current[key];
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0)
      return false;
    if (a === b) return true;
    const cents = Math.round(a * 100);
    if (cents !== Math.round(b * 100) || Math.abs(a - b) >= 0.005) return false;
    const decimal = cents / 100,
      provider = Math.fround(decimal);
    return a === decimal || a === provider || b === decimal || b === provider;
  });
}
export type Session = { session: string; close_at: string };
export async function calendar(
  exchange: string,
  cutoff: string,
): Promise<Session[]> {
  const { stdout } = await promisify(execFile)(
    "/opt/calendar/bin/python",
    ["scripts/exchange_sessions.py", exchange, cutoff],
    { timeout: 15000 },
  );
  return JSON.parse(stdout);
}
export function splitEvents(chart: any, cutoff: string) {
  const end = Date.parse(cutoff) / 1000;
  return Object.values(chart.events?.splits ?? {}).filter(
    (x: any) => x.date > end,
  );
}
export function selectBars(
  chart: any,
  sessions: Session[],
  cutoff: string,
  currency: string,
  now = Date.now(),
  approved?: { event_hash: string; factor: number },
): Bar[] {
  if (chart.meta?.currency !== currency) throw Error("Currency mismatch");
  const events = splitEvents(chart, cutoff);
  let factor = 1;
  if (events.length) {
    if (!approved || approved.event_hash !== hash(events))
      throw Error("split requires audited adjustment " + hash(events));
    factor = approved.factor;
  }
  const q = chart.indicators?.quote?.[0];
  if (!q) throw Error("Missing OHLC");
  if (
    ["open", "high", "low", "close"].some(
      (k) =>
        !Array.isArray(q[k]) || q[k].length !== (chart.timestamp ?? []).length,
    )
  )
    throw Error("Malformed provider OHLC arrays");
  const dates = new Map<string, number>();
  const zone =
    chart.meta?.exchangeTimezoneName ??
    (currency === "EUR" ? "Europe/Paris" : "America/New_York");
  (chart.timestamp ?? []).forEach((t: number, i: number) => {
    if (!Number.isFinite(t)) throw Error("Invalid provider timestamp");
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(t * 1000));
    if (dates.has(day)) throw Error("Duplicate provider daily session");
    dates.set(day, i);
  });
  const cutoffDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: currency === "EUR" ? "Europe/Paris" : "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(cutoff));
  const expected = sessions.filter((s) => s.session > cutoffDay).slice(0, 30);
  const bars: Bar[] = [];
  expected.forEach((s, idx) => {
    if (Date.parse(s.close_at) + 3600000 > now) return;
    const i = dates.get(s.session);
    if (i === undefined) return;
    if (["open", "high", "low", "close"].some((k) => !Array.isArray(q[k])))
      throw Error("Malformed provider OHLC arrays");
    const vals = [q.open[i], q.high[i], q.low[i], q.close[i]];
    if (
      vals.some(
        (v) => v !== null && v !== undefined && (!Number.isFinite(v) || v <= 0),
      )
    )
      throw Error("Invalid provider OHLC");
    if (vals.some((v) => v === null || v === undefined)) return;
    bars.push({
      session: s.session,
      n: idx + 1,
      open: vals[0] * factor,
      high: vals[1] * factor,
      low: vals[2] * factor,
      close: vals[3] * factor,
      observed_at: s.close_at,
      adjustment_factor: factor,
    });
  });
  return bars;
}
