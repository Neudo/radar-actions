# Audit UX/UI — Investment Radar

**Date : 16 octobre 2026. Périmètre : audit et conception uniquement.** Aucun changement du code applicatif, des données, du worker ou des planifications ; aucun commit ni déploiement. Base inspectée : `2d037c3774246ee8f18ea0dc054ee31c37ca6bfb`.

## Verdict

Le produit possède un backend de forward testing plus rigoureux que son interface. L'écran actuel ressemble à une console de contrôle provisoire : il expose les données mais n'aide pas encore à déterminer **ce qui est exploitable, ce qui manque et pourquoi**. La priorité n'est ni une courbe de marché ni une rangée de KPI : c'est un registre de recherche lisible, avec une qualification fiable des données, puis une fiche de preuve.

**Blocages avant toute promesse de suivi actualisé :**
- Le dernier worker observé est `degraded`, terminé le **6 octobre 2026 à 06:27:33 UTC** ; `worker_stale=true`. API/DB disponibles ne signifient pas suivi opérationnel.
- Le contexte de mission confirme quotidien et worker **en pause**. L'API actuelle ne fournit pas cet état de planification : ne pas le déduire d'un worker ancien.
- Les 40 signaux historiques sont ORANGE ; aucune comparaison empirique entre couleurs n'est possible. Zéro maturité J30, zéro observation exploitable aux checkpoints J5/J10/J20/J30 : aucun taux ou rendement de cohorte à inventer.
- 22 lignes sont en quarantaine. Le tableau montre pourtant leur ancien rendement comme celui des 18 lignes actives, sans avertissement individuel assez clair. L'analytics les exclut correctement : désaccord de présentation, pas demande de modifier le calcul.

La direction exécutable est décrite dans `DIRECTION.md`.

## 1. Méthode et preuves

### Inspection du code et des contrats

- `src/app.ts:13–51` : filtres exacts, pagination ; `:53–58` : liste et interface intégrées dans deux chaînes HTML/JS ; `:119–138` : santé ; `:157–250` : routes lecture ; `:252–257` : dashboard.
- `src/core.ts:48–112` : calcul sur séances contiguës ; `:114–188` : agrégations et dénominateurs ; `:192–223` : contenu de recherche ; `README.md:53–65` : interprétation des mesures.
- Documentation lue : `README.md`, `docs/PAYLOAD.md`, `docs/CRON.md`, `.gitignore`, `package.json`. Aucun framework UI n'est présent dans le manifeste : Fastify sert la page et `/dashboard.js` directement.

### Navigateur réel, pas seulement audit de code

Chromium headless via **Playwright Core 1.61.1**, dashboard HTTPS réel avec Basic `radar`, secret lu uniquement en mémoire depuis `~/.hermes/.env`. Pas de secret dans les URL, captures, traces ou exports. Aucun stockage de session/har activé.

Preuves privées, **toutes sous `data/design/` déjà ignoré par Git** :

| Preuve | Contenu |
|---|---|
| `baseline-desktop.png` | Page complète, viewport 1440 × 1000 |
| `baseline-mobile.png` | Page complète, viewport 390 × 844 |
| `baseline-detail-desktop.png` | Après ouverture du premier signal |
| `baseline-detail-mobile.png` | Après ouverture du premier signal sur mobile |
| `browser-evidence.json` | Texte rendu, largeur, contrôles, recherche, pagination, erreurs JS, santé locale |
| `signals.json`, `analytics.json`, `runs.json` | Réponses GET authentifiées réelles, sans en-têtes |
| `signal-detail.json` | Vraie route détail avec observations et audits |
| `audit-browser.cjs` | Script de capture ; charge le secret à l'exécution, aucune valeur embarquée |

Les captures desktop et mobile ont été **ouvertes visuellement**. Résultat mesuré : largeur document **1440 px pour 1440 px desktop**, mais **1047 px pour 390 px mobile**. Pas de `pageerror` pendant les parcours observés. Cela ne vaut pas audit complet de conformité ni test de tous les cas d'erreur réseau.

### État de données constaté

| Élément | Réponse observée |
|---|---|
| Runs | 2 : 3 et 4 octobre 2026 |
| Signaux | 40, tous ORANGE |
| Suivi | 22 `quarantined`, 18 `active` |
| Cohorte J30 | 0 mature ; backlog 40 |
| Checkpoints J5/J10/J20/J30 | `n=0`, moyenne et médiane `null` |
| Dernière exécution worker | 6 octobre 2026, dégradée, révisions de données figées/quarantaine |
| API/DB | `ok` via santé locale ; `/health` public est volontairement protégé |

Exemple concret : AAPL du 4 octobre est en quarantaine, avec un ancien rendement partiel retourné par l'API. Ses sources incluent une page index dont `published_at=null` et sa thèse dit explicitement « ORANGE de qualité de recherche, non signal positif ». L'interface doit rendre ces nuances sans obliger à lire un JSON. Il ne faut ni corriger rétrospectivement cette recherche ni présenter cette page index comme catalyseur validé.

## 2. Audit priorisé

Sévérité : **P0** = confiance/interprétation ; **P1** = parcours principal bloqué ou très dégradé ; **P2** = clarté/efficacité. Les constats « observés » sont reproduits ; les risques de code sont identifiés comme tels.

| ID | Priorité / preuve | Constat et impact | Correction de conception |
|---|---|---|---|
| U01 | P0 observé + code | Aucun état pause/dégradation/fraîcheur visible en tête. Le lecteur voit 40 signaux sans savoir que la collecte n'avance plus. | Bandeau persistant séparant API, worker, planification et date des données ; ne jamais afficher « temps réel ». |
| U02 | P0 observé | Rendements partiels de lignes quarantinées présentés comme les autres ; `quarantined` n'explique ni exclusion ni cause. | Masquer leurs mesures de performance dans la liste (« Exclu · quarantaine »). Fiche : observations historiques explicitement non exploitables, motif et audit. |
| U03 | P0 observé | `—%` est utilisé partout sans distinguer checkpoint non atteint, cohorte vide et donnée invalide. | Distinguer « Non atteint », « Non mesurable », « Exclu », « Aucun signal ». Afficher `n` et dénominateur propres à chaque statistique. |
| U04 | P1 mesuré | Document mobile de 1047 px dans 390 px ; les colonnes partent hors écran et l'écran n'a pas de vraie composition mobile. | Registre empilé sous 768 px ; comparaison avancée dans un conteneur horizontal nommé, jamais débordement du document. |
| U05 | P1 observé | Clic AAPL écrit le JSON à la fin de 40 lignes ; aucun focus/défilement vers une fiche. Les sources ne sont pas des liens éditoriaux. | Fiche ouvrable par lien stable, structurée thèse/catalyseur/risques/invalidation/sources/suivi. Retour au signal et contexte de filtre conservés. |
| U06 | P1 reproduit | Chercher `NVDA` donne 2 lignes ; `nvda` donne un tableau vide sans explication. `ticker`, secteur et catalyseur sont des égalités exactes. | Vrai champ société/ticker insensible à la casse, suggestions ; filtres à valeurs présentes. Nécessite contrat recherche explicite, pas faux filtrage d'une seule page. |
| U07 | P1 code + visuel | Aucun tri ; société, place, catalyseur et checkpoints absents de la liste malgré leur présence dans les données. | Priorité identité/qualité/date/performance admissible ; tri serveur déterministe, sélecteur mobile et boutons d'en-tête. |
| U08 | P1 observé | Champs sans labels visibles, dates sans « Du/Au », placeholders comme seules indications ; contrôle Actifs seuls ambigu, car quarantaine incluse. | Labels permanents ; statut de suivi explicite. Distinguer « Suivi non terminé » de « Données exploitables ». |
| U09 | P2 observé | Prix d'entrée chaîne décimale très longue, comptes `40.00`, séances `29.00`, nombres alignés à gauche. | Formateurs par type, `fr-FR`, nombres tabulaires alignés à droite ; précision de stockage inchangée. |
| U10 | P2 observé | Comparaison 4 tags × 12 colonnes, dont trois groupes vides, avant le registre utile. | Liste en premier ; bilan secondaire avec état « comparaison indisponible » et effectifs explicites. |
| U11 | P2 observé | Bleu nuit uniforme, inputs blancs natifs et boutons minuscules ; pas de hiérarchie sémantique ORANGE/suivi/performance. | Fond papier, texte graphite, citron réservé aux actions, badges signaux sémantiques et statut de données indépendant. |
| U12 | P1 risque confirmé au code | `Promise.all` + `alert` : une panne empêche tout rafraîchissement ; absence de loading/erreur locale ; appels simultanés sans annulation. | États de chargement et erreurs par région, conserver dernier résultat avec date/avertissement, AbortController et garde de séquence. À reproduire par tests interceptés, pas panne production. |
| U13 | P2 observé + code | Tableau sans caption/theads structurés ni scope ; mise à jour non annoncée ; détail sans gestion du focus. | Tableau HTML sémantique, aria-sort, résumé aria-live poli, focus visible et retour au déclencheur. |
| U14 | P2 observé | « Tag », « Backlog », « intraday », `active` et `quarantined` mêlent français et jargon/API. | Glossaire français stable, identifiants API seulement dans export technique. |

### Ce qui fonctionne et doit rester

- Authentification lecture distincte ; secret absent du JS client ; politique no-store et génération des cellules par `textContent`.
- Valeurs `null` non transformées en zéro par l'analytics ; exclusions `missing/quarantined` déjà en place.
- Pagination **correctement désactivée aux deux extrémités** pour les 40 lignes (50 par page) : pas de faux bug à corriger.
- Les filtres métier sont appliqués à toute la cohorte analytics, pas uniquement à la page affichée.
- Avertissement expérimental et méthode forward testing ; garder la précision méthodologique, réduire sa masse visuelle par divulgation progressive.

## 3. Recherche visuelle vérifiée

Références = matériaux de conception, **pas preuves d'utilisabilité, rendements ou recommandations financières**. Images téléchargées et ouvertes via vision ; copies privées de recherche, ne pas intégrer aux assets de production.

### A. Dribbble — NFS / Spreadsheet Table View, Patryk Ilnicki

Page réellement ouverte dans Chromium ; titre, texte et URL d'image enregistrés dans `data/design/dribbble-verified.json`. Il s'agit d'un outil finance/administration interne présenté par son designer, avec un écran « People », pas d'un tableau de cours de Bourse.[8]

**Vu dans l'image** : navigation compacte en haut, barre d'outils dédiée (colonnes/groupe/filtre/tri), ligne d'en-tête légèrement teintée, filets fins, lignes régulières, identité fixée à gauche, catégories en petits badges.[9]

**À transférer** : la séparation navigation/outils/données ; les badges comme métadonnées secondaires ; une table dense mais ordonnée ; un seul registre dominant. **À refuser** : cases de sélection et actions de masse sans besoin métier, avatars, collection de couleurs de projets, table arbitrairement coupée au bord, petits textes de présentation. La capture ne suffit pas à certifier accessibilité ou comportements.

Fichier : `data/design/dribbble-nfs.png` ; capture de page : `reference-dribbble-page.png`.[9]

### B. Awwwards — The F Suite / Paper Tiger

La fiche Awwwards consultée porte le titre « The F Suite - Awwwards Honorable Mention » ; l'image de présentation montre une marque destinée aux CFO, et non une application de trading.[2][6]

**Vu** : fond rouge-orange franc, texte crème, très grand titre sans, grille asymétrique et fin séparateur, petites étiquettes presque monospaces. **À transférer** : conviction chromatique, hiérarchie typographique tranchée, chaleur et contraste, absence de bleu bancaire obligatoire. **À refuser** : hero plein écran, énorme slogan, orange dominant (déjà une couleur de signal), animations de marketing. Pour Radar, cette énergie devient un titre éditorial court sur papier et un accent d'action parcimonieux, pas le même écran.[6]

Fichier : `data/design/awwwards-fsuite.jpg`.[6]

### C. Awwwards — Beechwood Capital

Fiche de société d'investissement consultée, visuel de présentation archivé par Awwwards ; ce n'est pas une référence d'interface actuelle ni un benchmark mobile.[3][7]

**Vu** : en-tête blanc, contraste graphite/blanc, accent olive, titres de rubriques nets, contenu investment identifiable. **À transférer** : sobriété institutionnelle, capitales espacées uniquement dans les petits labels, rythme des séparateurs. **À refuser** : photo hero, carousel, décor de cernes, mots tout en capitales dans les tables.[7]

Fichier : `data/design/awwwards-beechwood.jpeg`.[7]

### Synthèse, une seule direction

**« Carnet de conviction »** : ni néobanque ni terminal de trading ; un registre de recherche personnel, chaleureux, précis. Le papier/graphite sert la lecture ; une pointe citron sert l'action ; ORANGE garde exclusivement son sens de qualification. Le registre et les preuves priment sur la mise en scène. Voir les tokens, composants et règles dans `DIRECTION.md`.

## 4. Frontières API / produit à résoudre

| Besoin | Déjà disponible | Manquant / contrat futur |
|---|---|---|
| Registre | signaux, total, filtres exacts, pagination | recherche société/ticker, tri serveur, filtre suivi/devise, compteurs globaux statut |
| Fiche | détail avec `payload`, observations, audits | route d'interface partageable ; récupération run liée pour contexte/raw_report |
| Pause | contexte opérateur, pas GET dashboard | état de planification fourni par métadonnée serveur autorisée ou config explicite ; sinon « Planification non exposée » |
| Santé | santé locale API/DB/worker, worker_stale | endpoint authentifié same-origin de statut minimal ; ne pas ouvrir la santé publique ni exposer les IDs d'erreurs internes |
| Fraîcheur mesure | `observations[].session/observed_at` dans détail | date de dernière observation dans liste ; `calculated_at` / statut métier si nécessaire ; ne pas substituer created_at |
| Synthèse | analytics global/par tag/par devise, chaque checkpoint possède n | comptes manquant/quarantaine/attente par cohorte ; décomposer sans renommer backlog en « actifs » |

Ne pas fabriquer les champs manquants dans le client. La future implémentation doit négocier ces extensions en tests avant de promettre tri global ou fraîcheur. Aucun ajout d'API n'est réalisé dans cet audit.

## 5. Limites explicites

- Pas de simulation de rupture fournisseur sur le service live ; les scénarios erreur seront testés par interception dans la future suite navigateur.
- Pas de test complet lecteur d'écran, contraste automatique ou moteur axe sur l'ancien écran ; problèmes de structure et labels constatés directement, cible de conformité détaillée dans la direction.[10]
- Les références Dribbble sont des explorations de designer ; aucune affirmation de performance utilisateur. Deux liens de présélection Dribbble non vérifiables par fetch n'ont pas été retenus comme références.
- Le backend d'extraction configuré ne permettait pas l'extraction : récupération directe et navigateur ont permis de vérifier les références retenues. Aucun accès intermédiaire avec authentification Radar.
- Pause attestée par le contexte de mission ; santé/API attestées par lecture réelle. Ne pas confondre ces provenances.

## 6. Décision et ordre de réalisation futur

1. **Confiance** : statut, fraîcheur, null/quarantaine, dénominateurs (U01–03).
2. **Tâche principale** : registre responsive, recherche et tri complets, pagination et labels (U04, U06–09).
3. **Preuve** : vraie fiche de lecture et sources datées (U05).
4. **Bilan** : checkpoints, sous-groupes devise, comparaison sans faux résultat (U10).
5. **Qualité** : réseau/course, clavier, responsive et contraste (U11–14).

Ne pas réactiver le worker pour « rendre la maquette plus jolie ». Une interface aboutie doit être crédible avec **cet état réel pauvre, ancien et partiellement quarantiné**.

## Sources

[2] https://www.awwwards.com/sites/the-f-suite — The F Suite — Awwwards Honorable Mention
[3] https://www.awwwards.com/sites/beechwood-capital — Beechwood Capital — Awwwards Honorable Mention
[6] https://assets.awwwards.com/awards/submissions/2023/06/647a23fb85a96337277189.jpg — F Suite presentation image, downloaded and visually inspected
[7] https://assets.awwwards.com/awards/submissions/2016/06/5751bc5e1f994.jpeg — Beechwood presentation image, downloaded and visually inspected
[8] https://dribbble.com/shots/23047845-NFS-Spreadsheet-Table-View — NFS - Spreadsheet Table View by Patryk Ilnicki
[9] https://cdn.dribbble.com/userupload/11383279/file/original-3967328e515e8bab044f0c6a85463b2a.png?resize=1024x768&vertical=center — NFS spreadsheet image, downloaded and visually inspected
[10] https://www.w3.org/WAI/WCAG22/quickref — WCAG 2.2 quick reference
