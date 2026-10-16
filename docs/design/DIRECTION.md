# Direction UX/UI — « Carnet de conviction »

**Statut : spécification, pas implémentation. 16 octobre 2026.**

## 1. Parti pris unique

Un **carnet d'analyse financière personnel** : papier chaud, graphite, titres éditoriaux courts, chiffres tabulaires, filets fins, accent citron discret. Pas une néobanque, pas un terminal marine, pas une démonstration d'IA. L'intérêt visuel vient du rythme, de la précision et du contenu réel ; pas de gradients, glow, halos, verre, blobs, faux cours animés ou cartes « Capital / Profit / IA confidence ».

La table utile de NFS inspire l'organisation outils/données, sans copier son contenu RH.[8][9]

La référence F Suite confirme qu'une identité financière peut être chaleureuse et affirmée sans bleu, mais son hero et son orange dominant ne sont pas transposés.[2][6]

Beechwood apporte un contrepoint blanc/graphite/olive, pas son carousel marketing.[3][7]

Les visuels et leurs analyses sont dans `UX-AUDIT.md`.

**Ce qui rend cette direction personnelle :** les 20 valeurs surveillées, la double lecture France/États-Unis et EUR/USD, les sessions J5/J10/J20/J30, la thèse figée et la recherche incomplète constituent le design. Aucune valorisation de portefeuille ni ordre n'existe dans le produit : ne pas en ajouter visuellement.

## 2. Hiérarchie d'information

### Navigation française

- Masthead : petit repère typographique « R / » + **Radar** ; sous-titre « Journal de recherche ».
- Navigation sobre : **Signaux**, **Bilan**, **Méthode**. Fiche signal via une vraie URL. État opérationnel visible depuis chaque vue.
- Pas de sidebar permanente : trop de chrome pour trois destinations. Barre haute de 64 px desktop, 56 px mobile ; retour clair dans une fiche.
- Mentions : « Expérimentation personnelle · Aucun ordre ni recommandation » dans un court texte permanent ; méthodologie complète dans Méthode, pas un mur de précautions avant les données.

### Écran Signaux, ordre vertical

1. Masthead/navigation.
2. Bandeau d'exploitation : pause/dégradation/fraîcheur avec preuves, non escamotable quand incident.
3. Titre **Signaux** + période réellement sélectionnée ; compteur textuel compact, pas cards.
4. Recherche + filtres + tri ; résumé des filtres actifs et « Réinitialiser ».
5. Registre, résultat/état vide/erreur et pagination.
6. Lien secondaire « Examiner le bilan de cette sélection ».

État initial réel à concevoir : **40 signaux · 2 analyses · 0 mature J30**, avec « 22 en quarantaine · 18 suivis non terminés » seulement si les compteurs couvrent toute la sélection. ORANGE signifie qualité de recherche, pas performance. Ces nombres sont le constat de l'audit, **jamais des constantes de production**.

### Écran Bilan

- Même portée de filtres que Signaux, visible dans le titre et les URL.
- Phrase préalable : « Aucun signal n'a atteint J30 dans cette sélection. Les taux ne sont pas calculables. » lorsque `matured=0`.
- Tableau **Points de contrôle** : J5/J10/J20/J30 en lignes ; colonnes « Observés (n) », « Moyenne », « Médiane ». Jamais quatre cartes vides avec − ou 0 %.
- Comparaison par qualification : effectif total, éligibles J30, attente, quarantaine/manquant si disponibles, moyenne/médiane J30 et cibles. Vue condensée par défaut ; colonnes avancées dans « Mesures détaillées ».
- Toutes les qualifications restent listées ; groupes vides : « Aucun signal », pas 0 % ni gris laissant supposer une performance nulle.
- Ventilation EUR/USD explicite ; pas de somme de montants ni « rendement portefeuille ». Agrégats de pourcentages transversaux existants présentables seulement comme « signaux, devises natives, non pondéré » avec sous-groupes visibles, pas retour investisseur.

## 3. Grille, espace et densité

| Élément | Règle |
|---|---|
| Zone de page | max-width 1480 px ; centrée ; marges 32 px ≥1200, 24 px 768–1199, 16 px <768 |
| Espacement | échelle 4 / 8 / 12 / 16 / 24 / 32 / 48 px ; pas de valeurs aléatoires |
| Arrondis | 4 px champs/badges ; 6 px panneaux ; pas pilules partout |
| Surface | fond unique, panneau clair seulement pour fiche/contrôles ; bordures 1 px ; ombres absentes hors dialogue |
| Table standard | ligne min-height 56 px, cellule padding 12 px ; en-tête 40 px |
| Table compacte | ligne min-height 44 px, padding vertical 8 px ; option seulement ≥1024 px |
| Contrôles | hauteur 44 px, icône 18 px ; étiquettes visibles hors champ |
| Titres / sections | marge 24–32 px avant, 12–16 après ; pas hero vide |
| Largeur de prose fiche | 62–72 caractères ; interligne 1.55 |

La densité se règle par « Confort / Compact », conservée localement sans données sensibles. Mobile reste Confort ; ne pas réduire police ou cibles pour caser une table desktop.

## 4. Tokens de couleur

Tokens sémantiques, pas noms arbitraires de teinte. Les ratios ci-dessous ont été calculés avec la luminance relative ; ils ne dispensent pas du test rendu, notamment en focus/disabled. Cible WCAG 2.2 AA : contraste texte normal ≥4,5:1, grand texte ≥3:1, composants/focus perceptibles ; tailles et clavier détaillés plus bas.[10]

| Token | Valeur | Usage |
|---|---|---|
| `paper` | `#F5F2E9` | fond global |
| `surface` | `#FFFEFA` | panneaux et champs |
| `graphite` | `#22231F` | texte principal, 14,12:1 sur paper |
| `muted` | `#62645B` | métadonnées, 5,37:1 sur paper ; pas de gris plus clair pour texte utile |
| `rule` | `#D4D0C3` | filets décoratifs uniquement ; ne suffit pas seul à délimiter un contrôle |
| `control-border` | `#7B7C70` | contour champ et bouton secondaire ; vérifier ≥3:1 au rendu |
| `action` | `#DAE65B` | fond action primaire/repère de sélection ; graphite dessus, 11,63:1 |
| `focus` | `#53603A` | contour focus 3 px, offset 3 px ; 6,05:1 sur paper |
| `green-ink` / `green-wash` | `#28613F` / `#E5EFE5` | GREEN, 6,20:1 |
| `orange-ink` / `orange-wash` | `#92501D` / `#F7E8D6` | ORANGE, 5,16:1 |
| `red-ink` / `red-wash` | `#9C3535` / `#F5E3E0` | RED, 5,70:1 |

**DOUBLE_GREEN** : badge fond `green-ink`, texte paper (6,53:1), deux petits repères + texte « Double vert ». Pas de vert fluorescent. Signaux toujours lisibles sans couleur : « Rouge », « Orange », « Vert », « Double vert » ; conserver l'identifiant API dans le mapping seulement. Ne pas changer la signification métier des catégories : mini-glossaire validé avant implémentation.

Le citron n'exprime ni gain ni signal ; l'orange n'est pas la couleur de tous les boutons. Le suivi des données est une autre dimension : « En cours », « Manquantes », « Quarantaine », « Terminé » avec icône et libellé. Un incident général est un bandeau graphite/filet et icône, pas un énorme badge RED qui pourrait être confondu avec une classification.

Les rendements positifs/négatifs peuvent employer vert/rouge **en plus du signe explicite**, avec chiffres graphite par défaut dans les tables les plus denses. N'utiliser aucun rouge pour représenter une panne comme une thèse baissière.

## 5. Typographie

- **Interface** : IBM Plex Sans, poids 400/500/600 ; fallback `system-ui, sans-serif`.
- **Titre éditorial uniquement** : Source Serif 4, 500 ; fallback `Georgia, serif`. Pas de sérif dans les cellules, boutons ou navigation.
- **Données** : interface avec `font-variant-numeric: tabular-nums lining-nums` ; identifiants techniques seulement en `ui-monospace`.
- Polices souhaitées **à embarquer localement** après vérification licence/fichiers ; aucune dépendance Google Fonts/CDN. Si non disponibles, fallbacks explicites, sans bloquer la lecture. Pas d'affirmation de disponibilité de ces assets à ce stade.

| Niveau | Desktop | Mobile |
|---|---|---|
| Titre de page | 32/38 px, serif 500 | 28/34 |
| Titre section | 20/28 px, sans 600 | 20/28 |
| Société / texte courant | 16/24 px | 16/24 |
| Cellules | 14/20 px | 14/20 |
| Métadonnées | 13/18 px | 13/18 |
| Micro-label | 12/16 px, 500, espacement .04em | seulement non essentiel, pas métriques |

Pas de capitales dans les phrases ni d'abréviation sans expansion accessible. Les titres ne sont pas des cartes KPI géantes.

## 6. Spécification des composants

### A. Bandeau de confiance

Deux niveaux :
- Ligne visible : « **Collecte en pause** · Dernier traitement dégradé » si ces deux états sont prouvés indépendamment ; lien/bouton « État du suivi ».
- Zone développée : santé API/DB, heure du dernier worker, statut, dernière analyse disponible, date des observations. Dates absolues avec fuseau ; ne pas afficher « à l'instant » sur une ancienne capture.

Exemple d'état réel : « Dernier traitement : 6 oct. 2026 à 08:27, Europe/Paris · Dégradé ». Ne pas utiliser la date worker comme date des cours. Santé publique non exposée : futur endpoint authentifié minimal. Sans métadonnée de scheduler : « Planification : état non exposé », pas pause présumée. Aucun bouton de relance/activation dans cette refonte lecture seule.

### B. Recherche / filtres / tri

- Label « Rechercher une société ou un ticker » ; champ type search, clear nommé ; correspondance insensible à la casse sur ticker ET company ; saisie `nvda` et `Nvidia` doit retrouver NVDA.
- Déclenchement : bouton « Appliquer », Entrée dans le formulaire ; pas d'autorefresh à chaque touche. Le contenu de recherche reste intact dans l'URL et l'historique. Le contrat peut normaliser le ticker pour sa recherche sans réécrire les données source.
- Rangée prioritaire : recherche (320–420 px desktop), qualification, période. « Plus de filtres » révèle place, devise, secteur, type de catalyseur, état du suivi et « Données exploitables uniquement ».
- Filtres de catégories = options réellement disponibles + « Tous », pas saisie exacte fragile. Labels « Du », « Au ». Période invalide : erreur sous champs, pas alert navigateur.
- Tri défaut : date décroissante, puis ticker, puis id pour stabilité. Options : date récente/ancienne, société A–Z, qualification (ordre documenté), rendement admissible décroissant/croissant, J30 lorsque disponible. Valeurs nulles/exclues toujours en fin, dans les deux sens.
- Tout changement appliqué remet la pagination à 0, garde le focus et annonce le nouveau nombre de résultats. Filtre de liste et analytics partagent le même état de portée.
- **Pas de tri/recherche sur la seule page visible**. Étendre l'API ; à défaut, ne pas afficher un contrôle qui prétend au tri global.

### C. Registre desktop

Colonnes de base, dans cet ordre :

| Colonne | Largeur indicative / rendu |
|---|---|
| Société | min 184 px, ticker/lien en 600 ; company en secondaire ; place dans fiche ou sous-ligne selon largeur |
| Qualification | 112–128 px ; badge texte |
| Analyse | 104 px ; date absolue française ; année si ambiguë |
| Entrée | 112 px ; prix + code devise ; aligné à droite |
| Suivi | 132 px ; statut + dernière séance si connue |
| Rendement observé | 128 px ; signé, 2 décimales, ou motif d'exclusion |
| J5 / J10 / J20 / J30 | 80 px chacun en mode « Points de contrôle », n/a expliqué |

Deux vues de colonnes du **même registre**, pas deux résultats différents : « Essentiel » et « Points de contrôle ». En Essentiel, les checkpoints complets sont dans la fiche ; en Points de contrôle, masquer Entrée au besoin pour préserver une largeur raisonnable. Max gain et drawdown sont mesures avancées, non colonnes permanentes poussant l'identité hors écran. Entête sticky dans la zone de défilement, aucune ligne collante cachant le focus.

Le ticker est un **lien**, pas un bouton qui écrit un JSON invisible. Ne pas rendre toute la ligne interactive : le texte doit rester sélectionnable et les liens indépendants.

### D. Fiche signal

URL proposée pour future UI : `/dashboard/signaux/:id` ; conserver compatibilité de `/dashboard`. Grand écran ≥1280 : fiche latérale 520–640 px, liste restante ≥640 px ; sinon fiche pleine page. Le lien direct rend une page complète, même sans liste derrière.

Ordre :
1. Retour à la sélection, société/ticker/place, qualification, date/cutoff de l'analyse, statut des données.
2. **Pourquoi ce classement** : catalyst_summary puis thesis, figés à la date d'analyse. Cours d'entrée + devise + quote_at/source. Ne pas appeler cela « signal d'achat ».
3. **Risques et invalidation** avant le détail des performances ; pas cachés dans l'onglet technique.
4. **Sources** : domaine comme libellé, résumé, publication ou « Publication non établie », date de consultation ; URL comme lien externe avec indication. Page index ≠ article daté. Validation des protocoles http/https ; `rel=noopener noreferrer` si ouverture nouvel onglet ; jamais HTML brut du payload.
5. **Suivi** : tableau séance/observation/J ordinal/clôture/rendement, puis checkpoints, atteintes cibles et drawdown. Date d'observation séparée de la date de récupération ; source provenance si disponible.
6. **Traçabilité** repliable : run, cutoff, motif de quarantaine, audits, original JSON téléchargeable seulement si besoin validé ; aucun secret/URL privée.

Une ligne quarantinée affiche « Performance exclue : révision d'une observation figée ». Les observations conservées peuvent être consultées sous « Historique non exploitable », avec libellé visible ; elles ne sont ni effacées ni remises en classement. Ne pas montrer une courbe lissée de ces données.

Focus : desktop non modal garde l'ordre de lecture document ; ouverture du panneau place le focus sur titre/retour, fermeture revient au lien. Mobile pleine page, retour conserve filtres/page/position. Si une vraie modale est finalement utilisée, trap focus + Escape + retour déclencheur obligatoires ; ne pas appliquer un rôle dialog à un simple aside.

### E. Pagination et états

- Résumé « 1–40 sur 40 signaux », compte exact depuis API, pages de 25/50/100 ; précédent/suivant désactivés aux limites.
- Chargement initial : libellé « Chargement des signaux… » et structure non chiffrée. Pas de skeleton montrant des rendements fictifs.
- Mise à jour : garder les anciennes lignes, `aria-busy=true`, mention « Mise à jour… » ; empêcher leur confusion avec nouveaux filtres en attente.
- Aucun résultat : « Aucun signal pour ces filtres » + reset. Données globalement vides : état distinct « Aucune analyse enregistrée ».
- Erreur : encart dans la région touchée, statut lisible, bouton « Réessayer » ; garder résultat précédent avec « Dernier résultat affiché, mise à jour échouée ». Ne pas rendre une erreur comme zéro résultat.
- Session expirée/401 : message « Accès à renouveler » sans révéler la clé ni créer un formulaire qui l'enregistre ; conserver authentification Basic existante jusqu'à décision de sécurité séparée.

## 7. Contrat d'affichage financier : absent ≠ zéro

| Entrée métier | Affichage requis |
|---|---|
| `null` checkpoint + séances insuffisantes | « Non atteint », détail « J5 : 1 séance observée sur 5 » |
| `null` par donnée manquante | « Non mesurable · donnée manquante », pas « Non atteint » par défaut |
| quarantined / missing | « Exclu », motif accessible ; pas ancien rendement dans la liste |
| valeur numérique `0` | `0,00 %`, valeur réelle conservée |
| cohort n=0 / denominator=0 | « Non calculable · n=0 » ; aucune barre à 0 % |
| tag total=0 | « Aucun signal » ; aucune statistique |
| objectif `target_pct=null` | « Aucun objectif chiffré » ; ne pas inventer 9 % comme objectif du signal |
| statut inconnu | « État non renseigné » ; pas « En cours » présumé |
| `sessions_remaining` absent | « Non déterminé » ; ne pas remplacer par 30 |

- Nombres de comptes et séances = entiers ; prix = `Intl.NumberFormat('fr-FR')`, deux décimales en table, précision originale accessible dans fiche technique ; PG numeric peut être une chaîne : parser avec validation de finitude, pas `Number(null)`.
- Prix accompagné de EUR/USD, jamais symbole ambigu seul. Pas de conversion FX, frais ou dividendes inventés.
- Rendements = signe explicite `+` pour positif, virgule et espace insécable avant `%`, deux décimales ; **ne jamais arrondir une petite valeur non nulle en zéro sémantique sans précision consultable**.
- Calendrier = séances de la place, pas jours calendaires ; J0 exclu ; J5/J10/J20/J30 selon logique existante. Pas de date d'échéance calculée par addition de 30 jours.
- Chaque moyenne/médiane de checkpoint affiche **son n propre**, pas forcément les matures J30. Taux de cibles : dénominateur J30 explicitement. « +9 % en séance » et « +9 % en clôture » ne sont pas fusionnés.
- Drawdown de clôture exact ; bornes intrajournalières distinctes avec indication OHLC, pas « drawdown exact intraday ».
- Échantillon : toujours signaler effectif. À n=0, aucun résultat ; à n>0, « Descriptif, ne prouve pas la performance future ». Pas de seuil arbitraire de significativité ou badge « validé » à n=30.
- **Pas de graphique en V1 proposée** : les observations actuelles ne justifient pas une trajectoire. Futur graphique uniquement si séries réelles datées admissibles, trous visibles, pas d'interpolation présentée comme donnée, tableau accessible et source. Pas d'illustration « +12,4 % » décorative.

## 8. Responsive précis

| Plage | Composition |
|---|---|
| ≥1280 px | table registre pleine largeur ; fiche split si les deux minima sont satisfaits, sinon pleine page |
| 1024–1279 px | table essentielle, colonnes secondaires dans fiche ; navigation horizontale |
| 768–1023 px | table essentielle compacte en colonnes visibles identité/qualification/date/suivi/rendement ; fiche pleine page |
| <768 px | lignes empilées sémantiques, identité + badge, date/place/devise, suivi + mesure admissible ; une action « Ouvrir le signal » |
| 320–390 px | une colonne, filtres empilés dans disclosure ; recherche et Appliquer pleine largeur ; aucun défilement horizontal de page |

- Mobile : barre de filtres repliable, état actif toujours résumé ; pas de swipe obligatoire, hover ou tooltip comme seul accès à un motif.
- Chaque ligne empilée présente un mini `dl` étiqueté ; pas duplication cachée qui double les annonces lecteur d'écran.
- Vue Bilan très large : défilement horizontal **local**, caption et aide « Tableau défilant horizontalement », focus clavier sur région ; identité de ligne conservée ; pas zoom-out global.
- À 200 % de zoom et 400 % reflow (largeur effective 320 px), actions, titre, alertes et texte restent sans perte ; exception locale pour tableau 2D si nécessaire.[10]
- Réduction d'animations via `prefers-reduced-motion`. Transitions max 120–160 ms hors préférence ; aucune animation qui déplace les chiffres.

## 9. Accessibilité et clavier

Cible WCAG 2.2 AA ; tester réellement les critères, ne pas déclarer conformité sur le seul choix des couleurs.[10]

- Lien d'évitement, `header/nav/main`, un h1, titres ordonnés ; nom de navigation.
- Table avec `caption`, `thead/tbody`, `th scope=col/row` ; tri dans button nommé et aria-sort seulement sur la colonne active.
- Tous les champs ont label visible ; erreurs associées par aria-describedby ; résultat annoncé `aria-live=polite` sans relire 40 lignes.
- Tab/Shift+Tab parcourent les actions dans l'ordre visuel ; Entrée applique, Escape ferme un disclosure/dialogue si approprié ; aucun raccourci lettre imposé dans la recherche.
- Cible **44 × 44 px** recommandée pour les commandes, supérieure au minimum AA 24 px hors exceptions ; pas de bouton ticker minuscule.[10]
- Focus 3 px + offset, jamais masqué par en-tête sticky ; focus des liens sur papier et citron testé séparément.
- Couleur jamais seule ; texte et icônes stables. `title` natif n'est pas une explication suffisante pour l'état Exclu.
- Pas d'images de logos de sociétés nécessaires au repérage ; noms réels et ticker suffisent.

## 10. Contrats futurs et fichiers candidats — sans changement ici

Implémentation suggérée au prochain lot : préserver Fastify et la même origine, **pas migration React/Next par principe**. Extraire les chaînes HTML/JS de `src/app.ts` vers des modules de vue/asset maîtrisés après tests ; le découpage exact appartient au plan d'implémentation.

| Surface future | Fichier actuel / candidat | Conditions |
|---|---|---|
| Routes et paramètres | `src/app.ts`, futur module dashboard | recherche/tri allowlistés, SQL paramétré, limite/pagination conservées |
| Vue / styles / comportement | chaînes `dashboard` et `dashboardJS` actuelles | français, CSP self, pas CDN, pas secret client |
| Statut lecture | `src/app.ts` + configuration serveur autorisée | pas exposition publique `/health`, pas mutation scheduler |
| Statistiques | `src/core.ts` | préserver calculs ; ajout éventuel de compteurs qualité dans API sans altérer mesures |
| Tests | fichiers existants sous `tests/`, futurs tests navigateur | base isolée/fixtures déclarées uniquement ; jamais signaux fictifs live |

## 11. Acceptation vérifiable du futur lot

Ces critères sont **à exécuter après implémentation**, pas déclarés passés par cet audit.

1. Capture de la production actuelle archivée ; nouvelle capture desktop 1440×1000 + 390×844, puis tests 320/768/1024/1280/1920 et zoom 200/400 %. `scrollWidth <= innerWidth` pour le document ; seul tableau Bilan peut défiler localement.
2. Avec l'état réel courant, affiche 40 ORANGE, 0 mature, checkpoints n=0/null ; aucune sparkline, retour portefeuille, KPI fictif ou taux 0 % en remplacement de null.
3. Les 22 quarantaines sont reconnaissables **avant ouverture** ; aucun rendement quarantiné ne sert de résultat admissible dans liste/tri/bilan. Test unitaire séparé pour zéro réel, null, numeric string et statut inconnu.
4. État en pause uniquement si prouvé ; dégradé/fraîcheur visibles sans confondre API ok et worker ok. Dernière analyse, dernière exécution et dernière observation ont chacun leur date et source.
5. Recherche NVDA/nvda/Nvidia retourne les mêmes identités attendues. Recherche, filtres, tri, limites, total et analytics sont globaux et cohérents sur un jeu de test de plus d'une page. Tri stable pour égalités et null toujours en fin.
6. Une fiche AAPL réelle expose thèse, risques, invalidation et sources non datées avec le bon avertissement ; détail appelle la route `signals/:id`, pas seulement le JSON de la ligne. Accès URL direct et retour conservent contexte.
7. Chargement, zéro résultat, 401, 400 validation, 429 et 500 sont testés par interception navigateur/base isolée ; aucune panne production déclenchée. Requête lente ancienne ne peut remplacer le filtre courant.
8. Navigation clavier seule : recherche → filtres → tri → fiche → retour ; focus toujours visible. Vérification lecteur d'écran sur titres, table, résultat et statut ; aucun double contenu responsive.
9. Contrastes mesurés au rendu pour états repos/hover/focus/erreur/selection, et contrôle à 44 px. Scanner automatisé d'accessibilité complété par test manuel, pas utilisé comme certificat.[10]
10. Devise et séances conservées ; taux cibles = dénominateurs J30, checkpoints = n propre, missing/quarantaine exclus ; tests de non-régression des calculs existants.
11. Aucun secret dans JS, HTML, console, captures, requêtes d'assets ou dépôt. Auth lecture, CSP, no-store et protections existantes inchangés. Pas d'envoi à un CDN de design.
12. Quotidien et worker restent en pause ; aucune migration de données, correction historique, ordre, activation cron ou déploiement implicite dans le lot visuel.

## 12. Décisions de conception déjà prises / ouvertes

**Prises** : direction papier/graphite/citron, une architecture registre → preuve → bilan, français, absence de graphiques décoratifs, priorité aux données invalides et aux échantillons insuffisants, responsive empilé, lecture seule.

**À arbitrer avant code** : source serveur autorisée de l'état pause ; extension des filtres/recherche/tri global ; ajout de date dernière observation dans liste ; polices locales/licences ; vocabulaire métier exact des quatre qualifications. Aucun de ces points ne justifie une donnée inventée ou un indicateur qui semble fonctionner sans contrat.

## Sources

[2] https://www.awwwards.com/sites/the-f-suite — The F Suite — Awwwards Honorable Mention
[3] https://www.awwwards.com/sites/beechwood-capital — Beechwood Capital — Awwwards Honorable Mention
[6] https://assets.awwwards.com/awards/submissions/2023/06/647a23fb85a96337277189.jpg — F Suite presentation image, downloaded and visually inspected
[7] https://assets.awwwards.com/awards/submissions/2016/06/5751bc5e1f994.jpeg — Beechwood presentation image, downloaded and visually inspected
[8] https://dribbble.com/shots/23047845-NFS-Spreadsheet-Table-View — NFS - Spreadsheet Table View by Patryk Ilnicki
[9] https://cdn.dribbble.com/userupload/11383279/file/original-3967328e515e8bab044f0c6a85463b2a.png?resize=1024x768&vertical=center — NFS spreadsheet image, downloaded and visually inspected
[10] https://www.w3.org/WAI/WCAG22/quickref — WCAG 2.2 quick reference
