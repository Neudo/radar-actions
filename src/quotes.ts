export function cutoffForDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error("Invalid date");
  // Effective-dated schedule: never reinterpret immutable historical runs.
  const time = date >= "2026-10-19" ? "09:00" : "17:45";
  const dt = new Date(date + `T${time}:00Z`);
  const zone = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Paris",
    timeZoneName: "shortOffset",
  })
    .formatToParts(dt)
    .find((v) => v.type === "timeZoneName")!.value;
  const offset = Number(zone.match(/GMT([+-]\d+)/)?.[1] ?? 0);
  return new Date(dt.getTime() - offset * 3600000).toISOString();
}
export function quoteBeforeCutoff(
  chart: any,
  cutoff: string,
  currency: string,
) {
  if (chart.meta?.currency !== currency) throw Error("Quote currency mismatch");
  const end = Date.parse(cutoff);
  let index = -1;
  const close = chart.indicators?.quote?.[0]?.close ?? [];
  for (let i = 0; i < (chart.timestamp ?? []).length; i++) {
    const completed = (chart.timestamp[i] + 60) * 1000;
    if (
      completed < end &&
      end - completed < 5 * 86400000 &&
      Number.isFinite(close[i]) &&
      close[i] > 0
    )
      index = i;
  }
  return index < 0
    ? {
        signal_price: null,
        quote_at: null,
        data_status: "missing",
        data_reason: "No valid completed minute quote strictly before cutoff",
      }
    : {
        signal_price: close[index],
        quote_at: new Date((chart.timestamp[index] + 60) * 1000).toISOString(),
        data_status: "verified",
        data_reason:
          "Completed Yahoo minute bar, possibly delayed; personal research feed, no SLA",
      };
}
