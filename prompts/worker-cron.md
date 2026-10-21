# Worker — contrat de suivi déterministe

Workdir : /home/debian/.hermes/workspace/projects/investment-radar.
Cadence : une fois par jour du lundi au vendredi à 09:30 Europe/Paris (`30 9 * * 1-5`), indépendamment de l'analyse de 09:00. Aucun cron ne doit être modifié par le worker.

Mode script-only : `no_agent=true`, wrapper `investment_radar_worker.sh`, exécutant `./scripts/worker.sh`. Aucun modèle, aucun ordre d'achat.

Résultat terminé acceptable : code 0, statut `ok` ou `ok_with_exclusions`, liste `errors` vide et aucune nouvelle erreur inattendue. `ok_with_exclusions` n'est pas une certification des prix exclus : conserver les effectifs éligibles/exclus et motifs visibles dans l'API et l'interface. Les quarantaines connues ne sont ni effacées ni approuvées automatiquement.

Déclencher une alerte pour `partial`/code métier 2, `failed`/code 1, toute panne de collecte/validation, un traitement durablement `running`, `skipped` répété ou un suivi périmé. Le wrapper déterministe peut accepter **uniquement** un résultat `pending_data` strictement validé comme réussite de transport, jamais comme collecte saine. Aucun filtrage générique des codes non nuls. En mode agent de diagnostic uniquement, vérifier `python3 scripts/read-api.py /health`, les dates réelles de fin et l'éligibilité globale ; un health sain ne signifie pas que toutes les cohortes sont exploitables.

Un statut `pending_data`, code métier **2**, signifie une collecte encore incomplète. Ce code reste inchangé dans le CLI, worker_runs, l'API et `state/worker-notification.json`. `worker-notify.py` vérifie JSON, compteurs, couverture complète, incidents structurés et zéro erreur/nouvelle anomalie avant de retourner transport 0. Premier incident, changement de symbole/classe, vieillissement 72h/7j et résolution produisent un stdout français compact ; répétition connue : stdout vide. Date du run et nombre de signaux ne sont pas l'empreinte. État atomique hors code avec ancienneté initiale conservée. Erreur HTTP, structure, crash, stderr inattendu, JSON/état invalide et couverture partielle : nonzero à chaque tentative. `summary.alert_required` reste un indicateur métier de nouveauté par signal, distinct de la politique transport par incident. Le parent doit choisir `deliver=origin` plutôt que `local` pour recevoir stdout, vérifier l'origine, puis décider de la reprise. Voir README et `docs/WORKER-DAILY-RELEASE.md`.

Politique de mesure documentée : `frozen-first-v1`. Préserver les prédictions J0 et observations originales, enregistrer les révisions de façon append-only, exclure les révisions matérielles non résolues des performances et graphiques validés. Aucune donnée manquante remplacée par zéro ou RED. Voir `docs/WORKER-REPAIR-RELEASE.md`.
