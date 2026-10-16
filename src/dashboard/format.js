// Display-only helpers. No market or cohort calculations are performed here.
export const tags = {
  RED: "Rouge",
  ORANGE: "Orange",
  GREEN: "Vert",
  DOUBLE_GREEN: "Double vert",
};
export const numeric = (value) =>
  value == null ||
  typeof value === "boolean" ||
  String(value).trim() === "" ||
  !Number.isFinite(Number(value))
    ? null
    : Number(value);
export function percent(value) {
  const n = numeric(value);
  if (n == null) return "Non mesurable";
  const digits = n !== 0 && Math.abs(n) < 0.005 ? 8 : 2;
  return (
    (n > 0 ? "+" : "") +
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: digits,
    }).format(n) +
    " %"
  );
}
export function price(value, currency) {
  const n = numeric(value);
  return n == null
    ? "Non renseigné"
    : new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n) +
        " " +
        currency;
}
export function day(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Non renseignée";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
export function dateTime(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Non renseignée";
  return (
    new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Paris",
    }).format(new Date(value)) + " · Europe/Paris"
  );
}
export const tracking = (value) =>
  ({
    active: "En cours",
    pending: "En attente",
    missing: "Données manquantes",
    quarantined: "Quarantaine",
    completed: "Terminé",
  })[value] || "État non renseigné";
export const excluded = (row) =>
  ["quarantined", "missing"].includes(row.tracking_status) ||
  row.data_status === "missing";
export function measure(row, checkpoint) {
  if (row.tracking_status === "quarantined") return "Exclu · quarantaine";
  if (row.tracking_status === "missing" || row.data_status === "missing")
    return "Exclu · données manquantes";
  const p = row.performance;
  const v = checkpoint ? p?.checkpoints?.[checkpoint] : p?.current_return_pct;
  if (numeric(v) != null) return percent(v);
  if (p?.data_status === "gap") return "Non mesurable · lacune";
  if (checkpoint && numeric(p?.sessions) != null && p.sessions < checkpoint)
    return "Non atteint";
  return "Non mesurable";
}
export function safeURL(value) {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
