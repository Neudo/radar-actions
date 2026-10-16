# Investment Radar V1 — forward testing personnel

Racine absolue : `/home/debian/.hermes/workspace/projects/investment-radar`.
Backend TypeScript/Fastify + PostgreSQL 17. SQL explicite via pg (pas d’ORM); migrations transactionnelles/versionnées dans migrations/. Aucun courtier, aucun ordre, aucune clé LLM supplémentaire. Le modèle OAuth Hermes effectue la recherche et la classification via un cron agent-driven **à créer par le parent**, le worker ne consulte jamais un LLM.

## État et démarrage

Services `api` et `db` Docker Compose avec restart unless-stopped, volume `investment-radar_postgres_data`. API publiée **uniquement 127.0.0.1:17845**; PostgreSQL:5432 réseau Docker interne, **aucun port hôte publié**. Caddy expose désormais uniquement HTTPS public sur `radar.vitalisite.com` (HTTP redirigé), avec authentification applicative existante. Voir `docs/HTTPS.md`. Ne pas ouvrir 17845 ou 5432 au pare-feu.

```sh
cd /home/debian/.hermes/workspace/projects/investment-radar
npm ci
npm run build
./scripts/compose.sh build api migrate worker
./scripts/compose.sh up -d db
./scripts/compose.sh run --rm -T migrate
./scripts/compose.sh up -d api
curl -fsS http://127.0.0.1:17845/health
./scripts/compose.sh ps
./scripts/integration.sh
./scripts/worker.sh
python3 scripts/backup.py
python3 scripts/restore-drill.py
```

Images de base épinglées par digest, dépendances npm package-lock et Python requirements-calendar.txt. Développement: `npm test` (intégration DB skip sans TEST_DATABASE_URL), `npm run build`. Test complet reproductible `scripts/integration.sh` crée et supprime une DB isolée radar_test_<timestamp>; exécute également le worker sur **OHLC EXPLICIT TEST FIXTURE** stockés en cache dans cette seule DB, pas des prédictions live. Il vérifie ingestion/concurrence/idempotence/409, authentification, refus mutations SQL UPDATE/DELETE/TRUNCATE, jours fériés et 30 observations, checkpoints, seuils et replay worker. Production interdit les fixtures à l’API et le worker exclut celles-ci.

## Secrets / authentification

Tous les secrets sont uniquement dans `/home/debian/.hermes/.env` (0600), jamais dans le projet : IR_DB_PASSWORD (owner migrations/backup), IR_APP_PASSWORD (rôle runtime radar_app non propriétaire), IR_API_KEY (écriture), IR_READ_KEY (lecture/dashboard). Compose construit DATABASE_URL en mémoire dans le conteneur et expose RADAR_API_KEY/RADAR_READ_KEY au processus. Noms dédiés pour ne pas écraser un DATABASE_URL/RADAR_API_KEY d’un autre projet. Le rôle runtime ne peut ni UPDATE/DELETE/TRUNCATE l’historique ni modifier des triggers ni approuver des splits. L’owner DB reste techniquement capable de désactiver un trigger: réserver son secret à l’administration.

Endpoints sauf /health exigent Bearer (lecture ou écriture); POST accepte seulement la clé écriture. Dashboard accepte aussi Basic: utilisateur `radar`, mot de passe IR_READ_KEY. Ne pas inscrire ce secret dans URL, arguments shell, fichiers exportés ou logs. Limite 120 requêtes/min/IP, 1MiB corps, validation Zod stricte, SQL paramétré, journaux Docker tournants et Authorization masquée.

Accès public protégé : `https://radar.vitalisite.com/dashboard` (voir `docs/HTTPS.md`). Solution de secours : tunnel SSH `ssh -L 17845:127.0.0.1:17845 <compte>@<vps>` puis navigateur `http://127.0.0.1:17845/dashboard`, Basic via clé lecture obtenue localement côté serveur sans partage dans un chat. Ne pas transmettre Basic sur HTTP public. API authentifiée: `python3 scripts/read-api.py /api/v1/radar/analytics` charge la clé côté serveur sans l’afficher.

## API

- GET /health: API/DB, dernier worker/status/erreurs, worker_stale au-delà de36h (n’indique pas qu’un cron existe).
- POST /api/v1/radar/runs: transaction atomique, clé quotidienne, 201 nouveau/200 replay identique/409 conflit immuable/400 invalide ou trop tard. Pas de création live après cutoff+15min; replay existant identique autorisé.
- GET /api/v1/radar/runs: run_key, limit, offset, include_fixtures.
- GET /api/v1/radar/signals: tag/ticker/sector/catalyst_type/exchange/from/to/active, limit <=500, offset; total exact et items paginés.
- GET /api/v1/radar/signals/:id: signal, observations, audits.
- GET /api/v1/radar/analytics: mêmes filtres métier, tous les résultats (pas seulement la page), global + quatre tags + devise.
- GET /api/v1/radar/watchlist: 20 identités permanentes.
- GET /dashboard: overview, quatre tags, historique filtrable et actifs, détails sources/risques/observations.

Contrat complet `docs/PAYLOAD.md` et `docs/run.schema.json`; spécifications originales conservées dans `docs/backend-spec.md` et `prompts/big-radar-original.md`.

## Flux quotidien

`python3 scripts/prepare.py` collecte les cours réels des20 sociétés et écrit un contexte figé `data/YYYY-MM-DD.context.json`. Ces données ne sont PAS des prédictions. Métadonnées de2–5 découvertes dans un JSON et `scripts/prepare-discoveries.py DATE fichier.json` produisent un contexte supplémentaire sans écraser le premier. `scripts/submit.py data/DATE.payload.json` fusionne les prix du contexte, envoie l’API puis vérifie par GET la totalité du payload. Le LLM ne fournit pas de nouveaux cours. Une recherche incomplète doit être signalée (ORANGE), jamais une fausse confiance. L’API conserve prix/tag/thèse/catalyseur/invalidation/rapport brut comme reçus, sans correction rétroactive. Aucun premier run live historique n’est créé pendant l’installation.

## Mesure déterministe

Jour du signal exclu intégralement, même si marché encore ouvert à17:45 Paris. J+1 = prochaine séance de la place; J+5/10/20/30 = clôtures de ces séances (pas jours calendaires). Calendriers exchange_calendars XNYS pour NYSE/Nasdaq et XPAR; une bougie n’est admissible qu’après clôture+1h. Des séances absentes/nulles gardent leur ordinal et bloquent les checkpoints suivants; pas de renumérotation ni de prix artificiel. TSM est l’ADR NYSE/USD, Europe Paris/EUR. Pas de FX, frais, dividendes ni total return; rendement brut de prix en devise native, groupes devises séparés.

Seuils +5/+9/+10: première séance où HIGH atteint chaque cible, et séparément première clôture atteinte. Max gain et min return utilisent HIGH/LOW. Drawdown clôture exact: minimum close / pic de clôture précédent (entrée incluse) -1, pas minimum / entrée. **OHLC ne permet pas de connaître l’ordre high/low intrajournalier**: fournir bornes optimistic/conservative et ne pas présenter une précision intrajournalière inventée. Calculs limités à30 séances, valeurs arrondies8 décimales.

Moyennes/médianes checkpoints: seuls signaux ayant réellement atteint ce checkpoint, n affiché. Taux cibles et gain/drawdown30, délai médian: dénominateurs30 séances matures seulement, pas backlog; zéro maturité =>null et non0%. Missing/quarantined exclu des statistiques de performance même si des observations partielles existent. Les counts/backlog restent visibles. Pas de signification statistique prétendue sur petits échantillons; comparer RED/ORANGE aux verts sans sélection des gagnants. Segmentation par entreprise, secteur, catalyseur, marché, période disponible; volatilité/régime macro détaillés backlog V2, contexte brut conservé.

## Worker / fiabilité

`scripts/worker.sh`: job ponctuel, lock advisory DB, lot50 équitable par calculated_at (évite starvation), signaux live et baseline valide seulement, cache durable30min par symbole/interval, timeout12s et3 retries jitter/backoff par requête. Le worker inscrit worker_runs; status ok/degraded/failed avec IDs/erreurs, code2 si dégradé. Après30 séances: completed et plus de collecte. Journaux `scripts/compose.sh logs api db`; historique métier worker_runs et data_conflicts. Health ne remplace pas un monitor externe. Pas de scheduler créé ici; scripts et prompts prêts, voir docs/CRON.md. Autonomie seulement après activation par le parent.

Les observations et réponses source sont append-only. Révision d’une OHLC déjà figée =>data_conflicts + quarantine, pas overwrite; une panne ne devient jamais RED. Split post-cutoff =>quarantine jusqu’à audit administratif. Voir docs/MARKET-DATA.md. Si API ou DB tombe: rapport doit déclarer stockage échoué; ne pas annoncer un succès ni livrer une fausse confirmation.

## Backup / restore

`scripts/backup.py`: pg_dump custom cohérent, 0600, fichier .partial puis rename, checksumSHA256/manifeste et pg_restore --list, rétention30jours, lock anti-recouvrement. Destination `data/backups/`; pas de secrets dans dump no-owner/no-acl. Données de recherche/rapports incluses: répertoire privé. `scripts/restore-drill.py [dump]`: vérifiechecksum, restaure --single-transaction --exit-on-error dans DB isolée puis counts réels et suppression de cette seuleDB. Un vrai restore drill a été exécuté. Sauvegardes locales seulement: choisir une réplication chiffrée horsVPS, sinon perteVPS=pertebackup.

Restauration sinistre: arrêter API/worker et jobs du projet, conserver volumeoriginal et faire dump si possible; sur DB neuve avec même stack restore `pg_restore -U radar_owner -d investment_radar --no-owner --no-acl --single-transaction --exit-on-error` via `compose exec -T db` stdin fichier. Ne pas faire --clean contre historique protégé. Pour conserver DBexistante: administrateur renomme investment_radar après fermeture des connexions, crée une DBvide investment_radar puis restaure (opération manuelle expressément validée). Exécuter migrate pour réattribuer droits runtime, redémarrer API, vérifier health/counts/immuabilité et rapport, réactiver les jobs seulement ensuite. Ne jamais employer compose down -v sans validation et sauvegarde horshôte.

## HTTPS / intégration externe

Accès déployé : `https://radar.vitalisite.com/dashboard`, utilisateur Basic `radar`, mot de passe `IR_READ_KEY` conservé exclusivement dans `~/.hermes/.env`. Caddy gère le certificat public, son renouvellement et la redirection HTTP→HTTPS ; `/health` reste privé (403 public). Authentification et `trustProxy=false` existants conservés. Configuration reproductible et vérification lecture seule : `docs/HTTPS.md`, `deploy/Caddyfile`, `scripts/verify-https.py`. Aucun cron ni worker réactivé. Une intégration externe utilise l’API HTTPS authentifiée, jamais SSH/DB/Docker/filesystem.

## Vérification et limites

Voir `docs/MARKET-DATA.md` pour le choix provisoire et les limites du feed, `docs/CRON.md` pour les modèles de planification. Les comptes rendus opérationnels, sorties de tests/probes, rapports, contextes et sauvegardes restent locaux et sont exclus du dépôt. La disponibilité du fournisseur et le droit de redistribution ne sont pas garantis.

Ce dépôt publie uniquement le socle existant, pas l’état privé du déploiement. La publication n’active aucun job : le quotidien et le worker existants restent en pause, la sauvegarde existante reste inchangée. La documentation de planification décrit des modèles, pas une autorisation d’activation. Les scripts d’exploitation conservent les chemins absolus du déploiement d’origine ; pour une autre machine, adapter ces chemins avant toute exécution.

Le fichier `.env.example` contient uniquement les noms des secrets avec des valeurs vides. Renseigner des valeurs fortes et distinctes exclusivement dans `~/.hermes/.env`, avec permissions 0600 ; ne jamais copier de secrets dans le projet. Les données runtime et les preuves locales ne sont pas nécessaires au build : `npm ci && npm run build`, puis `npm test` ou `scripts/integration.sh` pour la suite PostgreSQL isolée.
