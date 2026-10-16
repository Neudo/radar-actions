import {
  tags,
  numeric,
  percent,
  price,
  day,
  dateTime,
  tracking,
  excluded,
  measure,
  safeURL,
} from "/dashboard-format.js";
const $ = (selector) => document.querySelector(selector);
const form = $("#filter");
const api = "/api/v1/radar/";
const jobs = new Map();
let params = new URLSearchParams(location.search);
let signals = null,
  analytics = null,
  detail = null,
  runOffset = 0,
  runs = [];
let view = "signals";
const mobile = matchMedia("(max-width: 767px)");
$("#filter-disclosure").open = !mobile.matches;
mobile.addEventListener("change", () => {
  $("#filter-disclosure").open = !mobile.matches;
});
const el = (tag, text, cls) => {
  const e = document.createElement(tag);
  if (text != null) e.textContent = String(text);
  if (cls) e.className = cls;
  return e;
};
function append(root, ...children) {
  root.append(...children.filter((x) => x != null));
  return root;
}
function text(root, value) {
  root.replaceChildren(el("p", value));
}
function badge(tag) {
  return el(
    "span",
    tags[tag] || "Non renseignée",
    "badge tag-" + (Object.hasOwn(tags, tag) ? tag : "unknown"),
  );
}
function link(label, href, cls) {
  const a = el("a", label, cls);
  a.href = href;
  return a;
}
function external(label, value) {
  const url = safeURL(value);
  if (!url) return el("span", label + " · lien non disponible");
  const a = link(label + " ↗", url);
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.setAttribute("aria-label", label + " (nouvel onglet)");
  return a;
}
function dl(entries) {
  const list = el("dl");
  for (const [k, v] of entries) {
    const item = el("div");
    append(
      item,
      el("dt", k),
      append(
        el("dd"),
        v instanceof Node
          ? v
          : document.createTextNode(String(v ?? "Non renseigné")),
      ),
    );
    list.append(item);
  }
  return list;
}
function table(caption, headers, rows) {
  const t = el("table", null, "data-table");
  t.append(el("caption", caption));
  const head = el("thead"),
    r = el("tr");
  headers.forEach((h, i) => {
    const c = el("th", h);
    c.scope = "col";
    if (i) c.className = "number";
    r.append(c);
  });
  head.append(r);
  t.append(head);
  const body = el("tbody");
  rows.forEach((row) => {
    const r = el("tr");
    row.forEach((value, i) => {
      const c = el(i ? "td" : "th", null, i ? "number" : null);
      if (!i) c.scope = "row";
      append(
        c,
        value instanceof Node
          ? value
          : document.createTextNode(String(value ?? "Non renseigné")),
      );
      r.append(c);
    });
    body.append(r);
  });
  t.append(body);
  return t;
}
function region(t, label) {
  const r = el("div", null, "table-region");
  r.tabIndex = 0;
  r.setAttribute("role", "region");
  r.setAttribute("aria-label", label + " · tableau défilant horizontalement");
  r.append(t);
  return r;
}
function errorBox(root, error, retry, hasPrevious = false) {
  const box = el("div", null, "error-box");
  box.setAttribute("role", "alert");
  const messages = {
    401: "Accès à renouveler. Rechargez la page pour renouveler l’authentification.",
    400: "Sélection invalide. Vérifiez les dates et les filtres.",
    404: "Cet élément n’a pas été trouvé.",
    429: "Trop de requêtes. Patientez avant de réessayer.",
  };
  append(
    box,
    el(
      "strong",
      messages[error.status] ||
        "Impossible de charger cette partie du journal.",
    ),
    el(
      "p",
      hasPrevious
        ? "Dernier résultat affiché, mise à jour échouée. Il ne correspond pas nécessairement aux filtres demandés."
        : "Les données ne sont pas disponibles. Ce n’est pas un résultat vide.",
    ),
  );
  const b = el("button", "Réessayer");
  b.type = "button";
  b.onclick = retry;
  box.append(b);
  root.replaceChildren(box);
}
async function request(path, signal) {
  const r = await fetch(api + path, {
    signal,
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!r.ok) {
    const e = new Error("HTTP " + r.status);
    e.status = r.status;
    throw e;
  }
  return r.json();
}
async function job(key, root, errorRoot, path, render, retry) {
  jobs.get(key)?.abort();
  const c = new AbortController();
  jobs.set(key, c);
  root.setAttribute("aria-busy", "true");
  errorRoot?.replaceChildren();
  try {
    const value = await request(path, c.signal);
    if (c.signal.aborted) return null;
    render(value);
    root.dataset.loaded = "true";
    return true;
  } catch (error) {
    if (error.name === "AbortError") return null;
    if (errorRoot)
      errorBox(errorRoot, error, retry, root.dataset.loaded === "true");
    return false;
  } finally {
    if (jobs.get(key) === c) root.setAttribute("aria-busy", "false");
  }
}
function query() {
  return params.toString() ? "?" + params : "";
}
function setLinks() {
  for (const a of document.querySelectorAll("[data-view]")) {
    const base = {
      signals: "/dashboard",
      analytics: "/dashboard/bilan",
      method: "/dashboard/methode",
    }[a.dataset.view];
    a.href = base + query();
    if (
      a.dataset.view === view ||
      (view === "detail" && a.dataset.view === "signals")
    )
      a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  $("#selection-bilan").href = "/dashboard/bilan" + query();
}
function syncForm() {
  for (const field of form.elements) {
    if (!field.name) continue;
    const value = params.get(field.name) ?? "";
    if (field.type === "checkbox") field.checked = value === "true";
    else {
      if (
        field.tagName === "SELECT" &&
        value &&
        ![...field.options].some((o) => o.value === value)
      )
        field.add(new Option(value, value));
      field.value = value;
    }
  }
  $("#sort").value = params.get("sort") || "date_desc";
  $("#limit").value = params.get("limit") || "50";
  const advanced = [
    "exchange",
    "currency",
    "sector",
    "catalyst_type",
    "tracking",
    "eligible",
    "active",
  ].some((k) => params.has(k));
  if (advanced) $("#more-filters").open = true;
  const labels = [];
  for (const field of form.elements) {
    if (!field.name || field.type === "submit") continue;
    const value = params.get(field.name);
    if (!value) continue;
    labels.push(
      field.type === "checkbox"
        ? field.labels[0].textContent.trim()
        : field.name === "search"
          ? "« " + value + " »"
          : field.type === "date"
            ? (field.name === "from" ? "Du " : "Au ") + day(value)
            : field.options?.[field.selectedIndex]?.text || value,
    );
  }
  $("#active-filters").textContent = labels.length
    ? labels.join(" · ")
    : "Aucun filtre appliqué";
  $("#mobile-filter-state").textContent = labels.length
    ? labels.length + " filtre(s) actif(s)"
    : "Tous les signaux";
  $("#scope").textContent =
    (params.get("from")
      ? "Du " + day(params.get("from"))
      : "Toutes les analyses") +
    (params.get("to") ? " au " + day(params.get("to")) : "") +
    (params.get("search") ? " · « " + params.get("search") + " »" : "");
  setLinks();
}
function saveParams(next) {
  params = next;
  history.pushState({}, "", location.pathname + query());
  syncForm();
  loadSelection();
}
function apply() {
  const data = new FormData(form),
    next = new URLSearchParams();
  if (data.get("from") && data.get("to") && data.get("from") > data.get("to")) {
    $("#filter-error").textContent =
      "La date « Au » doit suivre la date « Du ».";
    form.elements.to.setAttribute("aria-invalid", "true");
    form.elements.to.focus();
    return;
  }
  $("#filter-error").textContent = "";
  form.elements.to.removeAttribute("aria-invalid");
  for (const [k, v] of data)
    if (String(v).trim()) next.set(k, String(v).trim());
  next.set("sort", $("#sort").value);
  next.set("limit", $("#limit").value);
  saveParams(next);
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  apply();
});
$("#reset").onclick = () => {
  HTMLFormElement.prototype.reset.call(form);
  $("#filter-error").textContent = "";
  form.elements.to.removeAttribute("aria-invalid");
  saveParams(new URLSearchParams());
};
$("#sort").onchange = () => {
  const next = new URLSearchParams(params);
  next.set("sort", $("#sort").value);
  next.delete("offset");
  saveParams(next);
};
$("#limit").onchange = () => {
  const next = new URLSearchParams(params);
  next.set("limit", $("#limit").value);
  next.delete("offset");
  saveParams(next);
};
for (const [id, direction] of [
  ["prev", -1],
  ["next", 1],
])
  $("#" + id).onclick = () => {
    const next = new URLSearchParams(params);
    next.set(
      "offset",
      Math.max(
        0,
        Number(params.get("offset") || 0) +
          direction * Number(params.get("limit") || 50),
      ),
    );
    saveParams(next);
  };
$("#columns").onchange = () => renderSignals(signals);
try {
  $("#density").value =
    localStorage.getItem("radar-density") === "compact" ? "compact" : "comfort";
} catch {}
function density() {
  document.body.classList.toggle("compact", $("#density").value === "compact");
  try {
    localStorage.setItem("radar-density", $("#density").value);
  } catch {}
}
$("#density").onchange = density;
density();
mobile.addEventListener("change", () => signals && renderSignals(signals));
function identity(row) {
  const box = el("div", null, "identity");
  const a = mobile.matches
    ? el("strong", row.ticker)
    : link(row.ticker, "/dashboard/signaux/" + row.id + query());
  if (!mobile.matches) {
    a.dataset.signal = row.id;
    a.id = "signal-" + row.id;
  }
  a.append(el("small", row.company, "company"));
  append(box, a, el("small", row.exchange + " · " + row.currency, "place"));
  return box;
}
function follow(row) {
  const s = el("div", null, "tracking");
  append(
    s,
    el(
      "span",
      tracking(row.tracking_status),
      row.tracking_status === "quarantined" ? "quarantine" : null,
    ),
    el(
      "small",
      row.last_observed_at
        ? "Observation : " + day(row.last_observed_at)
        : "Observation non renseignée",
    ),
  );
  return s;
}
function measurement(row, checkpoint) {
  const value = measure(row, checkpoint),
    e = el(
      "span",
      value,
      excluded(row) || value.includes("Non ") ? "excluded" : "numeric-value",
    );
  if (checkpoint && value === "Non atteint")
    e.setAttribute(
      "aria-label",
      "J" +
        checkpoint +
        " : " +
        (row.performance?.sessions ?? "non renseigné") +
        " séance(s) observée(s) sur " +
        checkpoint +
        " · non atteint",
    );
  return e;
}
function sortHeader(label, sort, className) {
  const th = el("th", null, className);
  th.scope = "col";
  if (!sort) {
    th.textContent = label;
    return th;
  }
  const active = params.get("sort") || "date_desc";
  if (
    active === sort ||
    (sort === "date_desc" && active === "date_asc") ||
    (sort === "return_desc" && active === "return_asc") ||
    (sort === "j30_desc" && active === "j30_asc")
  )
    th.setAttribute(
      "aria-sort",
      active.endsWith("_asc") ? "ascending" : "descending",
    );
  const b = el(
    "button",
    label +
      (th.hasAttribute("aria-sort")
        ? active.endsWith("_asc")
          ? " ↑"
          : " ↓"
        : ""),
  );
  b.type = "button";
  b.setAttribute("aria-label", "Trier par " + label);
  b.onclick = () => {
    const next = new URLSearchParams(params);
    next.set(
      "sort",
      active === sort && ["date_desc", "return_desc", "j30_desc"].includes(sort)
        ? sort.replace("_desc", "_asc")
        : sort,
    );
    next.delete("offset");
    saveParams(next);
  };
  th.append(b);
  return th;
}
function selectionSummary(total) {
  const a = analytics;
  $("#result-summary").textContent =
    total +
    " " +
    (total === 1 ? "signal" : "signaux") +
    " dans cette sélection" +
    (a
      ? " · " +
        a.analysis_count +
        " analyses · " +
        a.overall.matured +
        " matures J30 · " +
        a.tracking_counts.quarantined +
        " en quarantaine"
      : "");
}
function renderSignals(value) {
  if (!value) return;
  signals = value;
  const { items, total } = value;
  const root = $("#rows");
  const active = document.activeElement;
  const focused = root.contains(active)
    ? { id: active.id, label: active.getAttribute("aria-label") }
    : null;
  const restoreFocus = () => {
    if (!focused) return;
    const target = focused.id
      ? document.getElementById(focused.id)
      : [...root.querySelectorAll("button")].find(
          (b) => b.getAttribute("aria-label") === focused.label,
        );
    target?.focus({ preventScroll: true });
  };
  root.replaceChildren();
  const offset = Number(params.get("offset") || 0),
    limit = Number(params.get("limit") || 50);
  selectionSummary(total);
  $("#page-summary").textContent = total
    ? (items.length ? offset + 1 : 0) +
      "–" +
      (offset + items.length) +
      " sur " +
      total +
      " signaux"
    : "0 signal";
  $("#prev").disabled = offset === 0;
  $("#next").disabled = offset + limit >= total;
  if (!items.length) {
    const box = el("div", null, "empty");
    append(
      box,
      el(
        "h3",
        total
          ? "Fin de la sélection"
          : [...params.keys()].some(
                (k) => !["sort", "limit", "offset"].includes(k),
              )
            ? "Aucun signal pour ces filtres"
            : "Aucune analyse enregistrée",
      ),
      el(
        "p",
        total
          ? "Revenez à la page précédente."
          : "Modifiez la recherche ou réinitialisez la sélection.",
      ),
    );
    const b = el("button", "Réinitialiser");
    b.onclick = () => $("#reset").click();
    box.append(b);
    root.append(box);
    return;
  }
  if (mobile.matches) {
    const list = el("ul", null, "signal-cards");
    for (const row of items) {
      const li = el("li", null, "signal-card");
      append(
        li,
        append(el("div", null, "card-heading"), identity(row), badge(row.tag)),
        dl([
          ["Analyse", day(row.run_date)],
          ["Entrée", price(row.signal_price, row.currency)],
          ["Suivi", follow(row)],
          ["Rendement observé", measurement(row)],
        ]),
      );
      const a = link(
        "Ouvrir le signal →",
        "/dashboard/signaux/" + row.id + query(),
        "open-signal",
      );
      a.dataset.signal = row.id;
      a.id = "signal-" + row.id;
      li.append(a);
      list.append(li);
    }
    root.append(list);
    restoreFocus();
    return;
  }
  const checkpoints = $("#columns").value === "checkpoints";
  const t = el("table", null, "register-table");
  t.append(
    el(
      "caption",
      "Signaux de recherche · rendements bruts en devise native ; les données manquantes et quarantainées sont exclues.",
    ),
  );
  const h = el("thead"),
    r = el("tr");
  append(
    r,
    sortHeader("Société", "company_asc"),
    sortHeader("Qualification", "tag_desc"),
    sortHeader("Analyse", "date_desc", "date-col"),
  );
  if (!checkpoints) r.append(sortHeader("Entrée", null, "number entry-col"));
  r.append(sortHeader("Suivi", null));
  if (checkpoints)
    for (const n of [5, 10, 20, 30])
      r.append(sortHeader("J" + n, n === 30 ? "j30_desc" : null, "number"));
  else r.append(sortHeader("Rendement observé", "return_desc", "number"));
  h.append(r);
  t.append(h);
  const body = el("tbody");
  for (const row of items) {
    const r = el("tr");
    const cells = [identity(row), badge(row.tag), day(row.run_date)];
    if (!checkpoints) cells.push(price(row.signal_price, row.currency));
    cells.push(follow(row));
    if (checkpoints)
      cells.push(...[5, 10, 20, 30].map((n) => measurement(row, n)));
    else cells.push(measurement(row));
    cells.forEach((value, i) => {
      const c = el(i ? "td" : "th");
      if (!i) c.scope = "row";
      if (i === 2) c.className = "date-col";
      if (!checkpoints && i === 3) c.className = "number entry-col";
      if (i >= (checkpoints ? 4 : 5)) c.className = "number";
      append(c, value instanceof Node ? value : document.createTextNode(value));
      r.append(c);
    });
    body.append(r);
  }
  t.append(body);
  root.append(t);
  restoreFocus();
}
function loadSignals() {
  $("#result-summary").textContent = signals
    ? "Mise à jour… Les lignes précédentes restent affichées."
    : "Chargement des signaux…";
  return job(
    "signals",
    $("#rows"),
    $("#signals-error"),
    "signals?" + params,
    renderSignals,
    loadSignals,
  );
}
const stat = (v) => (numeric(v) == null ? "Non calculable" : percent(v));
function checkpoints(group) {
  return table(
    "Moyennes et médianes · signaux, devises natives, non pondéré",
    ["Point de contrôle", "Observés (n)", "Moyenne", "Médiane"],
    [5, 10, 20, 30].map((n) => {
      const c = group.checkpoints[n];
      return [
        "J" + n,
        c.n,
        c.n ? stat(c.mean) : "Non calculable · n=0",
        c.n ? stat(c.median) : "Non calculable · n=0",
      ];
    }),
  );
}
function advanced(group, label) {
  const wrap = el("div");
  append(
    wrap,
    region(
      table(
        label + " · cibles sur cohorte mature J30 uniquement",
        [
          "Cible",
          "Éligibles J30",
          "Atteinte en séance",
          "Atteinte en clôture",
          "Délai moyen en séance",
          "Délai moyen en clôture",
        ],
        [5, 9, 10].map((n) => {
          const t = group.target_rates[n];
          return [
            "+" + n + " %",
            t.denominator,
            stat(t.intraday_pct),
            stat(t.close_pct),
            t.intraday_days.n
              ? String(t.intraday_days.mean) +
                " séances · n=" +
                t.intraday_days.n
              : "Non calculable · n=0",
            t.close_days.n
              ? String(t.close_days.mean) + " séances · n=" + t.close_days.n
              : "Non calculable · n=0",
          ];
        }),
      ),
      label + " : atteintes des cibles",
    ),
    el(
      "p",
      "Drawdown moyen de clôture : " +
        stat(group.drawdown.mean) +
        " · n=" +
        group.drawdown.n +
        " ; médiane : " +
        stat(group.drawdown.median) +
        ". Gain maximal moyen : " +
        stat(group.max_gain.mean) +
        " · n=" +
        group.max_gain.n +
        ".",
      "sample-note",
    ),
  );
  return wrap;
}
function renderAnalytics(value) {
  analytics = value;
  const root = $("#analytics");
  root.replaceChildren();
  const a = value.overall,
    counts = value.tracking_counts;
  if (view === "signals") {
    selectionSummary(a.total);
    return;
  }
  const notice = el("div", null, "analysis-notice");
  append(
    notice,
    el("span", String(a.matured).padStart(2, "0"), "folio"),
    append(
      el("div"),
      el(
        "h2",
        a.matured ? "Signaux arrivés à J30" : "Pas encore de résultat à J30",
      ),
      el(
        "p",
        a.matured
          ? a.matured +
              " signal(s) mature(s) sur " +
              a.total +
              ". Descriptif, ne prouve pas la performance future."
          : a.total
            ? "Aucun signal n’a atteint J30 dans cette sélection. Les taux ne sont pas calculables."
            : "Aucun signal dans cette sélection. Les taux ne sont pas calculables.",
      ),
    ),
  );
  root.append(notice);
  if (counts)
    root.append(
      el(
        "p",
        a.total +
          " signaux · " +
          counts.quarantined +
          " en quarantaine · " +
          counts.missing +
          " suivis avec données manquantes · " +
          counts.active +
          " suivis en cours · " +
          counts.pending +
          " en attente · " +
          counts.completed +
          " terminés. La maturité et l’état de suivi sont deux dimensions distinctes.",
        "sample-note",
      ),
    );
  const grid = el("div", null, "analysis-grid"),
    cp = el("section");
  append(
    cp,
    el("h2", "Points de contrôle"),
    region(checkpoints(a), "Points de contrôle"),
  );
  grid.append(cp);
  const comp = el("section");
  append(
    comp,
    el("h2", "Par qualification"),
    region(
      table(
        "Échantillons J30 · attente = total moins matures, exclusions incluses",
        ["Qualification", "Total", "Matures J30", "Attente", "Moyenne J30"],
        Object.entries(value.by_tag).map(([tag, g]) => [
          badge(tag),
          g.total,
          g.total ? g.matured : "Aucun signal",
          g.total ? g.backlog : "Aucun signal",
          g.total ? stat(g.checkpoints[30].mean) : "Aucun signal",
        ]),
      ),
      "Comparaison par qualification",
    ),
  );
  grid.append(comp);
  root.append(grid);
  const detailed = el("details"),
    summary = el("summary", "Mesures détaillées par qualification");
  detailed.append(summary);
  for (const [tag, g] of Object.entries(value.by_tag)) {
    if (!g.total) continue;
    append(
      detailed,
      el("h3", tags[tag] + " · " + g.total + " signaux", "currency-heading"),
      region(checkpoints(g), "Points de contrôle " + tags[tag]),
      advanced(g, tags[tag]),
    );
  }
  root.append(append(el("section", null, "analytics-section"), detailed));
  const currencies = el("section", null, "analytics-section");
  currencies.append(el("h2", "Devises natives, séparées"));
  for (const [currency, group] of Object.entries(value.by_currency)) {
    append(
      currencies,
      el(
        "h3",
        currency +
          " · " +
          group.overall.total +
          " signaux · " +
          group.overall.matured +
          " matures J30",
        "currency-heading",
      ),
    );
    if (group.overall.total)
      append(
        currencies,
        region(checkpoints(group.overall), "Points de contrôle " + currency),
        advanced(group.overall, currency),
      );
    else
      currencies.append(
        el("p", "Aucun signal dans cette devise.", "sample-note"),
      );
  }
  root.append(currencies);
  root.append(
    el(
      "p",
      "Aucune conversion ni pondération de portefeuille. Le nombre n est propre à chaque point de contrôle. Quarantaine et données manquantes exclues des performances.",
      "sample-note",
    ),
  );
  const all = el("details");
  all.append(
    el("summary", "Cibles et drawdown · sélection entière"),
    advanced(a, "Sélection entière"),
  );
  root.append(append(el("section", null, "analytics-section"), all));
}
function loadAnalytics() {
  return job(
    "analytics",
    $("#analytics"),
    $("#analytics-error"),
    "analytics?" + params,
    renderAnalytics,
    loadAnalytics,
  );
}
function loadSelection() {
  if (view === "signals") {
    analytics = null;
    loadSignals();
    loadAnalytics();
  }
  if (view === "analytics") loadAnalytics();
  setLinks();
}
function loadStatus() {
  return job(
    "status",
    $("#trust-body"),
    null,
    "status",
    (value) => {
      const worker = value.last_worker;
      $("#trust-title").textContent =
        (value.worker_stale
          ? "Suivi ancien"
          : "Dernier traitement enregistré") +
        " · " +
        ({
          degraded: "dernier traitement dégradé",
          failed: "dernier traitement en échec",
          running: "traitement en cours",
          ok: "dernier traitement terminé",
        }[worker?.status] || "état du traitement non renseigné");
      const root = $("#trust-body");
      root.replaceChildren();
      for (const [label, v] of [
        ["API / base", "Disponibles à la vérification"],
        ["Planification", "État non exposé · activité inconnue"],
        ["Dernier traitement", dateTime(worker?.finished_at)],
        ["Dernière analyse", day(value.last_analysis)],
        ["Dernière observation conservée", dateTime(value.last_observation)],
        [
          "Qualité des observations",
          "Les quarantaines restent exclues des performances",
        ],
      ])
        root.append(
          append(el("p"), el("strong", label), document.createTextNode(v)),
        );
    },
    () => loadStatus(),
  ).then((ok) => {
    if (ok === false) {
      $("#trust-title").textContent =
        "État du suivi indisponible · fraîcheur inconnue";
      const b = el("button", "Réessayer la vérification");
      b.onclick = loadStatus;
      $("#trust-body").replaceChildren(
        el("p", "Impossible de vérifier l’API et le traitement."),
        b,
      );
    }
  });
}
async function loadOptions() {
  try {
    const value = await request("filter-options");
    for (const [key, values] of Object.entries(value)) {
      const select = form.elements[key];
      if (!select) continue;
      const selected = params.get(key) || "";
      select.replaceChildren(
        new Option(
          key === "sector" || key === "catalyst_type" ? "Tous" : "Toutes",
          "",
        ),
      );
      for (const v of values) select.add(new Option(v, v));
      if (selected && !values.includes(selected))
        select.add(new Option(selected, selected));
      select.value = selected;
    }
  } catch {
    const p = el(
      "p",
      "Options de filtres indisponibles. Les filtres déjà sélectionnés restent conservés.",
      "error-text",
    );
    const b = el("button", "Réessayer les options");
    b.type = "button";
    b.onclick = () => {
      p.remove();
      loadOptions();
    };
    p.append(b);
    $("#more-filters").append(p);
  }
}
function section(title, ...children) {
  const s = el("section");
  s.append(el("h2", title), ...children);
  return s;
}
function renderDetail(row) {
  detail = row;
  const p = row.payload || {},
    perf = row.performance;
  const root = $("#detail");
  root.replaceChildren();
  $("#page-title").textContent = row.company;
  $("#eyebrow").textContent = "LA FICHE / " + row.ticker;
  $("#scope").textContent =
    row.ticker +
    " · " +
    row.exchange +
    " · " +
    row.currency +
    " · Analyse du " +
    day(row.run_date);
  $("#heading-note").textContent = "Recherche figée à la date d’analyse.";
  const top = el("div", null, "detail-top");
  const back = link(
    "← Retour à la sélection",
    "/dashboard" + query(),
    "back-link",
  );
  back.dataset.back = "true";
  append(top, back, badge(row.tag));
  root.append(top);
  if (excluded(row)) {
    const notice = el("div", null, "exclusion-notice");
    append(
      notice,
      el(
        "strong",
        row.tracking_status === "quarantined"
          ? "Performance exclue : révision d’une observation figée."
          : "Performance exclue : données manquantes.",
      ),
      el(
        "p",
        "Les mesures conservées ne constituent pas une performance validée. Elles ne participent pas aux agrégats ni au classement par rendement.",
      ),
    );
    root.append(notice);
  }
  const layout = el("div", null, "detail-layout"),
    prose = el("div", null, "detail-prose");
  append(
    prose,
    section(
      "Pourquoi ce classement",
      el("p", p.catalyst_summary || "Catalyseur non renseigné", "lead"),
      el("p", p.thesis || "Thèse non renseignée"),
    ),
    section("Risques", el("p", p.risks || "Non renseignés")),
    section("Invalidation", el("p", p.invalidation || "Non renseignée")),
  );
  const sources = el("ol", null, "sources");
  for (const source of p.sources || []) {
    const u = safeURL(source.url),
      li = el("li");
    append(
      li,
      external(u ? new URL(u).hostname : "Source non exploitable", source.url),
      el("p", source.summary || "Résumé non renseigné"),
      el(
        "div",
        source.published_at
          ? "Publication : " + dateTime(source.published_at)
          : "Publication non établie · page index possible, pas une preuve temporelle forte",
        "source-date",
      ),
      el(
        "div",
        "Consultation : " + dateTime(source.accessed_at),
        "source-date",
      ),
    );
    sources.append(li);
  }
  prose.append(
    section(
      "Sources",
      sources.children.length ? sources : el("p", "Aucune source enregistrée."),
    ),
  );
  const followSection = section("Suivi à 30 séances");
  followSection.append(
    el(
      "p",
      tracking(row.tracking_status) +
        " · " +
        (numeric(perf?.sessions) != null
          ? perf.sessions + " séance(s) contiguë(s) observée(s)"
          : "Nombre de séances non déterminé") +
        " · " +
        (numeric(perf?.sessions_remaining) != null
          ? perf.sessions_remaining + " restante(s)"
          : "Séances restantes : non déterminées") +
        ".",
      "sample-note",
    ),
  );
  followSection.append(
    region(
      table(
        "Points de contrôle · séances de la place, J0 exclu",
        ["Point", "Rendement"],
        [5, 10, 20, 30].map((n) => ["J" + n, measurement(row, n)]),
      ),
      "Points de contrôle du signal",
    ),
  );
  if (!excluded(row) && perf) {
    followSection.append(
      dl([
        ["Dernière clôture observée", price(perf.current_price, row.currency)],
        ["Rendement observé", measurement(row)],
        ["Gain maximal en séance", percent(perf.max_gain_pct)],
        ["Drawdown exact en clôture", percent(perf.close_drawdown_pct)],
        [
          "Bornes drawdown OHLC",
          percent(perf.ohlc_drawdown_bounds?.conservative_pct) +
            " à " +
            percent(perf.ohlc_drawdown_bounds?.optimistic_pct) +
            " · trajectoire intrajournalière non connue",
        ],
      ]),
    );
    followSection.append(
      region(
        table(
          "Atteintes individuelles, distinctes des taux de cohorte",
          ["Cible", "En séance", "En clôture"],
          [5, 9, 10].map((n) => {
            const t = perf.targets?.[n];
            return [
              "+" + n + " %",
              t?.intraday_day != null
                ? "J" + t.intraday_day
                : perf.matured
                  ? "Non atteinte"
                  : "Non établie à ce stade",
              t?.close_day != null
                ? "J" + t.close_day
                : perf.matured
                  ? "Non atteinte"
                  : "Non établie à ce stade",
            ];
          }),
        ),
        "Atteintes individuelles",
      ),
    );
  }
  const observations = el("details");
  observations.append(
    el(
      "summary",
      excluded(row)
        ? "Historique non exploitable · observations conservées"
        : "Observations et provenance",
    ),
  );
  if (excluded(row))
    observations.append(
      el(
        "p",
        "Historique non exploitable. Les rendements ci-dessous sont des valeurs archivées, exclues du bilan.",
      ),
    );
  if (row.observations?.length) {
    observations.append(
      region(
        table(
          "Séance distincte de l’heure d’observation ; enregistrement affiché séparément",
          [
            "Séance",
            "Point",
            "Observation",
            "Clôture",
            "Rendement archivé",
            "Enregistrement",
          ],
          row.observations.map((o) => [
            day(o.session),
            "J" + o.trading_days_since_signal,
            dateTime(o.observed_at),
            price(o.price, row.currency),
            percent(o.performance_pct),
            dateTime(o.created_at),
          ]),
        ),
        "Historique des observations",
      ),
    );
  } else observations.append(el("p", "Aucune observation enregistrée."));
  followSection.append(observations);
  prose.append(followSection);
  const trace = el("details", null, "trace");
  trace.append(el("summary", "Traçabilité et analyse d’origine"));
  trace.append(
    dl([
      ["Analyse (run)", row.run_id],
      ["Date limite de recherche", dateTime(row.cutoff_at)],
      [
        "Cours d’entrée, précision conservée",
        row.signal_price == null
          ? "Non renseigné"
          : row.signal_price + " " + row.currency,
      ],
      ["Motif de suivi", row.tracking_error || "Aucun motif enregistré"],
      [
        "Qualité du cours d’entrée",
        p.data_status === "verified"
          ? "Vérifié à l’ingestion"
          : p.data_status === "missing"
            ? "Manquant"
            : "Non renseignée",
      ],
      ["Raison de qualité", p.data_reason || "Non renseignée"],
    ]),
  );
  trace.append(el("h3", "Audits de split"));
  if (row.audits?.length) {
    for (const audit of row.audits)
      trace.append(el("pre", JSON.stringify(audit, null, 2)));
  } else trace.append(el("p", "Aucun audit de split enregistré."));
  const run = el("div");
  run.id = "linked-run";
  run.append(el("p", "Chargement du contexte de l’analyse…"));
  trace.append(run);
  prose.append(trace);
  layout.append(prose);
  const aside = el("aside", null, "detail-aside");
  append(
    aside,
    el("h2", "Repères de l’analyse"),
    dl([
      ["Cours d’entrée", price(row.signal_price, row.currency)],
      ["Horodatage du cours d’entrée", dateTime(p.quote_at)],
      [
        "Source du cours",
        p.quote_source
          ? external("Consulter la source", p.quote_source)
          : "Non renseignée",
      ],
      [
        "Objectif de la thèse",
        numeric(p.target_pct) == null
          ? "Aucun objectif chiffré"
          : percent(p.target_pct),
      ],
      [
        "Horizon de recherche",
        p.horizon_days != null ? p.horizon_days + " séances" : "Non renseigné",
      ],
      ["Secteur", row.sector],
      ["Type de catalyseur", row.catalyst_type],
      ["Dernière observation conservée", dateTime(row.last_observed_at)],
    ]),
    el("h2", "À lire avec la thèse"),
    el(
      "p",
      "La qualification décrit la recherche, pas un ordre. Une source sans publication établie ne prouve pas la date d’un catalyseur.",
      "meta",
    ),
  );
  layout.append(aside);
  root.append(layout);
  const heading = $("#page-title");
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  job(
    "linked-run",
    run,
    run,
    "runs/" + row.run_id,
    (value) => {
      run.replaceChildren(
        section(
          "Contexte d’origine",
          el("p", value.market_context || "Non renseigné"),
        ),
        el("h3", "Rapport figé"),
        el("pre", value.raw_report || "Non renseigné"),
      );
    },
    () => loadDetail(row.id),
  );
}
function loadDetail(id) {
  return job(
    "detail",
    $("#detail"),
    $("#detail-error"),
    "signals/" + id,
    renderDetail,
    () => loadDetail(id),
  );
}
function loadRuns(reset = false) {
  if (reset) {
    runOffset = 0;
    runs = [];
  }
  return job(
    "runs",
    $("#runs"),
    $("#runs-error"),
    "runs?limit=10&offset=" + runOffset,
    (value) => {
      runs.push(...value.items);
      $("#runs").replaceChildren();
      for (const r of runs) {
        const d = el("details"),
          s = el("summary");
        append(s, el("strong", day(r.run_date)), el("span", r.run_key, "meta"));
        append(
          d,
          s,
          dl([
            ["Date limite", dateTime(r.cutoff_at)],
            ["Génération", dateTime(r.generated_at)],
          ]),
          el("p", r.market_context),
          el("pre", r.raw_report),
        );
        $("#runs").append(d);
      }
      if (!runs.length) text($("#runs"), "Aucune analyse enregistrée.");
      runOffset = runs.length;
      $("#more-runs").hidden = runOffset >= value.total;
    },
    () => loadRuns(false),
  );
}
$("#more-runs").onclick = () => loadRuns();
function route() {
  for (const c of jobs.values()) c.abort();
  const path = location.pathname;
  view =
    path === "/dashboard/bilan"
      ? "analytics"
      : path === "/dashboard/methode"
        ? "method"
        : path.startsWith("/dashboard/signaux/")
          ? "detail"
          : "signals";
  for (const [key, id] of [
    ["signals", "signals-view"],
    ["analytics", "analytics-view"],
    ["method", "method-view"],
    ["detail", "detail-view"],
  ])
    $("#" + id).hidden = key !== view;
  $("#selection").hidden = !["signals", "analytics"].includes(view);
  const title = {
    signals: "Signaux",
    analytics: "Bilan",
    method: "La méthode",
    detail: "Signal",
  }[view];
  $("#page-title").textContent = title;
  document.title = title + " — Radar";
  $("#eyebrow").textContent = {
    signals: "LE REGISTRE / 01",
    analytics: "LE BILAN / 02",
    method: "LES PRINCIPES / 03",
    detail: "LA FICHE",
  }[view];
  $("#heading-note").textContent =
    view === "analytics"
      ? "Mesurer sans confondre absence et résultat."
      : "Une qualification de recherche. Une thèse figée.";
  syncForm();
  loadStatus();
  if (view === "detail") {
    detail = null;
    $("#detail").replaceChildren(el("p", "Chargement du signal…", "loading"));
    delete $("#detail").dataset.loaded;
    loadDetail(path.split("/").at(-1));
  } else if (view === "method") loadRuns(true);
  else loadSelection();
}
function navigate(href, state = {}) {
  history.pushState(state, "", href);
  params = new URLSearchParams(location.search);
  window.scrollTo(0, 0);
  route();
}
document.addEventListener("click", (event) => {
  const a = event.target.closest("a");
  if (
    !a ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    a.target === "_blank" ||
    a.origin !== location.origin ||
    !a.pathname.startsWith("/dashboard") ||
    a.hash
  )
    return;
  event.preventDefault();
  if (a.dataset.back && history.state?.fromSelection) {
    history.back();
    return;
  }
  if (a.dataset.signal) {
    history.replaceState(
      {
        ...history.state,
        focus: "signal-" + a.dataset.signal,
        scroll: scrollY,
      },
      "",
    );
    navigate(a.href, { fromSelection: true });
    return;
  }
  navigate(a.href);
  $("#page-title").tabIndex = -1;
  $("#page-title").focus({ preventScroll: true });
});
window.addEventListener("popstate", () => {
  params = new URLSearchParams(location.search);
  route();
  const state = history.state;
  setTimeout(() => {
    if (state?.focus)
      document.getElementById(state.focus)?.focus({ preventScroll: true });
    window.scrollTo(0, state?.scroll || 0);
  }, 200);
});
route();
loadOptions();
