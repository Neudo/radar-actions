# Contrat d’ingestion V1

`POST /api/v1/radar/runs`, Authorization Bearer clé écriture. JSON strict, champs supplémentaires rejetés, 1 MiB maximum. Tous les champs ci-dessous sont obligatoires. Types des sources et des signaux définis en `src/core.ts` et export JSON Schema dans `docs/run.schema.json`.

Run: run_key (`daily:YYYY-MM-DD` pour live), run_date (date Paris), cutoff_at (ISO avec fuseau, exactement 17:45 Paris), generated_at (heure réelle ISO >=cutoff et <=cutoff+15min), run_type (`live`; `fixture` interdit sur API production), market_context (texte), raw_report (texte original), signals (20 watchlist + zéro ou 2–5 découvertes justifiées, max25).

Signal: ticker (ex: MC), exchange (XNAS/XNYS/XPAR), market_symbol (ex: MC.PA), company, sector, tag (RED/ORANGE/GREEN/DOUBLE_GREEN), signal_price (nombre positif ou null), currency (USD ou EUR), quote_at (ISO ou null), quote_source (URL ou null), data_status (verified/missing), data_reason (texte, peut être vide si vérifié), catalyst_type, catalyst_summary, thesis, risks, invalidation (textes non vides), target_pct (nombre 0–100 ou null), horizon_days (entier5–30), discovery_reason (texte ou null), sources (tableau, chaque élément {url, published_at: ISO ou null, accessed_at: ISO, summary: texte}).

`quote_at` est la fin de la dernière bougie minute terminée AVANT cutoff; prix ne peut dater de plus de 5 jours calendaires. Marchés fermés: dernière cotation valide avec heure explicite, pas un cours inventé. Cours manquant: prix/quote/source=null, ORANGE et data_reason obligatoire, aucune mesure avant baseline disponible (baseline jamais réécrite). GREEN exige au moins une source datée; une date de publication post-cutoff est rejetée pour tout tag.

Le helper submit remplace les champs de cours par les valeurs du contexte figé; ne jamais calculer de prix avec le LLM. Les découvertes doivent elles aussi posséder un contexte figé.

Même run_key + même payload canonique =>200 et même id. Première insertion =>201. Même clé + données différentes =>409. Un seul live par date, transaction atomique run+signaux. Les identités (ticker,exchange) ne peuvent être dupliquées. Cette immutabilité ne prouve pas la qualité des sources : contrôle éditorial chronologique reste indispensable.
