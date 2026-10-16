# Accès HTTPS protégé

Déploiement du 16 octobre 2026 : `https://radar.vitalisite.com/dashboard` (la racine sert aussi le dashboard).

## Architecture et accès

- Caddy système : `/etc/caddy/Caddyfile`, modèle sans secrets `deploy/Caddyfile`.
- Seuls les nouveaux ports TCP 80 et 443 sont publics. HTTP redirige en 308 vers HTTPS ; HTTP/3 est désactivé pour ne pas ouvrir UDP 443.
- Certificat public Let's Encrypt obtenu automatiquement ; renouvellement géré par Caddy tant que le service et l'accès ACME restent disponibles. État privé dans `/var/lib/caddy/.local/share/caddy` : ne jamais publier les clés.
- Caddy est `enabled` sous systemd. API/DB conservent `restart: unless-stopped`, sans redémarrage lors du déploiement.
- Upstream : `127.0.0.1:17845`. PostgreSQL n'a aucun port publié et reste sur le réseau Docker `internal`.
- Authentification existante conservée : navigateur Basic utilisateur `radar`, mot de passe = variable `IR_READ_KEY` de `/home/debian/.hermes/.env` (0600). Aucun secret supplémentaire, aucune clé dans JS. Récupérer cette seule valeur via une session SSH privée et un outil local ; jamais la transmettre dans Discord, un ticket, une URL ou une commande partagée.
- Les routes dashboard, JS et API refusent les accès anonymes (401). Basic est lecture seule ; les clés Bearer existantes conservent leurs droits. Caddy transmet Authorization sans le remplacer et ne configure aucun journal d'accès contenant des en-têtes.
- `/health` est interdit publiquement (403), même authentifié : diagnostics détaillés uniquement via `http://127.0.0.1:17845/health` sur le serveur. Cela évite de divulguer les erreurs et identifiants worker.
- HSTS : `max-age=31536000`, sans includeSubDomains pour ne pas affecter les autres sites. `trustProxy=false` est inchangé : la limite applicative de 120 requêtes/min/IP est partagée derrière ce proxy ; ne pas l'interpréter comme un limiteur par visiteur.

## Reproduire sur ce VPS

Auditer d'abord les listeners, services et règles de pare-feu : ne pas remplacer un proxy existant. Le 16 octobre, aucun proxy ne préexistait et aucune règle INPUT ne bloquait 80/443 ; aucune règle Docker ou de pare-feu n'a été modifiée. Le domaine doit déjà pointer uniquement sur le bon VPS ; ne pas modifier DNS ou un autre sous-domaine dans cette procédure.

```sh
cd /home/debian/.hermes/workspace/projects/investment-radar
sudo apt-get update
sudo apt-get install -y caddy
sudo caddy validate --config "$PWD/deploy/Caddyfile" --adapter caddyfile
sudo install -o root -g root -m 644 deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl enable caddy
sudo systemctl reload caddy
systemctl is-active caddy
systemctl is-enabled caddy
python3 scripts/verify-https.py --resolve 167.114.97.30
python3 scripts/verify-https.py
curl -sS -o /dev/null -D - http://radar.vitalisite.com/dashboard
```

Le test Python utilise la vérification TLS standard, conserve SNI/hostname lors du pin IP, charge la clé lecture uniquement en mémoire et n'affiche ni secrets ni contenu des signaux. Il vérifie 401 anonymes/identifiants invalides, 403 diagnostics, 200 UI/JS/API et présence des signaux existants via Basic et Bearer. Il ne crée rien et ne lance ni migrations ni workers. Le certificat initial expire le 14 janvier 2027 ; ne pas installer de cron certbot concurrent.

En cas de cache DNS ancien, tester séparément `--resolve` et la résolution normale : un succès pin IP prouve le déploiement cible, pas la propagation mondiale. Lors du déploiement, le resolver local avait encore aussi l'ancien A ; Google DNS retournait seulement le bon A et aucun AAAA. Les tests en résolution normale ont néanmoins réussi sur la bonne IP. Aucun DNS n'a été modifié.

## Périmètre préservé

Quotidien `investment-radar-daily` et worker `investment-radar-worker` restent `enabled=false`, `state=paused`. Sauvegarde et restore drill inchangés. Aucun contenu métier, signal, secret, modèle ou authentification Hermes n'est modifié. L'état worker ancien/dégradé visible en santé locale préexistait : l'exposition HTTPS ne constitue pas une reprise des traitements.
