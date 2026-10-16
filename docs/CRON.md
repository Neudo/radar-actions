# Planification proposée — à appliquer par le parent seulement

Demande du 2026-10-16 : pause du quotidien jusqu’au lundi 2026-10-19, puis 09:00 Europe/Paris tous les jours (week-ends compris). Le parent gère la reprise différée; ne pas toucher au worker toutes les 30 minutes ni aux autres jobs. Cutoff historique 17:45 avant cette date, 09:00 à partir de cette date; fenêtre anti-hindsight de 15 minutes inchangée. Le prompt COMPLET à installer est `prompts/daily-cron.md`.

**Aucun job Hermes, crontab ou systemdtimer créé par l’installateur.** Les autres jobs sont inchangés. Les services Docker restart unless-stopped ont survieindépendante de la session; les workers/backup restent ponctuels jusqu’àactivation. Vérifier les jobs existants avant d’ajouter et relire les nouveaux IDs aprèscréation. Scheduler/gateway existant ne doit pas être redémarré.

Tous les jobs doivent fixer `workdir=/home/debian/.hermes/workspace/projects/investment-radar`. Préférer héritage du modèle/provider OAuthHermes existant, aucun APIkey LLM supplémentaire. Lire la docHermes courante (probe primaire conservé) et le schéma réel de l’outil cron du parent pour les champs de timezone; ne pas supposer que des expressionsUTC suivent ParisDST.

| Nom | Horaire | Mode | Script/prompt | Livraison |
|---|---|---|---|---|
| investment-radar-daily | 09:00 chaque jour dès lundi 2026-10-19, timezone Europe/Paris (`0 9 * * *` si champ timezone pris en charge); en pause avant cette date | agent-driven (`no_agent=false`) | texte complet prompts/daily-cron.md, qui lit big-radar-original.md | Destination Discord privée à configurer hors dépôt |
| investment-radar-worker | every30m (intervalle, éviteDST), lot50fair | script-only `no_agent=true` | chemin absolu scripts/worker.sh, promptautonome alternative prompts/worker-cron.md | statut/échecs réels; gérer bruitmonitoring |
| investment-radar-backup | 02:15 chaque jour Europe/Paris | script-only | chemin absolu scripts/backup.py (shebangPython3, executable), alternative prompts/backup-cron.md | statutbackup/alerte |
| investment-radar-restore-drill | dimanche02:45 Europe/Paris (heureDST ambiguë: préférer03:45 si évitement requis) | script-only | scripts/restore-drill.py | statutrestore |

Si le scheduler installé n’a PAS de timezoneparjob, utiliser sa timezoneEurope/Paris vérifiée ou un mécanisme documentéParis aware; ne pas modifier la timezoneglobale aux dépens desautresjobs. Alternative sans timezoneglobale: cronUTC `0 * * * *` avec scriptgarde Paris09:00 dès le 2026-10-19 et skip sans appelLLMhorscréneau, en respectant sémantique script/output du scheduler; le parentdoitvérifier cettecompatibilité, pasinventer deschamps.

Tempslimitecron àvérifier (skill indique3min). Préparationquotesprobed enquelquessecondes; recherche20sociétés doitêtre parallèle etconclure seulementsi couverture suffisante. Si timeout, conserver contexte mais ne pasbackfiller une prédiction aprèscutoff+15min; annoncer runmanquant. Le worker lot50 et cachelimitentletemps, retries peuventtoutefoisdépasser une échéance enpannetotale: relancementprochaincadence récupère viaidempotence; augmenter timeoutparjob uniquementsi la doc actuelle lepermet. Dumps locaux rétention30jours, copier horsVPS àconfigurer.

Aprèsactivation: exécuter scriptsworker/backup puis inspecterhealth etbackup; premier rapportlive au prochaincréneau, contrôler20signaux+sources+cutoff, readback etlivraisonDiscord. Ne pas envoyer un rapport maintenant ni créer de signauxhistoriques «comme si». Vérifierautonomie aprèsrebooteffectif uniquement lorsd’une opérationautorisée; restartpolicies sontprésentes mais aucun rebootVPS effectué.
