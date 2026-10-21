import React, { Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowLeft,
  SlidersHorizontal,
  ArrowRight,
  Activity,
  Search,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { AccessibleSelect as Select } from "./lib/accessible-select";
import { Card, CardContent } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./components/ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/ui/table";
import {
  day,
  dateTime,
  price,
  percent,
  tags,
  tracking,
  measure,
  safeURL,
} from "../src/dashboard/format.js";
import { invalid, number } from "./lib/charts";
const Evolution = lazy(() =>
  import("./charts").then((m) => ({ default: m.Evolution })),
);
const CohortChart = lazy(() =>
  import("./charts").then((m) => ({ default: m.CohortChart })),
);
import "./style.css";
const api = "/api/v1/radar/";
function useData(path: string | null) {
  const [value, setValue] = useState<any>(null),
    [error, setError] = useState<number | null>(null),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    const c = new AbortController();
    setLoading(true);
    setError(null);
    setValue(null);
    fetch(api + path, {
      signal: c.signal,
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then(async (r) => {
        if (!r.ok) throw Object.assign(new Error(), { status: r.status });
        return r.json();
      })
      .then((v) => {
        if (!c.signal.aborted) setValue(v);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.status || 500);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [path, retry]);
  return { value, error, loading, reload: () => setRetry((n) => n + 1) };
}
function ErrorState({ state }: { state: ReturnType<typeof useData> }) {
  return state.error ? (
    <div className="error-box" role="alert">
      <strong>
        {(
          {
            401: "Accès à renouveler. Rechargez la page pour renouveler l’authentification.",
            400: "Sélection invalide. Vérifiez les dates et les filtres.",
            404: "Élément introuvable.",
            429: "Trop de requêtes. Patientez avant de réessayer.",
          } as any
        )[state.error] || "Impossible de charger les données."}
      </strong>
      <p>Ce n’est pas un résultat vide.</p>
      <Button variant="outline" onClick={state.reload}>
        Réessayer
      </Button>
    </div>
  ) : state.loading ? (
    <p role="status" className="loading">
      Chargement du carnet…
    </p>
  ) : null;
}
function Qualification({ s }: { s: any }) {
  const unknown = s.payload?.assessment_status === "unknown";
  return (
    <Badge
      variant="outline"
      className={"qualification tag-" + (unknown ? "unknown" : s.tag)}
    >
      {unknown ? "Non évalué" : (tags as any)[s.tag] || "Non renseignée"}
    </Badge>
  );
}
function External({ url, children }: { url: any; children: React.ReactNode }) {
  const href = safeURL(url);
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children} <ArrowUpRight size={14} aria-label="Nouvel onglet" />
    </a>
  ) : (
    <span>{children} · lien non disponible</span>
  );
}
function Choice({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <Select
        value={value || "__all"}
        onValueChange={(v) => onChange(v === "__all" ? "" : v)}
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem value={v || "__all"} key={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function Trust() {
  const s = useData("status"),
    v = s.value,
    w = v?.last_worker;
  return (
    <aside className="trust">
      <Activity size={18} />
      <div>
        <strong id="trust-title">
          {s.error
            ? "État du suivi indisponible · fraîcheur inconnue"
            : !v
              ? "Vérification de l’état du suivi…"
              : (v.worker_stale
                  ? "Suivi ancien"
                  : "Dernier traitement enregistré") +
                " · " +
                ((
                  {
                    degraded: "dernier traitement dégradé",
                    failed: "traitement en échec",
                    running: "traitement en cours",
                    ok: "traitement terminé",
                    ok_with_exclusions: "suivi effectué avec exclusions",
                    pending_data:
                      "couverture vérifiée · données fournisseur en attente",
                    partial: "suivi partiel · nouvelle anomalie",
                  } as any
                )[w?.status] || "état non renseigné")}
        </strong>
        <p>
          État opérationnel ≠ validité des données. Les observations en
          quarantaine restent exclues.
          {w?.summary?.total != null &&
            ` ${w.summary.eligible} admissibles / ${w.summary.total} · ${w.summary.excluded} exclus · ${w.summary.new_failures} nouvelles anomalies · ${w.summary.unexpected_failures} erreurs inattendues · ${w.summary.pending_data ?? 0} en attente fournisseur · ${w.summary.selected} traités / ${w.summary.candidate_snapshot ?? "?"} à vérifier · ${w.summary.remaining} non vérifiés.`}
        </p>
      </div>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">État du suivi</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>État du suivi</DialogTitle>
            <DialogDescription>
              Vérification en lecture seule ; aucune relance des traitements.
            </DialogDescription>
          </DialogHeader>
          <ErrorState state={s} />
          {v && (
            <dl className="facts">
              <div>
                <dt>API / base</dt>
                <dd>Disponibles à la vérification</dd>
              </div>
              <div>
                <dt>Planification</dt>
                <dd>État non exposé par l’API · activité inconnue</dd>
              </div>
              <div>
                <dt>Dernier traitement</dt>
                <dd>
                  {dateTime(w?.finished_at)} · {w?.status || "Non renseigné"}
                </dd>
              </div>
              <div>
                <dt>Dernière analyse</dt>
                <dd>{day(v.last_analysis)}</dd>
              </div>
              <div>
                <dt>Dernière observation conservée</dt>
                <dd>
                  {dateTime(v.last_observation)} · peut appartenir à un signal
                  exclu
                </dd>
              </div>
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </aside>
  );
}
const sortOptions: [string, string][] = [
  ["date_desc", "Analyse récente"],
  ["date_asc", "Analyse ancienne"],
  ["company_asc", "Société A–Z"],
  ["tag_desc", "Qualification ↓"],
  ["return_desc", "Rendement ↓"],
  ["return_asc", "Rendement ↑"],
  ["j30_desc", "J30 ↓"],
  ["j30_asc", "J30 ↑"],
];
function Filters({
  params,
  update,
}: {
  params: URLSearchParams;
  update: (p: URLSearchParams) => void;
}) {
  const [draft, setDraft] = useState(Object.fromEntries(params)),
    [error, setError] = useState("");
  const opts = useData("filter-options");
  const [expanded, setExpanded] = useState(
    () => matchMedia("(min-width: 768px)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(min-width: 768px)");
    const change = () => setExpanded(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => setDraft(Object.fromEntries(params)), [params]);
  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const field = (key: string, label: string, options: [string, string][]) => (
    <Choice
      id={"filter-" + key}
      label={label}
      value={draft[key] || ""}
      onChange={(v) => set(key, v)}
      options={options}
    />
  );
  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) {
      setError("La date « Au » doit suivre la date « Du ».");
      return;
    }
    setError("");
    const p = new URLSearchParams();
    Object.entries(draft).forEach(([k, v]) => {
      if (v.trim() && k !== "offset") p.set(k, v.trim());
    });
    update(p);
  };
  return (
    <details
      className="filters-disclosure"
      open={expanded}
      onToggle={(e) => setExpanded(e.currentTarget.open)}
    >
      <summary className="mobile-filters-summary">
        Filtrer la sélection{" "}
        <span>
          {params.get("search") || params.get("tag") || "Tous les signaux"}
        </span>
      </summary>
      <form onSubmit={apply} className="filters">
        <div className="filter-main">
          <div className="field search-field">
            <label htmlFor="search">Rechercher une société ou un ticker</label>
            <div className="search-input">
              <Search size={17} />
              <Input
                type="search"
                id="search"
                name="search"
                placeholder="Société, ticker…"
                value={draft.search || ""}
                onChange={(e) => set("search", e.target.value)}
              />
            </div>
          </div>
          {field("tag", "Qualification", [
            ["", "Toutes"],
            ...(Object.entries(tags) as [string, string][]),
          ])}
          <div className="field">
            <label htmlFor="from">Du</label>
            <Input
              type="date"
              id="from"
              value={draft.from || ""}
              onChange={(e) => set("from", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="to">Au</label>
            <Input
              type="date"
              id="to"
              value={draft.to || ""}
              aria-invalid={!!error}
              aria-describedby="filter-error"
              onChange={(e) => set("to", e.target.value)}
            />
          </div>
          <Button type="submit">
            Appliquer <ArrowRight size={16} />
          </Button>
        </div>
        <details className="advanced-filters">
          <summary>
            <SlidersHorizontal size={16} /> Plus de filtres
          </summary>
          <div className="filter-grid">
            {(["exchange", "currency", "sector", "catalyst_type"] as const).map(
              (k) => (
                <React.Fragment key={k}>
                  {field(
                    k,
                    {
                      exchange: "Place",
                      currency: "Devise",
                      sector: "Secteur",
                      catalyst_type: "Catalyseur",
                    }[k],
                    [
                      ["", "Toutes"],
                      ...[
                        ...new Set([
                          ...(opts.value?.[k] || []),
                          ...(draft[k] ? [draft[k]] : []),
                        ]),
                      ].map((v) => [v, v] as [string, string]),
                    ],
                  )}
                </React.Fragment>
              ),
            )}
            {field("tracking", "État du suivi", [
              ["", "Tous"],
              ...[
                "pending",
                "pending_data",
                "active",
                "missing",
                "quarantined",
                "completed",
              ].map((v) => [v, tracking(v)] as [string, string]),
            ])}
            <label className="check">
              <input
                type="checkbox"
                checked={draft.eligible === "true"}
                onChange={(e) =>
                  set("eligible", e.target.checked ? "true" : "")
                }
              />{" "}
              Données exploitables uniquement
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={draft.active === "true"}
                onChange={(e) => set("active", e.target.checked ? "true" : "")}
              />{" "}
              Suivis non terminés
            </label>
          </div>
          {opts.error && (
            <p>
              Options indisponibles. Les filtres sélectionnés restent conservés.
            </p>
          )}
        </details>
        <div id="filter-error" role={error ? "alert" : undefined}>
          {error}
        </div>
        <div className="filter-bottom">
          <p className="sample-note">
            {[...params]
              .filter(([k]) => !["sort", "limit", "offset"].includes(k))
              .map(
                ([k, v]) =>
                  `${({ search: "Recherche", tag: "Qualification", from: "Du", to: "Au", currency: "Devise", tracking: "Suivi" } as any)[k] || k} : ${v}`,
              )
              .join(" · ") || "Toutes les analyses · aucun filtre appliqué"}
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setError("");
              update(new URLSearchParams());
            }}
          >
            Réinitialiser
          </Button>
        </div>
      </form>
    </details>
  );
}
function Register({
  params,
  update,
}: {
  params: URLSearchParams;
  update: (p: URLSearchParams) => void;
}) {
  const pageParams = new URLSearchParams(params);
  if (!pageParams.has("limit")) pageParams.set("limit", "50");
  const signals = useData("signals?" + pageParams),
    analytics = useData("analytics?" + params),
    [columns, setColumns] = useState("essential");
  const [density, setDensity] = useState(() => {
    try {
      return localStorage.getItem("radar-density") || "comfort";
    } catch {
      return "comfort";
    }
  });
  const { value: v } = signals,
    a = analytics.value;
  const offset = Number(params.get("offset") || 0),
    limit = Number(params.get("limit") || 50);
  useEffect(() => {
    if (!v) return;
    try {
      const raw = sessionStorage.getItem("radar-return");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.search !== location.search) return;
      const link = [
        ...document.querySelectorAll<HTMLAnchorElement>("[data-signal]"),
      ].find((el) => el.dataset.signal === saved.id);
      if (link) {
        link.focus({ preventScroll: true });
        window.scrollTo(0, Number(saved.y) || 0);
        sessionStorage.removeItem("radar-return");
      }
    } catch {}
  }, [v]);
  function change(k: string, v: string) {
    const p = new URLSearchParams(params);
    p.set(k, v);
    if (k !== "offset") p.delete("offset");
    update(p);
  }
  return (
    <>
      <div className="register-tools">
        <div
          className="column-switch"
          role="group"
          aria-label="Colonnes du registre"
        >
          <Button
            variant="ghost"
            aria-pressed={columns === "essential"}
            onClick={() => setColumns("essential")}
          >
            Essentiel
          </Button>
          <Button
            variant="ghost"
            aria-pressed={columns === "checkpoints"}
            onClick={() => setColumns("checkpoints")}
          >
            Points de contrôle
          </Button>
        </div>
        <div className="toolbar-choices">
          <Choice
            id="sort"
            label="Trier globalement"
            value={params.get("sort") || "date_desc"}
            onChange={(v) => change("sort", v)}
            options={sortOptions}
          />
          <Choice
            id="limit"
            label="Par page"
            value={String(limit)}
            onChange={(v) => change("limit", v)}
            options={["25", "50", "100"].map((v) => [v, v])}
          />
          <Choice
            id="density"
            label="Densité"
            value={density}
            onChange={(v) => {
              setDensity(v);
              try {
                localStorage.setItem("radar-density", v);
              } catch {}
            }}
            options={[
              ["comfort", "Confort"],
              ["compact", "Compact"],
            ]}
          />
        </div>
      </div>
      <p id="result-summary" className="result-summary" aria-live="polite">
        {v
          ? `${v.total} signaux dans cette sélection${a ? ` · ${a.analysis_count} analyses · ${a.overall.matured} matures J30 · ${a.measurement_counts?.eligible ?? "?"} admissibles · ${a.measurement_counts?.excluded ?? "?"} exclus · ${a.tracking_counts.quarantined} en quarantaine` : ""}`
          : "Chargement des signaux…"}
      </p>
      <ErrorState state={signals} />
      {analytics.error && <ErrorState state={analytics} />}
      <div
        id="rows"
        aria-busy={signals.loading}
        className={density === "compact" ? "compact" : ""}
      >
        {v &&
          (!v.items.length ? (
            <div className="empty-chart">
              <h2>
                {v.total
                  ? "Fin de la sélection"
                  : params.size
                    ? "Aucun signal pour ces filtres"
                    : "Aucune analyse enregistrée"}
              </h2>
              <p>Modifiez la sélection ou réinitialisez les filtres.</p>
            </div>
          ) : (
            <Table className="register-table">
              <TableCaption>
                Registre de recherche · rendements bruts en devise native. Les
                données exclues ne participent pas aux performances.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  {[
                    "Société",
                    "Qualification",
                    "Analyse",
                    ...(columns === "essential" ? ["Entrée"] : []),
                    "Suivi",
                    ...(columns === "essential"
                      ? ["Rendement observé"]
                      : ["J5", "J10", "J20", "J30"]),
                  ].map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {v.items.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell data-label="Société">
                      <a
                        className="identity"
                        data-signal={s.id}
                        onClick={() => {
                          try {
                            sessionStorage.setItem(
                              "radar-return",
                              JSON.stringify({
                                id: s.id,
                                y: scrollY,
                                search: location.search,
                              }),
                            );
                          } catch {}
                        }}
                        href={"/dashboard/signaux/" + s.id + "?" + params}
                      >
                        <strong>{s.ticker}</strong>
                        <span>{s.company}</span>
                      </a>
                      <small>
                        {s.exchange} · {s.currency}
                      </small>
                    </TableCell>
                    <TableCell data-label="Qualification">
                      <Qualification s={s} />
                    </TableCell>
                    <TableCell data-label="Analyse">
                      {day(s.run_date)}
                    </TableCell>
                    {columns === "essential" && (
                      <TableCell data-label="Entrée" className="number">
                        {price(s.signal_price, s.currency)}
                      </TableCell>
                    )}
                    <TableCell data-label="Suivi">
                      <span
                        className={
                          s.tracking_status === "quarantined"
                            ? "quarantine"
                            : ""
                        }
                      >
                        {tracking(s.tracking_status)}
                      </span>
                      {s.collection?.state === "pending_data" && (
                        <small>
                          Données attendues :{" "}
                          {s.collection.pending_sessions.join(", ")} · prochaine
                          tentative {dateTime(s.collection.next_retry_at)}
                        </small>
                      )}
                      <small>
                        {s.last_observed_at
                          ? "Observation : " + day(s.last_observed_at)
                          : "Observation non renseignée"}
                      </small>
                    </TableCell>
                    {(columns === "essential"
                      ? [undefined]
                      : [5, 10, 20, 30]
                    ).map((n, i) => (
                      <TableCell
                        key={i}
                        data-label={n ? "J" + n : "Rendement observé"}
                        className={"number " + (invalid(s) ? "excluded" : "")}
                      >
                        {measure(s, n)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ))}
      </div>
      {v && (
        <div className="pagination">
          <p id="page-summary">
            {v.total
              ? `${v.items.length ? offset + 1 : 0}–${offset + v.items.length} sur ${v.total} signaux`
              : "0 signal"}
          </p>
          <div>
            <Button
              variant="outline"
              disabled={offset === 0 || signals.loading}
              onClick={() =>
                change("offset", String(Math.max(0, offset - limit)))
              }
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              disabled={offset + limit >= v.total || signals.loading}
              onClick={() => change("offset", String(offset + limit))}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
      <a className="bilan-link" href={"/dashboard/bilan?" + params}>
        Examiner le bilan de cette sélection <ArrowUpRight size={16} />
      </a>
    </>
  );
}
function StatsTable({ g, label }: { g: any; label: string }) {
  return (
    <Table>
      <TableCaption>
        {label} · signaux, devises natives, non pondéré
      </TableCaption>
      <TableHeader>
        <TableRow>
          {["Point de contrôle", "Observés (n)", "Moyenne", "Médiane"].map(
            (h) => (
              <TableHead key={h}>{h}</TableHead>
            ),
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {[5, 10, 20, 30].map((n) => {
          const c = g.checkpoints[n];
          return (
            <TableRow key={n}>
              <TableCell>J{n}</TableCell>
              <TableCell>{c.n}</TableCell>
              <TableCell>
                {c.n ? percent(c.mean) : "Non calculable · n=0"}
              </TableCell>
              <TableCell>
                {c.n ? percent(c.median) : "Non calculable · n=0"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
function Bilan({ params }: { params: URLSearchParams }) {
  const s = useData("analytics?" + params),
    a = s.value;
  return (
    <div id="analytics">
      <ErrorState state={s} />
      {a && (
        <>
          <div className="analysis-notice">
            <span className="folio">
              {String(a.overall.matured).padStart(2, "0")}
            </span>
            <div>
              <h2>
                {a.overall.matured
                  ? "Signaux arrivés à J30"
                  : "Pas encore de résultat à J30"}
              </h2>
              <p>
                {a.overall.matured
                  ? `${a.overall.matured} signal(s) mature(s) sur ${a.overall.total}. Descriptif, ne prouve pas la performance future.`
                  : "Aucun signal n’a atteint J30 dans cette sélection. Les taux ne sont pas calculables."}
              </p>
            </div>
          </div>
          <p className="sample-note">
            {a.overall.total} signaux · {a.tracking_counts.quarantined} en
            quarantaine · {a.tracking_counts.missing} manquants ·{" "}
            {a.tracking_counts.active} en cours · {a.tracking_counts.pending} en
            attente. {a.unknown_count || 0} non évalué(s), hors cohortes par
            qualification.
          </p>
          <Suspense fallback={<p role="status">Chargement du graphique…</p>}>
            <CohortChart analytics={a} />
          </Suspense>
          <section>
            <h2>Points de contrôle</h2>
            <StatsTable g={a.overall} label="Ensemble de la sélection" />
          </section>
          <section>
            <h2>Devises natives</h2>
            <div className="two-column">
              {Object.entries(a.by_currency).map(([c, g]: [string, any]) => (
                <div key={c}>
                  <h3>
                    {c} · {g.overall.total} signaux
                  </h3>
                  <StatsTable g={g.overall} label={c} />
                </div>
              ))}
            </div>
          </section>
          <details className="trace">
            <summary>Mesures détaillées par qualification</summary>
            {Object.entries(a.by_tag).map(([t, g]: [string, any]) => (
              <section key={t}>
                <h3>
                  {(tags as any)[t]} · {g.total} signaux · {g.matured} matures
                </h3>
                <StatsTable g={g} label={(tags as any)[t]} />
                <Table>
                  <TableCaption>
                    Cibles · cohorte mature J30 uniquement, dénominateur
                    explicite
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      {[
                        "Cible",
                        "Éligibles J30",
                        "En séance",
                        "En clôture",
                        "Délai moyen en séance",
                        "Délai moyen en clôture",
                      ].map((h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[5, 9, 10].map((n) => {
                      const v = g.target_rates[n];
                      return (
                        <TableRow key={n}>
                          <TableCell>+{n} %</TableCell>
                          <TableCell>{v.denominator}</TableCell>
                          <TableCell>
                            {v.denominator
                              ? percent(v.intraday_pct)
                              : "Non calculable · n=0"}
                          </TableCell>
                          <TableCell>
                            {v.denominator
                              ? percent(v.close_pct)
                              : "Non calculable · n=0"}
                          </TableCell>
                          <TableCell>
                            {v.intraday_days.n
                              ? `${v.intraday_days.mean} séances · n=${v.intraday_days.n}`
                              : "Non calculable · n=0"}
                          </TableCell>
                          <TableCell>
                            {v.close_days.n
                              ? `${v.close_days.mean} séances · n=${v.close_days.n}`
                              : "Non calculable · n=0"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <p>
                  Drawdown moyen de clôture : {percent(g.drawdown.mean)} · n=
                  {g.drawdown.n}. Gain maximal moyen :{" "}
                  {percent(g.max_gain.mean)} · n={g.max_gain.n}.
                </p>
              </section>
            ))}
          </details>
        </>
      )}
    </div>
  );
}
function Observations({ s }: { s: any }) {
  return (
    <Table>
      <TableCaption>
        {invalid(s)
          ? "Historique non exploitable · conservé pour audit, exclu des performances"
          : "Observations figées · tableau accessible de la trajectoire"}
      </TableCaption>
      <TableHeader>
        <TableRow>
          {[
            "Séance",
            "J",
            "Clôture",
            "Rendement brut",
            "Observation",
            "Source / récupération",
          ].map((h) => (
            <TableHead key={h}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>{day(s.payload?.quote_at)}</TableCell>
          <TableCell>J0</TableCell>
          <TableCell>{price(s.signal_price, s.currency)}</TableCell>
          <TableCell>
            {number(s.signal_price) === null
              ? "Non mesurable"
              : invalid(s)
                ? "Exclu"
                : "0,00 % · référence"}
          </TableCell>
          <TableCell>{dateTime(s.payload?.quote_at)}</TableCell>
          <TableCell>
            <External url={s.payload?.quote_source}>Cotation J0</External>
          </TableCell>
        </TableRow>
        {(s.observations || []).map((o: any) => (
          <TableRow key={o.id || o.session}>
            <TableCell>{day(o.session)}</TableCell>
            <TableCell>J{o.trading_days_since_signal}</TableCell>
            <TableCell>{price(o.price, s.currency)}</TableCell>
            <TableCell>
              {invalid(s)
                ? "Exclu · valeur brute " + percent(o.performance_pct)
                : percent(o.performance_pct)}
            </TableCell>
            <TableCell>{dateTime(o.observed_at)}</TableCell>
            <TableCell>
              <External url={o.source}>
                {o.source
                  ? safeURL(o.source)
                    ? new URL(o.source).hostname
                    : "Source non exploitable"
                  : "Source non renseignée"}
              </External>
              <small>{dateTime(o.fetched_at)}</small>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
function RunReport({ id }: { id: string }) {
  const s = useData("runs/" + id);
  return (
    <>
      <ErrorState state={s} />
      {s.value && (
        <>
          <h3>Contexte de marché</h3>
          <p className="preserve-text">{s.value.market_context}</p>
          <h3>Rapport original figé</h3>
          <pre>{s.value.raw_report}</pre>
        </>
      )}
    </>
  );
}
function Detail({ id, params }: { id: string; params: URLSearchParams }) {
  const state = useData("signals/" + id),
    s = state.value,
    p = s?.payload;
  return (
    <div id="detail">
      <a className="back-link" href={"/dashboard?" + params}>
        <ArrowLeft size={16} /> Retour à la sélection
      </a>
      <ErrorState state={state} />
      {s && (
        <>
          <div className="detail-heading">
            <div>
              <p className="eyebrow">LA FICHE / {s.ticker}</p>
              <h1>{s.company}</h1>
              <p>
                {s.ticker} · {s.exchange} · {s.currency} · Analyse du{" "}
                {day(s.run_date)}
              </p>
            </div>
            <Qualification s={s} />
          </div>
          {invalid(s) && (
            <div className="exclusion-notice">
              <strong>
                {p.assessment_status === "unknown"
                  ? "Qualification inconnue : recherche insuffisante, pas un setup ORANGE."
                  : s.tracking_status === "quarantined"
                    ? "Performance exclue : intégrité ou source à vérifier."
                    : "Performance exclue : données manquantes."}
              </strong>
              <p>
                Les mesures conservées ne constituent pas une performance valide
                ; aucun tracé ni agrégat admissible.{" "}
                {s.tracking_error || s.source_data?.exclusion_reason}
              </p>
            </div>
          )}
          <section className="evidence-card">
            <h2>Admissibilité et révisions de source</h2>
            <p>
              {invalid(s)
                ? "Exclu des performances"
                : "Admissible aux mesures observées"}{" "}
              · politique {s.measurement_policy || "non renseignée"}.
            </p>
            <p>
              J0 et chaque observation restent figés. Aucune révision matérielle
              n’est automatiquement approuvée ; un retour du fournisseur au prix
              initial ne résout pas un conflit archivé.
            </p>
            <p>
              {s.revisions?.length ?? 0} version(s) de prix auditées. Les
              équivalences de précision conservent le prix initial ; les
              révisions matérielles ou ambiguës excluent le signal.
            </p>
            {!!s.revisions?.length && (
              <details>
                <summary>Consulter les versions et leur provenance</summary>
                {s.revisions.map((r: any) => (
                  <div key={r.id}>
                    <p>
                      {day(r.session)} · {r.classification} ·{" "}
                      {r.decision === "retain_frozen"
                        ? "prix initial conservé"
                        : "exclusion non résolue"}{" "}
                      · récupération {dateTime(r.fetched_at)}
                    </p>
                    <External url={r.source}>Source de la révision</External>
                    <pre>
                      {JSON.stringify(
                        {
                          observation_id: r.observation_id,
                          existing_hash: r.existing_hash,
                          revised_hash: r.new_hash,
                          revised_ohlc: r.ohlc,
                          provenance: r.provenance,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                ))}
              </details>
            )}
          </section>
          <div className="detail-layout">
            <article>
              <section>
                <h2>Pourquoi ce classement</h2>
                <p className="lead">
                  {p.catalyst_summary || "Catalyseur non renseigné"}
                </p>
                <p className="preserve-text">
                  {p.thesis || "Thèse non renseignée"}
                </p>
              </section>
              <section>
                <h2>Risques et invalidation</h2>
                <h3>Risques</h3>
                <p>{p.risks || "Non renseignés"}</p>
                <h3>Invalidation</h3>
                <p>{p.invalidation || "Non renseignée"}</p>
              </section>
              <section>
                <Card className="evidence-card">
                  <CardContent>
                    <h2>Support et zone d’alerte J0</h2>
                    {p.setup ? (
                      <>
                        <p>
                          {p.setup.listing.identifier} · {p.setup.listing.venue}{" "}
                          ·{" "}
                          {price(
                            p.setup.listing.quote_price,
                            p.setup.listing.currency,
                          )}{" "}
                          · {dateTime(p.setup.listing.quote_at)}
                        </p>
                        <External url={p.setup.listing.quote_source}>
                          Source de la cotation des niveaux
                        </External>
                        <dl className="facts">
                          {[
                            ["support", "Support documenté"],
                            ["alert", "Alerte · réanalyse seulement"],
                            [
                              "structural_invalidation",
                              "Invalidation structurelle",
                            ],
                          ].map(([k, l]) => (
                            <div key={k}>
                              <dt>{l}</dt>
                              <dd>
                                {p.setup[k]
                                  ? `${price(p.setup[k].low, p.setup.listing.currency)} – ${price(p.setup[k].high, p.setup.listing.currency)} · ${p.setup[k].basis}`
                                  : "Non déterminée"}
                              </dd>
                            </div>
                          ))}
                          <div>
                            <dt>Confirmations</dt>
                            <dd>
                              {p.setup.confirmations?.join(" · ") ||
                                "Non confirmées"}
                            </dd>
                          </div>
                          <div>
                            <dt>Trade Republic vérifié</dt>
                            <dd>
                              {p.setup.listing.trade_republic_verified
                                ? "Oui · voir sources"
                                : "Non établi"}
                            </dd>
                          </div>
                        </dl>
                        <p>{p.setup.technical_evidence}</p>
                        <p className="sample-note">
                          Niveaux figés. Alerte = nouvelle analyse, jamais
                          achat. Pas de surveillance temps réel ni notification
                          automatique.
                        </p>
                      </>
                    ) : (
                      <p>
                        Niveaux non renseignés dans ce signal d’origine ; aucun
                        niveau ajouté rétroactivement.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </section>
              <section>
                <h2>Sources et preuves</h2>
                {p.sources?.length ? (
                  <ol className="sources">
                    {p.sources.map((v: any, i: number) => (
                      <li key={i}>
                        <External url={v.url}>
                          {safeURL(v.url)
                            ? new URL(v.url).hostname
                            : "Source non exploitable"}
                        </External>
                        <p>{v.summary || "Résumé non renseigné"}</p>
                        <small>
                          {v.published_at
                            ? "Publication : " + dateTime(v.published_at)
                            : "Publication non établie · page index possible, pas une preuve temporelle forte"}
                        </small>
                        <small>Consultation : {dateTime(v.accessed_at)}</small>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>Aucune source enregistrée.</p>
                )}
              </section>
            </article>
            <aside className="detail-facts">
              <p className="eyebrow">LE POINT DE DÉPART</p>
              <p className="baseline-price">
                {price(s.signal_price, s.currency)}
              </p>
              <p>Cotation J0 figée · {dateTime(p.quote_at)}</p>
              <External url={p.quote_source}>Source du prix</External>
              <hr />
              <dl className="facts">
                <div>
                  <dt>Suivi</dt>
                  <dd>{tracking(s.tracking_status)}</dd>
                </div>
                <div>
                  <dt>Rendement observé</dt>
                  <dd>{measure(s, undefined)}</dd>
                </div>
                <div>
                  <dt>Objectif du signal</dt>
                  <dd>
                    {p.target_pct == null
                      ? "Aucun objectif chiffré"
                      : percent(p.target_pct)}
                  </dd>
                </div>
                <div>
                  <dt>Séances observées / restantes</dt>
                  <dd>
                    {s.performance?.sessions ?? "Non déterminé"} /{" "}
                    {s.performance?.sessions_remaining ?? "Non déterminé"}
                  </dd>
                </div>
                <div>
                  <dt>Cutoff de l’analyse</dt>
                  <dd>{dateTime(s.cutoff_at)}</dd>
                </div>
                <div>
                  <dt>État des données J0</dt>
                  <dd>
                    {s.data_status} · {p.data_reason || "Motif non renseigné"}
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
          <Suspense
            fallback={<p role="status">Chargement de la trajectoire…</p>}
          >
            <Evolution signal={s} />
          </Suspense>
          <section>
            <h2>Suivi à 30 séances</h2>
            <p className="sample-note">
              J0 exclu du décompte. Séances de la place, et non jours
              calendaires.
            </p>
            {invalid(s) ? (
              <details>
                <summary>Historique non exploitable · audit uniquement</summary>
                <Observations s={s} />
              </details>
            ) : (
              <Observations s={s} />
            )}
            <Table>
              <TableCaption>Points de contrôle du signal</TableCaption>
              <TableHeader>
                <TableRow>
                  {[5, 10, 20, 30].map((n) => (
                    <TableHead key={n}>J{n}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  {[5, 10, 20, 30].map((n) => (
                    <TableCell key={n}>{measure(s, n)}</TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </section>
          <section className="signal-metrics">
            <h2>Mesures observées et cibles</h2>
            <p className="sample-note">
              Mesures descriptives sur les séances contiguës conservées, pas un
              rendement de portefeuille. Une cible non atteinte n’est pas une
              promesse.
            </p>
            <dl className="facts two-column">
              {[
                ["Gain maximal en séance", "max_gain_pct"],
                ["Plus bas depuis J0", "min_return_pct"],
                ["Drawdown de clôture", "close_drawdown_pct"],
              ].map(([label, key]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {invalid(s)
                      ? "Exclu · données non exploitables"
                      : percent(s.performance?.[key])}
                  </dd>
                </div>
              ))}
              <div>
                <dt>Bornes de drawdown OHLC · ordre high/low inconnu</dt>
                <dd>
                  {invalid(s)
                    ? "Exclu · données non exploitables"
                    : s.performance?.ohlc_drawdown_bounds
                      ? `${percent(s.performance.ohlc_drawdown_bounds.optimistic_pct)} à ${percent(s.performance.ohlc_drawdown_bounds.conservative_pct)}`
                      : "Non mesurable"}
                </dd>
              </div>
            </dl>
            <Table>
              <TableCaption>
                Cibles du signal · délai en séances depuis J0, distinct en
                séance et en clôture
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Cible</TableHead>
                  <TableHead>Première atteinte en séance</TableHead>
                  <TableHead>Première atteinte en clôture</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[5, 9, 10].map((n) => (
                  <TableRow key={n}>
                    <TableCell>+{n} %</TableCell>
                    {["intraday_day", "close_day"].map((key) => (
                      <TableCell key={key}>
                        {invalid(s)
                          ? "Exclu"
                          : s.performance?.targets?.[n]?.[key] == null
                            ? "Non atteinte / non observée"
                            : `J${s.performance.targets[n][key]}`}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
          <details className="trace">
            <summary>Traçabilité et rapport original</summary>
            <dl className="facts">
              <div>
                <dt>Signal / analyse</dt>
                <dd>
                  {s.id} / {s.run_id}
                </dd>
              </div>
              <div>
                <dt>Erreur du suivi</dt>
                <dd>{s.tracking_error || "Aucune erreur renseignée"}</dd>
              </div>
              <div>
                <dt>Audits de split</dt>
                <dd>{s.audits?.length || 0}</dd>
              </div>
            </dl>
            {s.audits?.length > 0 && (
              <pre>{JSON.stringify(s.audits, null, 2)}</pre>
            )}
            <RunReport id={s.run_id} />
          </details>
        </>
      )}
    </div>
  );
}
function Method() {
  const [offset, setOffset] = useState(0),
    s = useData("runs?limit=10&offset=" + offset);
  return (
    <article className="method">
      <p className="eyebrow">LE PROTOCOLE / PREUVES AVANT CONVICTION</p>
      <h1>Méthode</h1>
      <p className="lead">Un journal de recherche, pas un carnet d’ordres.</p>
      <section>
        <h2>Ce que mesure ce carnet</h2>
        <p>
          Une analyse quotidienne fige sa thèse, sa qualification, ses sources
          et son cours de référence à J0. Le suivi déterministe conserve les
          clôtures des 30 séances suivantes. Aucune analyse ni observation
          historique n’est réécrite pour améliorer un résultat.
        </p>
        <p>
          Les prix et rendements restent en devise native, sans frais,
          dividendes ni conversion de change. Aucun rendement de portefeuille
          n’est calculé.
        </p>
      </section>
      <section>
        <h2>Les qualifications ne sont pas des rendements</h2>
        <dl className="facts">
          <div>
            <dt>Rouge</dt>
            <dd>Thèse défavorable ou invalidée, selon l’analyse figée.</dd>
          </div>
          <div>
            <dt>Orange</dt>
            <dd>
              Setup à surveiller, retour vers support ; pas un ordre d’achat.
            </dd>
          </div>
          <div>
            <dt>Vert / Double vert</dt>
            <dd>
              Setup documenté et confirmations selon la recherche J0. Ne
              garantit aucun gain.
            </dd>
          </div>
          <div>
            <dt>Non évalué</dt>
            <dd>
              Recherche insuffisante ; exclu des cohortes par qualification, pas
              assimilé à Orange.
            </dd>
          </div>
        </dl>
      </section>
      <section>
        <h2>Lire les graphiques sans se tromper</h2>
        <p>
          J0 est la cotation figée ; les autres points sont les observations
          conservées, pas des cours temps réel. Les segments sont droits, jamais
          lissés. Une séance manquante interrompt le tracé. Le tableau donne les
          valeurs et leur provenance. Support, alerte et invalidation ne sont
          superposés que pour la même cotation et devise.
        </p>
        <p>
          Chaque moyenne et médiane affiche son propre effectif n. Une absence
          n’est pas zéro. Les taux de cibles utilisent seulement les signaux
          matures J30 admissibles. La quarantaine et les données manquantes sont
          exclues. Les bornes intrajournalières OHLC ne sont pas un drawdown
          exact intraday.
        </p>
        <p>
          API disponible, planification active et données valides sont trois
          choses distinctes. La planification n’est pas exposée par l’API ;
          aucune pause ou activation n’est présumée.
        </p>
      </section>
      <section id="runs">
        <h2>Analyses originales</h2>
        <ErrorState state={s} />
        {s.value?.items.map((r: any) => (
          <details className="trace" key={r.id}>
            <summary>
              {day(r.run_date)} · {r.run_key}
            </summary>
            <p>{r.market_context}</p>
            <pre>{r.raw_report}</pre>
          </details>
        ))}
        {s.value && (
          <div className="pagination">
            <p>
              {offset + 1}–{offset + s.value.items.length} sur {s.value.total}{" "}
              analyses
            </p>
            <Button
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset((n) => Math.max(0, n - 10))}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              disabled={offset + 10 >= s.value.total}
              onClick={() => setOffset((n) => n + 10)}
            >
              Suivant
            </Button>
          </div>
        )}
      </section>
    </article>
  );
}
function App() {
  const [params, setParams] = useState(new URLSearchParams(location.search));
  const path = location.pathname;
  const detail = /\/(?:signaux|signals)\/([^/]+)$/.exec(path);
  const view = path.endsWith("/bilan")
    ? "bilan"
    : path.endsWith("/methode")
      ? "methode"
      : detail
        ? "detail"
        : "signaux";
  useEffect(() => {
    const pop = () => setParams(new URLSearchParams(location.search));
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  const update = (p: URLSearchParams) => {
    history.pushState({}, "", location.pathname + (p.size ? "?" + p : ""));
    setParams(p);
  };
  return (
    <>
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <header className="masthead">
        <a className="brand" href="/dashboard">
          <span className="brand-mark">R /</span>
          <span>
            Radar<small>Journal de recherche</small>
          </span>
        </a>
        <nav aria-label="Navigation principale">
          {[
            ["Signaux", "/dashboard", "signaux"],
            ["Bilan", "/dashboard/bilan", "bilan"],
            ["Méthode", "/dashboard/methode", "methode"],
          ].map(([label, href, v]) => (
            <a
              key={v}
              href={href + (params.size ? "?" + params : "")}
              aria-current={
                view === v || (view === "detail" && v === "signaux")
                  ? "page"
                  : undefined
              }
            >
              {label}
            </a>
          ))}
        </nav>
        <span className="masthead-note">CARNET DE CONVICTION</span>
      </header>
      <main id="main">
        <Trust />
        {(view === "signaux" || view === "bilan") && (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">
                  LE CARNET / {view === "bilan" ? "02" : "01"}
                </p>
                <h1>{view === "bilan" ? "Bilan" : "Signaux"}</h1>
                <p>
                  {params.get("from")
                    ? "Du " + day(params.get("from"))
                    : "Toutes les analyses"}
                  {params.get("to") ? " au " + day(params.get("to")) : ""}
                </p>
              </div>
              <p className="heading-note">
                La conviction se documente.
                <br />
                La performance se constate.
              </p>
            </div>
            <Filters params={params} update={update} />
          </>
        )}
        {view === "signaux" ? (
          <Register params={params} update={update} />
        ) : view === "bilan" ? (
          <Bilan params={params} />
        ) : view === "detail" ? (
          <Detail id={detail![1]} params={params} />
        ) : (
          <Method />
        )}
      </main>
      <footer>
        <span>R / Carnet de conviction</span>
        <p>
          Expérimentation personnelle · Aucun ordre ni recommandation
          d’investissement.
        </p>
        <a href="/dashboard/methode">
          Méthode et limites <ArrowUpRight size={14} />
        </a>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
