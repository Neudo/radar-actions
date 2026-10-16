# Implémentation — Carnet de conviction

**16 octobre 2026 · relevé initial d’implémentation.** La revue indépendante et le déploiement ont ensuite été effectués : voir [QA.md](QA.md). Les mentions « pas déployé » ci-dessous décrivent l’état au moment de ce relevé, pas l’état actuel.

Refonte fonctionnelle sur Fastify/TypeScript existant, sans framework, dépendance applicative, migration de données, modification des calculs de performance, du worker, des tâches planifiées, de Caddy ou de l’authentification. Aucun commit/push/déploiement effectué. Le dashboard de production sert toujours l’ancienne interface ; vérification HTTP authentifiée effectuée après les tests. La planification n’a pas été réactivée.

## Livré

- Registre papier/graphite/citron, navigation Signaux / Bilan / Méthode ; filtre repliable et cartes sémantiques sur mobile, table sur desktop. Une seule représentation des résultats est montée à la fois.
- Recherche **globale PostgreSQL**, sous-chaîne littérale insensible à la casse sur société/ticker ; `%` et `_` ne sont pas des jokers utilisateur. NVDA, nvda et Nvidia retrouvent les deux vrais signaux NVDA. Filtres place/devise/secteur/catalyseur/suivi, données exploitables, période ; recherche et filtres conservés dans l’URL, partagés avec le bilan.
- Tri serveur allowlisté, pagination globale 25/50/100, id de départage déterministe ; performances manquantes/quarantainées toujours en fin dans les deux sens. Deux vues de colonnes, densité locale Confort/Compact.
- Fiches via `/dashboard/signaux/:id` : vraie route détail, thèse/catalyseur, risques et invalidation, sources à protocoles sûrs, publication inconnue explicite, prix/devise/horodatage, checkpoints, cibles, drawdown, observations conservées et contexte/rapport d’origine du run. Retour conserve sélection, position et focus ; URL directe fonctionnelle.
- Fiche **pleine page**, plutôt qu’un panneau latéral : défaut retenu pour ne pas comprimer simultanément le registre et les longues preuves. Aucun faux rôle modal ni piège de focus. Colonne de repères sur grand écran.
- Quarantaines identifiées avant ouverture ; ancien rendement supprimé des résultats admissibles. Les observations archivées restent consultables sous « Historique non exploitable », sans les réécrire. `null`, zéro réel, lacune et checkpoint non atteint restent distincts.
- Bilan avec n propre à chaque checkpoint, qualifications vides explicites, devises natives séparées, cibles +5/+9/+10 % en séance vs clôture, délais et dénominateurs J30 ; mesures détaillées repliables. Aucun graphique ni métrique décorative.
- Bandeau opérationnel alimenté par un endpoint lecture authentifié : dernier traitement dégradé/ancien, dates séparées analyse/observation/worker. **« Planification : état non exposé · activité inconnue »**, jamais pause/live déduit d’une vieille exécution.
- États de chargement, erreurs régionales et réessai ; résultats précédents signalés en cas d’échec. AbortController et garde après annulation empêchent une ancienne recherche de remplacer la nouvelle.
- Polices : fallbacks explicites `system-ui` et `Georgia`, sans téléchargement/CDN. Les familles souhaitées restent en tête de pile si disponibles localement ; aucun fichier de police dont la licence serait incertaine n’a été ajouté.

## Fichiers du lot

| Fichier | Responsabilité |
|---|---|
| `src/app.ts` | Extensions GET de recherche/filtres/tri, options, statut minimal, run par id, routes UI |
| `src/dashboard.ts` | Chargement des assets et injection des styles autorisés par la CSP existante |
| `src/dashboard/index.html` | Structure sémantique, formulaires, destinations et méthode |
| `src/dashboard/style.css` | Tokens, composants, responsive et focus |
| `src/dashboard/client.js` | Parcours réels, état URL/réseau, rendu sécurisé par textContent |
| `src/dashboard/format.js` | Formateurs d’affichage et règles d’exclusion, testés séparément |
| `tests/dashboard.test.ts` | Auth/structure, paramètres SQL, tri, validation et statut minimal |
| `tests/dashboard-format.test.ts` | Zéro/null/numeric strings/petite valeur, statut inconnu, URL et exclusions |
| `tests/integration.test.ts` | Contrats GET ajoutés à l’intégration PostgreSQL existante, 76 signaux **fixture** en base jetable |
| `scripts/design-preview.ts` | Serveur loopback de revue, sessions PostgreSQL `default_transaction_read_only=on`, clé d’écriture aléatoire non exposée |
| `scripts/design-smoke.cjs` | Captures et parcours navigateur réels, interceptions locales d’erreurs GET |
| `scripts/design-accessibility.cjs` | Axe et vérifications DOM/contrastes/focus sur la prévisualisation locale |
| `docs/design/IMPLEMENTATION.md` | Ce relevé reproductible |

Les fichiers d’audit/direction et `agents/` existaient non suivis avant ce lot. Ils ne sont pas des modifications de l’implémentation. Le manifeste et le lockfile applicatifs restent inchangés.

### Contrats lecture ajoutés

- `/api/v1/radar/signals` et `/analytics` acceptent `search`, `currency`, `tracking`, `eligible`, `sort`. Les filtres précédents restent compatibles. Dates inversées : 400.
- Ordres : `date_desc`, `date_asc`, `company_asc`, `tag_desc`, `return_desc`, `return_asc`, `j30_desc`, `j30_asc`. Qualification : double vert → vert → orange → rouge. Mesures exclues/nulles en fin.
- `/api/v1/radar/filter-options` : catégories réellement présentes dans les analyses live, pas déduites d’une page.
- `/api/v1/radar/status` : statut minimal authentifié, aucune liste d’erreurs/ids internes du worker. `/health` et ses protections existantes ne changent pas.
- `/api/v1/radar/runs/:id` : analyse d’origine pour la fiche.
- Analytics ajoute `analysis_count` et `tracking_counts` ; les formules existantes ne changent pas. Les données d’entrée manquantes sont également exclues des agrégats admissibles.
- Liste/détail ajoutent `last_observed_at`, tiré des observations (pas de `created_at` utilisé comme date de cours).

## Vérifications exécutées

### Tests avant correction

Les régressions recherche globale, tri, vue authentifiée ont d’abord échoué sur l’ancien code (3/3). Les tests de format ont d’abord échoué sur le module absent. Une régression supplémentaire a reproduit le style externe bloqué par la CSP ; correction par styles inline, **sans élargir la CSP**. Les tests navigateur ont ensuite reproduit le reset de formulaire masqué par son id, le débordement des filtres à 320 px, le min-content d’une fiche avec table, et la perte du focus au tri. Ces cas ont été corrigés puis réexécutés.

### Résultats finaux

| Commande / preuve | Résultat réel |
|---|---|
| `npm run build` | PASS TypeScript |
| `node --check src/dashboard/client.js` et `format.js` | PASS syntaxe JS |
| `NODE_ENV=test npm test` | **34 PASS, 1 SKIP**, 0 échec ; intégration délibérément ignorée hors DB de test |
| `./scripts/compose.sh build migrate && ./scripts/integration.sh` | **35 PASS, 0 SKIP, 0 échec**, PostgreSQL réel isolé ; calculs, immutabilité, précision, révisions/quarantaine et split existants conservés |
| `node scripts/design-smoke.cjs` | **14 groupes de vérifications PASS**, aucun pageerror ni refus CSP relevé |
| Dimensions navigateur | **29 mesures sans débordement de document** : 320/390/768/1024/1280/1920, points de contrôle 768–1440, filtres ouverts 320/390, reflow effectif 720/360 |
| `node scripts/design-accessibility.cjs` | Axe 4.10.3 : **8 vues** (4 parcours × desktop/mobile), **0 violation** sur les règles WCAG A/AA demandées |
| Contrôles/focus rendus | Champs, selects et boutons visibles activés mesurés à ≥44 px de hauteur ; focus 3 px solid vérifié |
| Contrastes tokens rendus | Graphite/papier 14,12 ; muted/papier 5,37 ; graphite/citron 11,63 ; focus/papier 6,05 ; contour/surface 4,20 ; Orange 5,16 ; Vert 6,20 ; Rouge 5,70 |
| `git diff --check` | PASS |
| Recherche des vraies valeurs de secrets dans les 12 fichiers code/tests/scripts du lot | PASS, aucune occurrence ; valeurs jamais imprimées |
| `git check-ignore` | Captures et JSON de preuve sous `data/design/` ignorés |

Le jeu PostgreSQL explicite de 76 fixtures teste deux pages 50/26 sans doublon, recherche société/ticker au-delà d’une page, analytics non limité à la page, échappement de `%`, égalités stables, zéro réel, nulls et quarantaine en fin pour les deux sens, exclusions et ventilation devise. Ces fixtures ne sont jamais ingérées en production.

Le navigateur vérifie les 40 signaux réels / 2 analyses / 0 mature J30, les 22 quarantaines, recherche NVDA/nvda/Nvidia, filtre de suivi, pagination, tri société et focus d’en-tête, dates invalides, fiche AAPL via clavier et lien direct, source non datée, retour à la sélection/focus, bilan n=0, rapport d’origine, 401/400/429/500 interceptés **localement** avec réessai, et réponse ancienne retardée. La preuve finale GET confirme toujours 18 suivis en cours, 22 quarantaines ; ces nombres sont des assertions de test de l’état audité, pas des constantes de l’application.

## Prévisualisation et reproduction

Depuis le dépôt :

```sh
npm run build
NODE_ENV=test npm exec -- tsx scripts/design-preview.ts
```

Le serveur reste en foreground avec cette commande. Pour le piloter avec un outil de processus, le lancer en background **silencieux**, puis vérifier sa santé séparément ; ne pas publier une notification à chaque redémarrage.

- Prévisualisation locale : `http://127.0.0.1:17846/dashboard`.
- Basic : utilisateur `radar`, clé de lecture existante chargée à l’exécution depuis `~/.hermes/.env`. Ne jamais la copier dans une commande, URL ou rapport.
- Port optionnel : `RADAR_PREVIEW_PORT`. L’accès DB est découvert via le conteneur existant ; script destiné à ce poste de revue, pas à un serveur de production générique.
- Vérification sans données privées affichées : `curl --silent --fail http://127.0.0.1:17846/health -o /dev/null`.
- Ne pas exposer ce port sur une interface publique. Arrêter avec SIGTERM/Ctrl-C après revue.
- La page réelle demeure disponible sur le port 17845 et n’a pas été remplacée.

Outillage navigateur disponible : Playwright Core installé sous le cache/outillage Hermes, Chromium headless en cache. Les scripts acceptent `PLAYWRIGHT_CORE_PATH` et `CHROMIUM_PATH` si l’emplacement change. Axe est seulement extrait sous le dossier ignoré, sans modifier les dépendances :

```sh
npm pack axe-core@4.10.3 --pack-destination data/design
tar -xzf data/design/axe-core-4.10.3.tgz -C data/design
node scripts/design-smoke.cjs
# Laisser passer la fenêtre du rate limit, plutôt que modifier la protection.
sleep 65
node scripts/design-accessibility.cjs
```

`RADAR_PREVIEW_URL` peut sélectionner un autre port loopback. Les scripts refusent un hôte distant pour les scénarios d’erreur. Aucune trace, HAR ou storageState avec authentification n’est enregistrée.

## Preuves visuelles privées

Toutes ignorées sous `data/design/`, jamais à ajouter au dépôt :

- `after-desktop.png` — 1440 × 1000, pleine page.
- `after-mobile.png` — 390 × 844, pleine page.
- `after-checkpoints-desktop.png`.
- `after-detail-desktop.png`, `after-detail-mobile.png`.
- `after-bilan-desktop.png`, `after-bilan-mobile.png`.
- `after-method-desktop.png`.
- Versions `*-viewport.png` pour examiner le premier écran sans réduction d’une très longue page.
- `implementation-browser.json` — résultats et largeurs.
- `implementation-accessibility.json` — scanner, contrôles, ratios et limites.

Captures desktop/mobile finales et bilan effectivement ouvertes via vision ; fiche desktop également examinée. Le responsive n’a pas été conclu à partir du CSS seul. Les captures baseline de l’audit restent présentes.

## Écarts / limites pour la QA indépendante

- **PAS TESTÉ :** lecteur d’écran réel (NVDA/VoiceOver), zoom natif par l’interface du navigateur et navigateurs autres que Chromium. Les largeurs effectives 720/360 testent le reflow, **pas** le zoom natif. Axe/DOM/clavier ne constituent pas un certificat WCAG.
- Les interceptions 401/400/429/500 couvrent le registre ; l’erreur détaillée de chaque autre région et chaque combinaison de filtres n’ont pas toutes été interceptées. L’application utilise le même mécanisme régional, sans prétendre que cela remplace ces essais.
- Le premier passage axe exécuté trop près du smoke a rencontré le rate limit du preview : suite réexécutée après la fenêtre et PASS. Aucune protection n’a été détendue. Les erreurs/fichiers d’itération privés ne sont pas les preuves finales.
- Fiche pleine page et polices fallback sont des choix délibérés. Le panneau split et les fontes embarquées ne sont pas livrés. Le libellé technique du type de catalyseur reste fidèle à la source ; pas de taxonomie inventée.
- La planification reste inconnue côté API. Le contexte opérateur indique des tâches en pause, mais l’interface ne l’affirme pas sans métadonnée serveur autorisée.
- Une revue indépendante doit encore autoriser la mise en production. Aucun résultat ici ne dispense du smoke HTTPS/auth après ce futur déploiement.
