# Investment Radar — Backend & Analytics

## Objectif

Construire sur le VPS un backend autonome permettant de mesurer objectivement les performances du « Big Radar Actions » de ChatGPT.

Le Big Radar analyse quotidiennement des actions et leur attribue un statut :

- 🔴 RED : pas intéressant actuellement
- 🟠 ORANGE : situation à surveiller
- 🟢 GREEN : mérite une analyse approfondie
- 🟢🟢 DOUBLE_GREEN : signal particulièrement notable à analyser rapidement

L'horizon étudié est de **5 à 30 jours**.

L'objectif expérimental du radar est notamment d'identifier des configurations pouvant produire environ **+9/+10 % dans les 30 jours**, tout en mesurant également les pertes et faux positifs.

Le système ne doit jamais modifier rétroactivement un signal historique.

---

# 1. Architecture

Mettre en place :

ChatGPT Big Radar  
→ API HTTPS authentifiée  
→ Backend TypeScript  
→ PostgreSQL  
→ Jobs automatiques  
→ Analytics  
→ API de consultation

Technologies recommandées :

- Node.js
- TypeScript
- Fastify
- PostgreSQL
- Prisma ou Drizzle
- Docker / Docker Compose si pertinent
- Reverse proxy HTTPS existant du VPS ou Caddy/Nginx

PostgreSQL ne doit PAS être exposé publiquement.

Seule l'API HTTPS doit être accessible depuis Internet.

---

# 2. Sécurité

Créer une clé API dédiée au radar.

Les endpoints d'écriture doivent exiger :

Authorization: Bearer <RADAR_API_KEY>

Stocker les secrets exclusivement côté serveur via variables d'environnement.

Minimum :

DATABASE_URL
RADAR_API_KEY

Ne jamais committer les secrets.

Ajouter :

- validation des payloads
- rate limiting raisonnable
- logs
- gestion correcte des erreurs
- HTTPS uniquement

---

# 3. Modèle de données

Créer au minimum les entités suivantes.

## radar_runs

Représente une exécution quotidienne du radar.

Champs :

- id
- run_date
- generated_at
- market_context
- raw_report éventuel
- created_at

## radar_signals

Une ligne par entreprise analysée lors d'un run.

Champs :

- id
- run_id
- ticker
- company
- sector
- tag : RED | ORANGE | GREEN | DOUBLE_GREEN
- signal_price
- currency
- catalyst_type
- catalyst_summary
- thesis
- invalidation
- target_pct
- horizon_days
- source_summary éventuel
- created_at

Conserver également RED et ORANGE.

Il est important de pouvoir comparer ultérieurement les performances des différents tags.

## price_observations

Historique des observations utilisées pour mesurer les signaux.

Champs :

- id
- signal_id
- observed_at
- trading_days_since_signal
- price
- performance_pct
- created_at

## signal_performance

Statistiques calculées pour chaque signal.

Champs souhaités :

- signal_id
- performance_j5
- performance_j10
- performance_j20
- performance_j30
- max_gain_30d
- max_drawdown_30d
- target_5_reached
- target_5_days
- target_9_reached
- target_9_days
- target_10_reached
- target_10_days
- calculated_at

Adapter le modèle si une structure plus propre est préférable.

---

# 4. API d'ingestion

Créer un endpoint permettant d'enregistrer un rapport complet du radar.

Idéalement :

POST /api/v1/radar/runs

Le payload doit pouvoir contenir :

- date
- contexte marché
- liste des actions analysées
- tags
- prix au moment de l'analyse
- catalyseurs
- thesis
- invalidation
- target
- sources éventuelles

L'opération doit être idempotente.

Une même exécution envoyée deux fois ne doit pas créer deux runs identiques.

Créer également si nécessaire :

GET /api/v1/radar/runs
GET /api/v1/radar/signals
GET /api/v1/radar/signals/:id

---

# 5. Market Data

Mettre en place une source fiable de cours boursiers.

Le système devra récupérer automatiquement les prix nécessaires aux checkpoints et analytics.

Important :

- gérer EUR/USD et autres devises sans les mélanger ;
- identifier les titres via ticker + place de cotation ou identifiant stable ;
- gérer les jours où les marchés sont fermés ;
- utiliser des jours de trading plutôt que naïvement des jours calendaires pour les checkpoints si pertinent ;
- documenter la source de données choisie.

Si l'API de marché a des limites, implémenter cache/retry/backoff.

---

# 6. Checkpoints automatiques

Créer un job quotidien autonome.

Pour chaque signal non terminé :

1. récupérer le cours actuel ;
2. enregistrer l'observation ;
3. calculer la performance depuis signal_price ;
4. mettre à jour les métriques.

Mesurer notamment :

J+5
J+10
J+20
J+30

ainsi que pendant les 30 jours :

- maximum atteint ;
- minimum atteint ;
- max gain ;
- max drawdown ;
- premier passage à +5 % ;
- premier passage à +9 % ;
- premier passage à +10 %.

Après J+30, considérer le signal comme terminé pour l'expérience principale.

---

# 7. Analytics

Créer une couche permettant de mesurer réellement la qualité du radar.

Statistiques globales :

- nombre total de signaux ;
- nombre par tag ;
- performance moyenne ;
- performance médiane ;
- performance J+5/J+10/J+20/J+30 ;
- max gain moyen ;
- drawdown moyen/médian ;
- % atteignant +5 % ;
- % atteignant +9 % ;
- % atteignant +10 % ;
- temps médian pour atteindre chaque objectif.

Comparer :

RED vs ORANGE vs GREEN vs DOUBLE_GREEN.

C'est extrêmement important.

Le but est de vérifier que GREEN et DOUBLE_GREEN ont réellement une valeur prédictive supérieure aux autres tags.

---

# 8. Analytics avancées

Prévoir la possibilité de segmenter les résultats par :

- secteur ;
- entreprise ;
- type de catalyseur ;
- tag ;
- période ;
- volatilité ;
- marché US / Europe ;
- éventuellement contexte macro.

Exemples futurs :

« Quel est le taux de réussite à +9 % des DOUBLE_GREEN ? »

« Performance médiane des GREEN à J+20 ? »

« Les signaux liés aux earnings fonctionnent-ils mieux que les retournements techniques ? »

« Quel secteur produit les meilleurs signaux ? »

« Quel drawdown subit typiquement un signal avant d'atteindre +9 % ? »

---

# 9. Prévention des biais

Principe fondamental du projet.

Ne jamais modifier rétroactivement :

- prix d'entrée théorique ;
- tag ;
- thesis ;
- catalyst ;
- invalidation.

Une prédiction doit rester exactement telle qu'elle était au moment où elle a été produite.

Conserver les RED et ORANGE afin d'avoir un groupe de comparaison.

Sinon les statistiques seraient fortement biaisées.

Stocker si possible le rapport brut original en plus des données structurées.

---

# 10. Dashboard

Une première version très simple suffit.

Afficher :

## Overview

- nombre de runs
- nombre de signaux
- GREEN
- DOUBLE_GREEN
- success rate +9 %
- performance moyenne J+30
- performance médiane J+30
- max drawdown moyen

## Performance par tag

RED
ORANGE
GREEN
DOUBLE_GREEN

avec comparaison des performances.

## Signaux actifs

Afficher les signaux encore dans leur fenêtre de 30 jours :

ticker
tag
date
prix initial
prix actuel
performance
max gain
max drawdown
jours restants

## Historique

Liste filtrable de tous les signaux.

Filtres :

- tag
- ticker
- secteur
- période
- catalyst_type

Pas besoin d'une UI sophistiquée pour V1.

---

# 11. Jobs et autonomie

Le système doit fonctionner sans intervention humaine.

Mettre en place :

- récupération quotidienne des prix ;
- checkpoints automatiques ;
- recalcul analytics ;
- logs ;
- retries en cas d'échec d'une API ;
- monitoring minimum.

Un redémarrage du VPS ne doit pas casser les jobs.

Utiliser cron, systemd timers ou un scheduler fiable.

---

# 12. Healthcheck

Créer :

GET /health

Il doit permettre de vérifier au minimum :

- API fonctionnelle ;
- connexion PostgreSQL ;
- éventuellement dernier job market-data réussi.

---

# 13. Documentation

Créer un README expliquant :

- architecture ;
- installation ;
- variables d'environnement ;
- migrations DB ;
- lancement dev ;
- lancement production ;
- endpoints ;
- authentification ;
- jobs ;
- sauvegarde PostgreSQL ;
- restauration ;
- source des market data.

---

# 14. Sauvegardes

Configurer une sauvegarde automatique PostgreSQL.

Minimum :

- dump quotidien ;
- rétention raisonnable ;
- procédure de restauration documentée.

---

# 15. Préparer l'intégration ChatGPT

Le système doit exposer une API propre afin qu'une intégration externe puisse enregistrer automatiquement un run.

Exemple conceptuel :

POST https://<domain>/api/v1/radar/runs

Authorization: Bearer <RADAR_API_KEY>

Le backend ne doit jamais nécessiter que ChatGPT ait accès à :

- SSH ;
- PostgreSQL ;
- Docker ;
- filesystem du VPS.

ChatGPT doit uniquement disposer d'une API HTTPS fortement limitée.

---

# Résultat attendu V1

À la fin de la V1, je dois pouvoir :

1. envoyer un rapport du Big Radar à l'API ;
2. retrouver tous les signaux en PostgreSQL ;
3. laisser le serveur suivre automatiquement leur évolution pendant 30 jours ;
4. consulter les performances à J+5/J+10/J+20/J+30 ;
5. comparer RED / ORANGE / GREEN / DOUBLE_GREEN ;
6. connaître le taux de signaux ayant atteint +9/+10 % ;
7. consulter un dashboard minimal ;
8. laisser le système fonctionner de manière autonome.

L'objectif final est de construire un dataset de forward-testing permettant de déterminer objectivement si le Big Radar produit des signaux utiles, puis d'améliorer progressivement ses critères à partir des données observées.