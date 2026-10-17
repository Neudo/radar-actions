// Presentation adapters only. Source observations and backend aggregates are authoritative.
export const number = (v: unknown): number | null =>
  v == null ||
  typeof v === "boolean" ||
  String(v).trim() === "" ||
  !Number.isFinite(Number(v))
    ? null
    : Number(v);
export const invalid = (s: any) =>
  ["missing", "quarantined"].includes(s.tracking_status) ||
  s.data_status === "missing" ||
  s.payload?.assessment_status === "unknown";
export function evolution(s: any) {
  if (invalid(s)) return [];
  const baseline = number(s.signal_price);
  const observations = (s.observations || []).filter(
    (o: any) =>
      Number.isInteger(o.trading_days_since_signal) &&
      o.trading_days_since_signal >= 1 &&
      o.trading_days_since_signal <= 30,
  );
  const byDay = new Map<number, any>(
    observations.map((o: any) => [o.trading_days_since_signal, o]),
  );
  const last = Math.max(0, ...byDay.keys());
  return Array.from({ length: last + 1 }, (_, j) => {
    const o = byDay.get(j);
    if (j === 0)
      return {
        j,
        price: baseline,
        return_pct: baseline === null ? null : 0,
        date: s.payload?.quote_at,
        source: s.payload?.quote_source,
        observed_at: s.payload?.quote_at,
        gap: baseline === null,
      };
    return {
      j,
      price: o ? number(o.price) : null,
      return_pct: o ? number(o.performance_pct) : null,
      date: o?.session,
      source: o?.source,
      observed_at: o?.observed_at,
      fetched_at: o?.fetched_at,
      gap: !o,
    };
  });
}
export function levels(s: any) {
  const p = s.payload?.setup,
    l = p?.listing;
  if (
    !l ||
    l.currency !== s.currency ||
    l.venue !== s.exchange ||
    l.identifier !== s.ticker + ":" + s.exchange
  )
    return [];
  const result: {
    key: string;
    label: string;
    value: number;
    basis?: string;
  }[] = [];
  for (const [key, label] of [
    ["support", "Support"],
    ["alert", "Alerte · réanalyse"],
    ["structural_invalidation", "Invalidation"],
  ] as const) {
    for (const edge of ["low", "high"]) {
      const n = number(p[key]?.[edge]);
      if (n !== null && !result.some((r) => r.key === key && r.value === n))
        result.push({
          key,
          label: label + (edge === "low" ? " bas" : " haut"),
          value: n,
          basis: p[key]?.basis,
        });
    }
  }
  return result;
}
export function cohorts(a: any, checkpoint: number) {
  return Object.entries(a?.by_tag || {}).flatMap(([tag, g]: [string, any]) => {
    const c = g.checkpoints?.[checkpoint];
    return c?.n > 0 && number(c.mean) !== null
      ? [
          {
            tag,
            n: c.n,
            mean: number(c.mean)!,
            median: number(c.median),
            total: g.total,
          },
        ]
      : [];
  });
}
