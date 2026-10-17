import { useState, useEffect } from "react";
import { AccessibleSelect as Select } from "./lib/accessible-select";
import {
  CartesianGrid,
  XAxis,
  YAxis,
  LineChart,
  Line,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "./components/ui/chart";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import {
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "./components/ui/table";
import { evolution, levels, cohorts, invalid } from "./lib/charts";
import {
  day,
  dateTime,
  price,
  percent,
  tags,
} from "../src/dashboard/format.js";
const colors: Record<string, string> = {
  RED: "#9c3535",
  ORANGE: "#92501d",
  GREEN: "#28613f",
  DOUBLE_GREEN: "#17462b",
};
export function Evolution({ signal }: { signal: any }) {
  const [unit, setUnit] = useState("price");
  const [compact, setCompact] = useState(
    () => matchMedia("(max-width: 767px)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(max-width: 767px)");
    const change = () => setCompact(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const data = evolution(signal),
    refs = levels(signal),
    currency = signal.currency;
  const values = data.filter((d) => d.price !== null);
  return (
    <section className="chart-panel" aria-label="Évolution observée">
      <div className="section-heading">
        <div>
          <p className="eyebrow">LA TRAJECTOIRE / J0 → J30</p>
          <h2>Du signal aux observations</h2>
        </div>
      </div>
      {invalid(signal) ? (
        <div className="empty-chart">
          <strong>Courbe exclue · données non exploitables</strong>
          <p>
            La quarantaine, les données manquantes ou la recherche non évaluée
            ne sont jamais représentées comme une performance valide.
            L’historique brut reste consultable plus bas.
          </p>
        </div>
      ) : (
        <Tabs value={unit} onValueChange={setUnit}>
          <TabsList aria-label="Unité du graphique">
            <TabsTrigger value="price">Prix · {currency}</TabsTrigger>
            <TabsTrigger value="return_pct">Rendement · %</TabsTrigger>
          </TabsList>
          {["price", "return_pct"].map((key) => (
            <TabsContent value={key} key={key}>
              {values.length > 0 ? (
                <>
                  <ChartContainer
                    config={{
                      [key]: {
                        label:
                          key === "price"
                            ? `Clôture · ${currency}`
                            : "Rendement · %",
                        color: "#22231f",
                      },
                    }}
                    className="evolution-chart"
                    role="region"
                    aria-label={`Observations réelles en ${key === "price" ? currency : "pour cent"}`}
                  >
                    <LineChart
                      accessibilityLayer
                      data={data}
                      margin={{ top: 30, right: 25, left: 5, bottom: 10 }}
                    >
                      <CartesianGrid vertical={false} stroke="#d4d0c3" />
                      <XAxis
                        dataKey="j"
                        type="number"
                        domain={[0, Math.max(1, data.length - 1)]}
                        allowDecimals={false}
                        tickFormatter={(v) => `J${v}`}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        width={60}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) =>
                          new Intl.NumberFormat("fr-FR", {
                            maximumFractionDigits: 2,
                          }).format(v)
                        }
                      />
                      <ChartTooltip
                        position={compact ? { x: 0, y: 8 } : undefined}
                        content={
                          <ChartTooltipContent
                            className="observation-tooltip"
                            labelFormatter={(_, p) => {
                              const d = p?.[0]?.payload;
                              return (
                                <div>
                                  J{d?.j} · {day(d?.date)}
                                </div>
                              );
                            }}
                            formatter={(v, _n, item) => {
                              const d = item.payload;
                              return (
                                <div className="chart-tooltip-provenance">
                                  <strong>
                                    {key === "price"
                                      ? price(v, currency)
                                      : percent(v)}
                                  </strong>
                                  <span>
                                    {d.j === 0
                                      ? "Cotation J0 figée"
                                      : "Clôture de séance figée"}
                                  </span>
                                  <span>
                                    Observation : {dateTime(d.observed_at)}
                                  </span>
                                  <span>
                                    Source : {d.source || "Non renseignée"}
                                  </span>
                                  {d.fetched_at && (
                                    <span>
                                      Récupération : {dateTime(d.fetched_at)}
                                    </span>
                                  )}
                                </div>
                              );
                            }}
                          />
                        }
                      />
                      {key === "price" &&
                        refs.map((r, i) => (
                          <ReferenceLine
                            key={r.key + i}
                            y={r.value}
                            ifOverflow="extendDomain"
                            stroke={
                              r.key === "support"
                                ? "#28613f"
                                : r.key === "alert"
                                  ? "#62645b"
                                  : "#9c3535"
                            }
                            strokeDasharray="5 5"
                            label={{
                              value: r.label,
                              position: "insideTopLeft",
                              fontSize: 11,
                              fill: "#22231f",
                            }}
                          />
                        ))}
                      {key === "return_pct" && (
                        <ReferenceLine y={0} stroke="#7b7c70" />
                      )}
                      <Line
                        dataKey={key}
                        type="linear"
                        stroke="#22231f"
                        strokeWidth={2}
                        dot={{ r: 4, fill: "#dae65b", stroke: "#22231f" }}
                        activeDot={{ r: 6 }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ChartContainer>
                  <p className="sample-note">
                    {values.length} point(s) réellement conservé(s), J0 inclus ·{" "}
                    {currency}, sans conversion.{" "}
                    {values.length === 1
                      ? "J0 seul : aucune évolution ne peut encore être déduite."
                      : "Segments droits entre séances consécutives uniquement ; les lacunes interrompent la courbe."}{" "}
                    Aucun lissage ni interpolation de donnée manquante.
                  </p>
                </>
              ) : (
                <div className="empty-chart">
                  Aucune cotation exploitable. Aucun tracé inventé.
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
      {refs.length > 0 ? (
        <div className="level-legend">
          {refs.map((r, i) => (
            <p key={i}>
              <strong>{r.label}</strong> {price(r.value, currency)} ·{" "}
              {r.basis || "Justification non renseignée"}
            </p>
          ))}
        </div>
      ) : (
        <p className="sample-note">
          Niveaux absents ou autre cotation : aucune ligne de support, alerte ou
          invalidation superposée. Ni conversion FX ni niveau reconstruit.
        </p>
      )}
    </section>
  );
}
export function CohortChart({ analytics }: { analytics: any }) {
  const [checkpoint, setCheckpoint] = useState("30");
  const data = cohorts(analytics, Number(checkpoint));
  return (
    <section className="chart-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">LES COHORTES / DONNÉES ADMISSIBLES</p>
          <h2>Comparer, sans extrapoler</h2>
        </div>
        <div className="field">
          <label htmlFor="cohort-checkpoint">Point de contrôle</label>
          <Select value={checkpoint} onValueChange={setCheckpoint}>
            <SelectTrigger id="cohort-checkpoint">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 20, 30].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  J{n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {!data.length ? (
        <div className="empty-chart">
          <span className="folio">∅</span>
          <div>
            <h3>Échantillon insuffisant à J{checkpoint}</h3>
            <p>
              Aucun checkpoint admissible observé dans cette sélection. Aucune
              barre à zéro, aucune performance supposée pour les qualifications
              absentes.
            </p>
          </div>
        </div>
      ) : (
        <>
          <ChartContainer
            config={{ mean: { label: "Moyenne · %", color: "#22231f" } }}
            className="cohort-chart"
          >
            <BarChart
              accessibilityLayer
              data={data}
              margin={{ top: 20, right: 20, left: 5, bottom: 5 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis dataKey="tag" tickFormatter={(t) => (tags as any)[t]} />
              <YAxis unit=" %" />
              <ReferenceLine y={0} stroke="#7b7c70" />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, p) => {
                      const d = p?.[0]?.payload;
                      return `${(tags as any)[d?.tag]} · J${checkpoint} · n=${d?.n}`;
                    }}
                    formatter={(v, _n, item) => (
                      <div>
                        <strong>{percent(v)}</strong>
                        <p>
                          Médiane {percent(item.payload.median)} · n=
                          {item.payload.n}
                        </p>
                      </div>
                    )}
                  />
                }
              />
              <Bar
                dataKey="mean"
                isAnimationActive={false}
                radius={[3, 3, 0, 0]}
              >
                {data.map((d) => (
                  <Cell key={d.tag} fill={colors[d.tag]} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
          <p className="sample-note">
            Moyennes de signaux en devises natives, non pondérées ; pas un
            rendement de portefeuille. Chaque n est propre au checkpoint.
            Descriptif, ne prouve pas la performance future.
          </p>
        </>
      )}
      <Table>
        <TableCaption>
          Tableau accessible du graphique · J{checkpoint}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Qualification</TableHead>
            <TableHead>n admissible</TableHead>
            <TableHead>Moyenne</TableHead>
            <TableHead>Médiane</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(analytics.by_tag).map(([tag, g]: [string, any]) => {
            const c = g.checkpoints[checkpoint];
            return (
              <TableRow key={tag}>
                <TableCell>{(tags as any)[tag]}</TableCell>
                <TableCell>{c.n}</TableCell>
                <TableCell>
                  {!g.total
                    ? "Aucun signal"
                    : c.n
                      ? percent(c.mean)
                      : "Non calculable · n=0"}
                </TableCell>
                <TableCell>
                  {!g.total
                    ? "Aucun signal"
                    : c.n
                      ? percent(c.median)
                      : "Non calculable · n=0"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
