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
) {
  if (!/^[A-Z0-9.-]{1,20}$/.test(symbol)) throw Error("Invalid symbol");
  if (pool) {
    const cached = await pool.query(
      "SELECT id,payload FROM market_fetches WHERE symbol=$1 AND interval=$2 AND fetched_at>now()-interval '30 minutes' ORDER BY fetched_at DESC LIMIT 1",
      [symbol, interval],
    );
    if (cached.rowCount)
      return {
        id: cached.rows[0].id,
        chart: cached.rows[0].payload,
        cache: true,
      };
  }
  const source = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${interval === "1m" ? "7d" : "6mo"}&interval=${interval}&events=splits%2Cdiv`;
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
  const dates = new Map<string, number>();
  (chart.timestamp ?? []).forEach((t: number, i: number) =>
    dates.set(new Date(t * 1000).toISOString().slice(0, 10), i),
  );
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
    const vals = [q.open[i], q.high[i], q.low[i], q.close[i]];
    if (
      vals.some(
        (v) => v === null || v === undefined || !Number.isFinite(v) || v <= 0,
      )
    )
      return;
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
