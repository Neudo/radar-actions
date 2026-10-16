# Données de marché — sélection provisoire V1

## Sources primaires consultées (2 octobre 2026)

- Fastify validation: https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/
- PostgreSQL pg_dump: https://www.postgresql.org/docs/current/backup-dump.html
- Auteur des calendriers: https://github.com/gerrymanoim/exchange_calendars
- Yahoo Help données historiques/splits: https://help.yahoo.com/kb/sln2311.html
- Hermes cron: https://hermes-agent.nousresearch.com/docs/user-guide/features/cron

Les captures de consultation et sorties de probes sont des éléments locaux exclus du dépôt. Ces références documentent les choix techniques, pas une garantie de disponibilité future.

## Probe réel puis choix

Les réponses Yahoo, contextes figés et résultats de collecte restent privés dans la base et `data/`, sans publication. Un contexte de cours n’est PAS un run/prédiction. Le temps du signal est la fin d’une bougie 1 minute complète et strictement < cutoff, pas le timestamp d’ouverture d’une bougie future.

Source retenue **provisoirement pour recherche personnelle**, adaptateur `src/market.ts`: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=6mo&interval=1d&events=splits%2Cdiv`; préparation intraday range7d/interval1m. Cache30min et raw JSON+hash horodatés durables. Pas de clé payante requise. Les20 sont explicitement identifiés ticker/place/symbole fournisseur; NASDAQ/NYSE USD, Paris EUR; TSM ADR NYSE, Alphabet classeA GOOGL, TotalEnergies cotationParis.

**Ce endpoint Chart n’a PAS de contrat d’API développeur officiel ni de SLA.** La documentation Yahoo Help établit disponibilité d’historiques/splits dans son produit, pas un droit d’usage automatisé illimité, ni une garantie sur le endpoint. Le probe est validation technique ponctuelle, pas certification d’exactitude. Délais variables, restrictions/rate-limits, trous, corrections, historique minute court, distributions/dividendes, accès et conditions fournisseur peuvent évoluer. Aucune redistribution promise. Pour une exploitation fiable au sens contractuel, source licenciée avec couvertureUS/Europe à choisir par l’utilisateur. Pas de fallback automatique non audité qui changerait baseline/ajustements. La V1 dégrade explicitement, ne fabrique pas de donnée.

Calendriers exchange_calendars communautaires (version/transitifsépinglés), pas preuve d’absence de fermeture exceptionnelle. XNAS partage calendrierXNYS pour joursnormauxUS. Toute fermeture extraordinaire/suspension nécessite investigation: on garde la séance attendue manquante, pas de faux J30. Les séries quotidiennes limitées6mo ne permettront pas de reconstruire une longue panne au-delà de cette fenêtre : étatmissing et fournisseur historique licencié nécessaires.

## Ajustements / corporate actions

Entrée/prix d’origine figés. OHLC et close utilisés, pas adjclose dividend-adjusted. Rendementsprix bruts, dividendes/frais/FX exclus. Tout split connu POST cutoff bloque le traitement et crée workererror/quarantine. Rien n’est ajusté silencieusement.

Audit manuel owner seulement : vérifier auprès de l’IR/filing primaire le ratio/date ET vérifier comment le fournisseur a normalisé ses OHLC post-cutoff. Si le fournisseur exprime la série complète dans la dernière base split-adjusted, facteurcumule = produit(numerator/denominator) pour tous splits aprèscutoff. Fournir un JSON {signal_id, fetch_id, factor, reason, source, approved_by, normalized_post_cutoff_ohlc_confirmed:true}. Appeler administrativement:

```sh
./scripts/compose.sh run --rm -T migrate node dist/approve-split.js '<JSON audité sans secret>'
```

L’outil vérifie même symbole, eventhash exact, facteurcumule, source/reviewer/raison, stocke auditappend-only et relit la cible. Worker lie chaque nouvelle observation àauditid et facteur; OHLC multipliées dans base d’entrée, entrée jamaismodifiée. Si le fournisseur ne suit pas cette normalisation, NE PAS approuver: source correcte àintégrer. Autres opérations complexes (spin-off, fusion, delisting) : quarantaine/investigation, pas d’ajustement générique automatique. Nouvelle série split déjà approuvée ne doit pas altérer des observations figées; si elle les contredit, data_conflicts/quarantine. L’API runtime ne peut pas approuver les splits.

Drawdownclose est exact dans série clôtures. OHLC fournit deux bornes car ordrehaut/bas dansséance inconnu. Seuils intraday HIGH et close sont séparés, jamais confondus avec un trade exécuté. Le projet ne mesure ni fill ni spread ni performance d’un portefeuille.
