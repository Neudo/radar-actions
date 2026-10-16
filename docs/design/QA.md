# QA indépendante et déploiement — Carnet de conviction

**16 octobre 2026 · verdict : PASS pour le périmètre testé, déployé.**

URL : `https://radar.vitalisite.com/dashboard`. Authentification Basic existante : utilisateur `radar`, clé de lecture conservée dans `~/.hermes/.env` ; aucune nouvelle connexion ni clé distribuée. Version : commit contenant ce document (`git log -1`).

## Indépendance et décision

Cette passe est exécutée dans un contexte de revue distinct de l’implémentation. Lecture de UX-AUDIT, DIRECTION, IMPLEMENTATION et des références Reality Checker/Accessibility Auditor ; inspection directe du diff `src/app.ts` / intégration, de tous les assets du dashboard, de ses formateurs/tests et du packaging Docker. Les résultats du développeur n’ont pas été utilisés comme preuve de réussite : build, tests, navigateur et axe ont été réexécutés.

Aucun défaut applicatif bloquant reproduit. Pas de refonte supplémentaire ni de changement des calculs. Un écart d’outillage réel a été corrigé : `verify-https.py` exigeait encore l’ancien texte « Investment Radar » dans le HTML ; il vérifie désormais les marqueurs de la nouvelle interface et protège également les nouvelles routes/assets/endpoints en accès anonyme. Nouveau `scripts/design-release-smoke.cjs` : parcours HTTPS de production et test d’injection **exclusivement loopback**.

## Résultats réellement exécutés

| Contrôle | Résultat |
|---|---|
| `npm run build` | PASS TypeScript |
| `NODE_ENV=test npm test` | 34 PASS, 1 SKIP (intégration sans DB), 0 échec |
| `node --check src/dashboard/client.js`, `format.js` | PASS |
| `./scripts/compose.sh build api migrate && ./scripts/integration.sh` | 35 PASS, 0 SKIP, 0 échec ; vraie DB PostgreSQL jetable, supprimée ensuite |
| `node scripts/design-smoke.cjs` sur preview 17846 | 14 groupes PASS, 29 mesures sans débordement, 0 pageerror / refus CSP |
| `node scripts/design-accessibility.cjs` après fenêtre de rate limit | 8 vues Chromium, 0 violation axe ; focus 3 px solid, ratios rendus graphite/papier 14,12, texte secondaire/papier 5,37, graphite/citron 11,63 |
| `RADAR_RELEASE_URL=http://127.0.0.1:17846 node scripts/design-release-smoke.cjs --injection` | PASS : thèse, résumé de source, contexte et rapport brut hostiles restent du texte ; aucun élément img/script injecté, aucune exécution, URL javascript non liée |
| `python3 scripts/verify-https.py` après disponibilité API | PASS certificat/hostname HTTPS via DNS normal, HSTS, 11 routes anonymes à 401, mauvais identifiants 401, /health public 403 ; Basic et Bearer lisent 40 signaux |
| `node scripts/design-release-smoke.cjs` sur HTTPS public | PASS : cohorte réelle, recherche NVDA/nvda/Nvidia, qualification verte vide, pagination 25/15, tri global, fiche AAPL directe, source non datée, rapport réel, Bilan/Méthode ; 0 pageerror / refus CSP ; pas de débordement à 1440/390/320 |
| Provenance agents | 5 fichiers vendor + licence MIT : SHA-256 correspondent au manifeste ; aucun installateur exécuté |
| `git diff --cached --check -- . ':(exclude)agents/vendor/**'` | PASS sur le code et les adaptations ; les originaux vendor conservent leurs espaces de fin de ligne upstream pour préserver leurs SHA-256 |

Le navigateur preview vérifie également : filtre suivi/quarantaine, clavier recherche/fiche/retour, focus du tri conservé, URL directe et sélection conservée, validation dates, erreurs GET 401/400/429/500 et réessai **interceptés localement**, réponse ancienne retardée qui ne remplace pas une recherche récente. Le test PostgreSQL porte la pagination sur 76 fixtures isolées, recherche globale et analytics, `%` littéral, zéros, nulls/exclusions en fin et égalités stables. Aucun signal test n’est ingéré en production.

## Sécurité / données

- Hook d’auth global préservé, clé lecture limitée aux GET, aucun secret embarqué dans le client. `trustProxy=false`, rate limit, `no-store`, `nosniff`, `no-referrer` et CSP existante inchangés. Styles embarqués permis par la CSP, modules JS same-origin authentifiés ; aucun CDN. Lecture HTTPS finale : HTML et les trois assets (`dashboard.js`, `dashboard-format.js`, `dashboard.css`) byte-identiques aux sources revues ; CSP/no-store/nosniff vérifiés sur ces assets. Tous les fichiers staged ont été scannés contre les quatre vraies valeurs IR secrètes (aucune occurrence), sans afficher ces valeurs.
- Filtres SQL paramétrés ; tri allowlisté. Rapports/thèses/sources passent par `textContent`, liens limités à http/https sans userinfo ; ouverture externe `noopener noreferrer`. Test hostile navigateur complémentaire à la lecture du code.
- 40 signaux / 2 analyses, tous Orange ; 22 quarantaines, 18 suivis actifs, zéro maturité J30. Checkpoints : n=0, moyenne/médiane null. Les exclusions sont visibles avant ouverture et l’ancien rendement quarantiné n’est pas présenté comme admissible.
- Worker ancien/dégradé inchangé ; le dashboard ne prétend pas que la planification est active ou en pause sans contrat serveur. La pause est vérifiée séparément côté opérateur.

## Déploiement effectif

```sh
# Après les tests isolés, rebuild puis recréation de l’API seulement :
./scripts/compose.sh build api
./scripts/compose.sh up -d --no-deps --force-recreate api
# Attendre une vraie réponse de disponibilité, puis seulement :
curl --silent --fail http://127.0.0.1:17845/health -o /dev/null
python3 scripts/verify-https.py
node scripts/design-release-smoke.cjs
```

API Docker finale **healthy**, image `sha256:050e3807a96c434b94a0a8bb49457654069b81ffdc309e3a40ac0d2bb219778e`, filesystem read-only, port toujours `127.0.0.1:17845`. Aucune migration exécutée sur la production ; l’image `migrate` n’a servi qu’aux tests dans une base jetable. Aucun service worker lancé, aucun cron activé, aucun changement de Caddy ni du demo.

Comparaison avant/après via lectures SQL : comptes et digest MD5 du JSON de **toutes les lignes triées** de radar_runs (2), radar_signals (40), price_observations (40), signal_performance (40), worker_runs (172) **identiques**. Même conteneur DB `0c53136363b5c75c6047b7b7de9d22a1cb837740dbee8db062b5844866cc980b`, même volume `investment-radar_postgres_data`, aucun port hôte DB. SHA-256 de `/etc/caddy/Caddyfile` inchangé : `d9c199fd8e82c7a0d53de17fc0091947f0205db5bc1549c77e5136f8a0ddc24e`.

Cron `investment-radar-daily` et `investment-radar-worker` : `enabled=false`, `state=paused` avant et après. Backup et restore-drill restent scheduled comme avant. Preuves privées : `data/design/release-before.json` et `release-after.json`.

## Captures réellement examinées

Les PNG de preview desktop/mobile ont été ouverts avec vision, puis recadrés à taille lisible (les longues captures sont illisibles lorsqu’elles sont réduites entièrement). Les deux nouvelles captures HTTPS ont ensuite été ouvertes séparément : hiérarchie papier/graphite/citron, statut ancien/dégradé, exclusion AAPL et contenu mobile lisibles, aucun blocage visuel constaté.

- Preview : `data/design/after-desktop.png`, `after-mobile.png`, `after-detail-desktop.png`, `after-detail-mobile.png`, `after-bilan-desktop.png`, `after-bilan-mobile.png`, `after-method-desktop.png`.
- Production : `data/design/production-desktop.png` (1440×1000), `production-mobile.png` (390×1000), captures de viewport réelles.
- JSON : `implementation-browser.json`, `implementation-accessibility.json`, `qa-injection.json`, `production-browser.json`.

Toutes ces preuves restent ignorées, jamais committées : elles contiennent de la recherche privée, pas des secrets de connexion.

## Incidents et limites explicites

- Premier smoke HTTPS lancé immédiatement après recréation : **502 transitoire pendant le démarrage**. Après contrôle de disponibilité loopback, nouvelle exécution complète PASS, puis healthcheck Docker healthy. Ce déploiement n’est pas annoncé sans interruption.
- Nouveau harness : premiers essais API sans Bearer donnaient 401 (API ne propose pas de challenge Basic comme la page). Correction du harness en mémoire, pas de changement d’auth applicative ; injection et production ensuite PASS.
- **NOT TESTED** : lecteur d’écran NVDA/VoiceOver réel, Safari/Firefox, zoom natif via UI navigateur, forced-colors, chaque combinaison de filtres et panne de chaque région. Reflow 720/360 = largeur effective, pas preuve de zoom natif. Pas de certification WCAG.
- Conception retenue : fiche pleine page, pas split panel ; fallbacks locaux de police, pas fontes téléchargées. Différences déjà documentées, non bloquantes pour le parcours testé.
- Données métier toujours anciennes/dégradées et 22 quarantaines : la refonte n’y remédie pas et n’a pas relancé les collectes. Aucune performance future ou recommandation financière revendiquée.
- Pas de nouvelle dépense, dépendance applicative, service payant ou changement de fournisseur.
