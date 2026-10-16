// Descriptive, deterministic pre-cutoff context only. Never assigns a signal/tag.
export function technicalContext(
  chart: any,
  cutoff: string,
  currency: string,
  quote: number | null,
) {
  if (chart.meta?.currency !== currency) throw Error("Daily currency mismatch");
  if (
    Object.values(chart.events?.splits ?? {}).some(
      (x: any) => x.date * 1000 >= Date.parse(cutoff),
    )
  )
    throw Error(
      "Post-cutoff split: historical technical levels need audited adjustment",
    );
  const q = chart.indicators?.quote?.[0];
  if (!q || !Array.isArray(chart.timestamp)) throw Error("Missing daily OHLCV");
  const zone = currency === "EUR" ? "Europe/Paris" : "America/New_York";
  const day = (t: number) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(t));
  const cutoffDay = day(Date.parse(cutoff));
  const daily_history = chart.timestamp
    .map((t: number, i: number) => ({
      at: new Date(t * 1000).toISOString(),
      session: day(t * 1000),
      open: q.open?.[i],
      high: q.high?.[i],
      low: q.low?.[i],
      close: q.close?.[i],
      volume:
        Number.isFinite(q.volume?.[i]) && q.volume[i] >= 0
          ? (q.volume[i] as number)
          : null,
    }))
    .filter(
      (x: any) =>
        x.session < cutoffDay &&
        [x.open, x.high, x.low, x.close].every(
          (v) => Number.isFinite(v) && v > 0,
        ) &&
        x.low <= Math.min(x.open, x.close) &&
        x.high >= Math.max(x.open, x.close),
    )
    .sort((a: any, b: any) => a.at.localeCompare(b.at))
    .slice(-120) as {
    at: string;
    session: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number | null;
  }[];
  const average = (n: number) =>
    daily_history.length >= n
      ? daily_history.slice(-n).reduce((v, x) => v + x.close, 0) / n
      : null;
  const high = (n: number) =>
    daily_history.length >= n
      ? Math.max(...daily_history.slice(-n).map((x) => x.high))
      : null;
  const low = (n: number) =>
    daily_history.length >= n
      ? Math.min(...daily_history.slice(-n).map((x) => x.low))
      : null;
  const high60 = high(60),
    last20 = daily_history.slice(-20);
  const swings: { session: string; kind: "high" | "low"; price: number }[] = [];
  for (let i = 2; i < daily_history.length - 2; i++) {
    const bar = daily_history[i],
      neighbours = daily_history.slice(i - 2, i + 3).filter((_, j) => j !== 2);
    if (neighbours.every((x) => bar.high > x.high))
      swings.push({ session: bar.session, kind: "high", price: bar.high });
    if (neighbours.every((x) => bar.low < x.low))
      swings.push({ session: bar.session, kind: "low", price: bar.low });
  }
  return {
    daily_history,
    moving_average_20: average(20),
    moving_average_50: average(50),
    moving_average_100: average(100),
    recent_20_session_high: high(20),
    recent_20_session_low: low(20),
    recent_60_session_high: high60,
    pullback_from_60_session_high_pct:
      quote !== null && high60 !== null ? 100 * (quote / high60 - 1) : null,
    average_volume_20:
      last20.length === 20 && last20.every((x) => x.volume !== null)
        ? last20.reduce((v, x) => v + x.volume!, 0) / 20
        : null,
    confirmed_pivots: swings.slice(-16),
    history_limitations:
      "Prior local-session dates only; same-day daily OHLCV excluded even if exchange closed. Up to 120 sessions, no intraday volume extrapolation. Pivots use two completed neighbours on each side; not automatic supports or buy signals.",
  };
}
