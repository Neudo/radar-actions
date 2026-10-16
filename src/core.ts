import { createHash } from "node:crypto";
import { z } from "zod";
export const tags = ["RED", "ORANGE", "GREEN", "DOUBLE_GREEN"] as const;
export type Bar = {
  session: string;
  n: number;
  open: number;
  high: number;
  low: number;
  close: number;
  [k: string]: unknown;
};
const round = (v: number) => Math.round(v * 1e8) / 1e8;
export function canonical(x: unknown): string {
  if (Array.isArray(x)) return "[" + x.map(canonical).join(",") + "]";
  if (x !== null && typeof x === "object")
    return (
      "{" +
      Object.entries(x)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(x);
}
export const hash = (x: unknown) =>
  createHash("sha256").update(canonical(x)).digest("hex");
export function drawdown(entry: number, bs: Bar[]) {
  let peak = entry,
    optimistic = 0,
    conservative = 0;
  for (const b of bs) {
    optimistic = Math.min(
      optimistic,
      (b.low / Math.max(peak, b.open) - 1) * 100,
      (b.close / Math.max(peak, b.high) - 1) * 100,
    );
    peak = Math.max(peak, b.high);
    conservative = Math.min(conservative, (b.low / peak - 1) * 100);
  }
  return {
    optimistic_pct: round(optimistic),
    conservative_pct: round(conservative),
    exact_intraday: false,
  };
}
export function calculate(entry: number, bs: Bar[]) {
  if (!(entry > 0)) throw Error("Invalid entry");
  const sorted = [...bs].sort((a, b) => a.n - b.n);
  const contiguous: Bar[] = [];
  for (const b of sorted) {
    if (b.n !== contiguous.length + 1 || b.n > 30) break;
    if (
      ![b.open, b.high, b.low, b.close].every(
        (v) => Number.isFinite(v) && v > 0,
      ) ||
      b.high < Math.max(b.open, b.close) ||
      b.low > Math.min(b.open, b.close) ||
      b.low > b.high
    )
      throw Error("Invalid OHLC");
    contiguous.push(b);
  }
  const ret = (v: number) => round((v / entry - 1) * 100);
  let peak = entry,
    dd = 0;
  for (const b of contiguous) {
    peak = Math.max(peak, b.close);
    dd = Math.min(dd, (b.close / peak - 1) * 100);
  }
  const targets = Object.fromEntries(
    [5, 9, 10].map((t) => [
      String(t),
      {
        intraday_day:
          contiguous.find((b) => b.high >= entry * (1 + t / 100) - 1e-9)?.n ??
          null,
        close_day:
          contiguous.find((b) => b.close >= entry * (1 + t / 100) - 1e-9)?.n ??
          null,
      },
    ]),
  );
  return {
    sessions: contiguous.length,
    matured: contiguous.length === 30,
    data_status:
      sorted.length > contiguous.length && contiguous.length < 30
        ? "gap"
        : "ok",
    checkpoints: Object.fromEntries(
      [5, 10, 20, 30].map((n) => [
        String(n),
        contiguous[n - 1] ? ret(contiguous[n - 1].close) : null,
      ]),
    ),
    targets,
    current_price: contiguous.at(-1)?.close ?? null,
    current_return_pct: contiguous.length
      ? ret(contiguous.at(-1)!.close)
      : null,
    max_gain_pct: contiguous.length
      ? ret(Math.max(...contiguous.map((b) => b.high)))
      : null,
    min_return_pct: contiguous.length
      ? ret(Math.min(...contiguous.map((b) => b.low)))
      : null,
    close_drawdown_pct: contiguous.length ? round(dd) : null,
    ohlc_drawdown_bounds: drawdown(entry, contiguous),
    sessions_remaining: 30 - contiguous.length,
  };
}
const stats = (xs: (number | null)[]) => {
  const vs = xs.filter((v): v is number => v !== null).sort((a, b) => a - b);
  return {
    n: vs.length,
    mean: vs.length ? round(vs.reduce((a, b) => a + b, 0) / vs.length) : null,
    median: vs.length
      ? round(
          (vs[Math.floor((vs.length - 1) / 2)] +
            vs[Math.floor(vs.length / 2)]) /
            2,
        )
      : null,
  };
};
export function aggregate(
  rows: {
    tag: string;
    assessment_status?: string;
    performance: ReturnType<typeof calculate> | null;
  }[],
) {
  const group = (rs: typeof rows) => {
    const mature = rs.filter((r) => r.performance?.matured);
    return {
      total: rs.length,
      matured: mature.length,
      backlog: rs.length - mature.length,
      checkpoints: Object.fromEntries(
        [5, 10, 20, 30].map((n) => [
          String(n),
          stats(rs.map((r) => r.performance?.checkpoints[String(n)] ?? null)),
        ]),
      ),
      max_gain: stats(mature.map((r) => r.performance!.max_gain_pct)),
      drawdown: stats(mature.map((r) => r.performance!.close_drawdown_pct)),
      target_rates: Object.fromEntries(
        [5, 9, 10].map((n) => [
          String(n),
          {
            denominator: mature.length,
            intraday_pct: mature.length
              ? round(
                  (100 *
                    mature.filter(
                      (r) =>
                        r.performance!.targets[String(n)].intraday_day !== null,
                    ).length) /
                    mature.length,
                )
              : null,
            close_pct: mature.length
              ? round(
                  (100 *
                    mature.filter(
                      (r) =>
                        r.performance!.targets[String(n)].close_day !== null,
                    ).length) /
                    mature.length,
                )
              : null,
            intraday_days: stats(
              mature.map((r) => r.performance!.targets[String(n)].intraday_day),
            ),
            close_days: stats(
              mature.map((r) => r.performance!.targets[String(n)].close_day),
            ),
          },
        ]),
      ),
    };
  };
  const assessed = rows.filter((r) => r.assessment_status !== "unknown");
  const safe = rows.map((r) =>
    r.assessment_status === "unknown" ? { ...r, performance: null } : r,
  );
  return {
    overall: group(safe),
    unknown_count: rows.length - assessed.length,
    by_tag: Object.fromEntries(
      tags.map((t) => [t, group(assessed.filter((r) => r.tag === t))]),
    ),
    warning:
      "Forward testing only. Incomplete samples excluded from 30-session rates; no currency conversion. Close drawdown exact; OHLC drawdown bounded.",
  };
}
const text = z.string().min(1).max(10000),
  date = z.iso.datetime({ offset: true });
const zoneSchema = z
  .strictObject({
    low: z.number().positive(),
    high: z.number().positive(),
    basis: text,
  })
  .refine((v) => v.low <= v.high, { message: "Zone low must not exceed high" });
const setupSchema = z.strictObject({
  listing: z.strictObject({
    identifier: z.string().min(1).max(100),
    venue: z.string().min(1).max(100),
    currency: z.enum(["USD", "EUR"]),
    quote_price: z.number().positive(),
    quote_at: date,
    quote_source: z.string().url(),
    trade_republic_verified: z.boolean(),
  }),
  support: zoneSchema,
  alert: zoneSchema.nullable(),
  structural_invalidation: zoneSchema.nullable(),
  technical_evidence: text,
  confirmations: z.array(text).max(20),
});
export const signalSchema = z.strictObject({
  // Optional without defaults: old parsed payloads and their canonical hashes stay identical.
  assessment_status: z.enum(["assessed", "unknown"]).optional(),
  setup: setupSchema.nullable().optional(),
  ticker: z.string().regex(/^[A-Z0-9.-]{1,20}$/),
  exchange: z.enum(["XNAS", "XNYS", "XPAR"]),
  market_symbol: z.string().regex(/^[A-Z0-9.-]{1,20}$/),
  company: text,
  sector: text,
  tag: z.enum(tags),
  signal_price: z.number().positive().nullable(),
  currency: z.enum(["USD", "EUR"]),
  quote_at: date.nullable(),
  quote_source: z.string().url().nullable(),
  data_status: z.enum(["verified", "missing"]),
  data_reason: z.string().max(2000),
  catalyst_type: text,
  catalyst_summary: text,
  thesis: text,
  risks: text,
  invalidation: text,
  target_pct: z.number().min(0).max(100).nullable(),
  horizon_days: z.number().int().min(5).max(30),
  sources: z
    .array(
      z.strictObject({
        url: z.string().url(),
        published_at: date.nullable(),
        accessed_at: date,
        summary: text,
      }),
    )
    .max(30),
  discovery_reason: z.string().max(2000).nullable(),
});
export const runSchema = z.strictObject({
  run_key: z.string().regex(/^[a-zA-Z0-9_.:-]{1,100}$/),
  run_date: z.iso.date(),
  cutoff_at: date,
  generated_at: date,
  market_context: text,
  raw_report: text,
  run_type: z.enum(["live", "fixture"]),
  signals: z.array(signalSchema).min(1).max(25),
});
export type Run = z.infer<typeof runSchema>;
export const watchlist = [
  ["NVDA", "XNAS", "Nvidia", "Semiconductors"],
  ["AMD", "XNAS", "AMD", "Semiconductors"],
  ["AVGO", "XNAS", "Broadcom", "Semiconductors"],
  ["TSM", "XNYS", "TSMC ADR", "Semiconductors"],
  ["AAPL", "XNAS", "Apple", "Technology"],
  ["MSFT", "XNAS", "Microsoft", "Technology"],
  ["META", "XNAS", "Meta", "Communication"],
  ["GOOGL", "XNAS", "Alphabet", "Communication"],
  ["PLTR", "XNAS", "Palantir", "Software"],
  ["CRM", "XNYS", "Salesforce", "Software"],
  ["ABNB", "XNAS", "Airbnb", "Travel"],
  ["BKNG", "XNAS", "Booking Holdings", "Travel"],
  ["MC.PA", "XPAR", "LVMH", "Luxury"],
  ["RMS.PA", "XPAR", "Hermès", "Luxury"],
  ["KER.PA", "XPAR", "Kering", "Luxury"],
  ["JPM", "XNYS", "JPMorgan Chase", "Banking"],
  ["TTE.PA", "XPAR", "TotalEnergies", "Energy"],
  ["XOM", "XNYS", "Exxon Mobil", "Energy"],
  ["AIR.PA", "XPAR", "Airbus", "Aerospace"],
  ["TSLA", "XNAS", "Tesla", "Automotive"],
].map(([market_symbol, exchange, company, sector]) => ({
  ticker: market_symbol.replace(".PA", ""),
  market_symbol,
  exchange,
  company,
  sector,
  currency: exchange === "XPAR" ? "EUR" : "USD",
}));
export function validateRun(input: unknown): Run {
  const r = runSchema.parse(input);
  const cutoff = new Date(r.cutoff_at).getTime();
  if (
    cutoff > Date.now() ||
    new Date(r.generated_at).getTime() < cutoff ||
    new Date(r.generated_at).getTime() > Date.now() + 60000
  )
    throw Error("Invalid cutoff/generated time");
  const keys = r.signals.map((s) => s.ticker + ":" + s.exchange);
  if (new Set(keys).size !== keys.length) throw Error("Duplicate security");
  for (const s of r.signals) {
    if ((s.exchange === "XPAR") !== (s.currency === "EUR"))
      throw Error("Currency/exchange mismatch");
    if (s.data_status === "verified") {
      if (
        s.signal_price === null ||
        s.quote_at === null ||
        s.quote_source === null ||
        new Date(s.quote_at).getTime() >= cutoff
      )
        throw Error("Quote must predate cutoff");
      if (cutoff - new Date(s.quote_at).getTime() > 5 * 86400000)
        throw Error("Stale quote: mark missing");
    } else if (
      s.signal_price !== null ||
      s.quote_at !== null ||
      s.tag !== "ORANGE" ||
      !s.data_reason
    )
      throw Error("Missing data cannot be RED or priced");
    if (s.assessment_status === "unknown" && (s.setup || s.tag !== "ORANGE"))
      throw Error("Unknown assessment cannot claim a setup or directional tag");
    if (s.setup) {
      if (s.data_status !== "verified")
        throw Error("Setup requires verified baseline");
      const p = s.setup,
        l = p.listing,
        age = cutoff - Date.parse(l.quote_at);
      if (age <= 0 || age > 5 * 86400000)
        throw Error("Setup quote must be recent and strictly pre-cutoff");
      const native =
        l.identifier === s.ticker + ":" + s.exchange &&
        l.venue === s.exchange &&
        l.currency === s.currency;
      if (native) {
        if (
          l.quote_at !== s.quote_at ||
          l.quote_price !== s.signal_price ||
          l.quote_source !== s.quote_source
        )
          throw Error("Setup quote differs from frozen native baseline");
      } else if (
        l.currency !== "EUR" ||
        !l.trade_republic_verified ||
        !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(l.identifier)
      )
        throw Error(
          "Alternate listing requires verified EUR Trade Republic instrument ISIN and quotation; no FX conversion",
        );
      if (
        p.alert &&
        (p.alert.low < p.support.low ||
          p.alert.low > l.quote_price ||
          p.alert.high <= p.support.high)
      )
        throw Error(
          "Alert must approach support before rebound, not chase a higher price",
        );
      if (
        p.structural_invalidation &&
        p.structural_invalidation.high >= p.support.low
      )
        throw Error("Invalidation must lie below documented support");
      if (
        ["GREEN", "DOUBLE_GREEN"].includes(s.tag) &&
        p.confirmations.length < 2
      )
        throw Error("Green setup requires multiple confirmations");
    }
    for (const src of s.sources)
      if (src.published_at && new Date(src.published_at).getTime() > cutoff)
        throw Error("Post-cutoff source");
  }
  if (r.run_type === "live") {
    if (new Date(r.generated_at).getTime() - cutoff > 15 * 60000)
      throw Error(
        "Live prediction must be generated within 15 minutes of cutoff; no hindsight backfill",
      );
    for (const s of r.signals) {
      if (
        ["GREEN", "DOUBLE_GREEN"].includes(s.tag) &&
        (!s.sources.length || s.sources.some((src) => !src.published_at))
      )
        throw Error("Green tags require timestamped evidence sources");
    }
    const paris = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(cutoff));
    const v = Object.fromEntries(paris.map((x) => [x.type, x.value]));
    if (
      `${v.year}-${v.month}-${v.day}` !== r.run_date ||
      v.hour !== "17" ||
      v.minute !== "45" ||
      new Date(cutoff).getUTCSeconds() !== 0
    )
      throw Error("Live cutoff must be 17:45 Europe/Paris");
    if (r.run_key !== `daily:${r.run_date}`)
      throw Error("Use stable daily run_key");
    for (const w of watchlist)
      if (
        !r.signals.some(
          (s) =>
            s.market_symbol === w.market_symbol &&
            s.exchange === w.exchange &&
            s.ticker === w.ticker,
        )
      )
        throw Error("Missing watchlist security " + w.market_symbol);
    const discoveries = r.signals.filter(
      (s) =>
        !watchlist.some(
          (w) =>
            s.market_symbol === w.market_symbol && s.exchange === w.exchange,
        ),
    );
    if (
      discoveries.length === 1 ||
      discoveries.length > 5 ||
      discoveries.some((s) => !s.discovery_reason)
    )
      throw Error("Discoveries: zero or 2–5 justified");
  }
  return r;
}
