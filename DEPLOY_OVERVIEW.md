# 🚀 État du déploiement VPS — SendFloo / SendBID

> Document de suivi du déploiement sur VPS LWS `vps121136.serveur-vps.net` (`195.110.35.155`).
> Dernière mise à jour : déploiement initial terminé, en attente de la mise à jour DNS.

---

## ✅ Étapes réalisées

| Étape | Statut | Détails |
|-------|--------|---------|
| Connexion SSH | ✅ | Debian 13 (trixie), 4 vCPU, 8 GB RAM, 147 GB disque |
| Désactivation Apache | ✅ | `systemctl stop & disable apache2` |
| Nginx | ✅ | Installé + actif sur port 80 |
| Node.js 20.20.2 | ✅ | Via NodeSource |
| Yarn 1.22 + pm2 7.0.1 | ✅ | Globaux |
| MongoDB 8.0.23 | ✅ | Service actif, bind `localhost:27017` |
| Code transféré | ✅ | Via tar.gz scp → `/var/www/sendbid/` |
| Python venv + deps | ✅ | Python 3.13.5, 100+ packages installés (FastAPI, emergentintegrations 0.1.1, etc.) |
| Backend `.env` | ✅ | JWT/QR_HMAC générés, clés Stripe LIVE, PayPal LIVE, Twilio, SendGrid configurées |
| Backend lancé via pm2 | ✅ | `sendbid-backend` running, listen 0.0.0.0:8001 |
| Seed DB | ✅ | Admin, agent, superagent, client + extras créés en base `sendbid_prod` |
| Frontend Expo build | ✅ | `npx expo export --platform web --output-dir dist` (134 routes générées) |
| Nginx config | ✅ | 3 server blocks : sendbid.app → 301 redir, sendfloo.* → marketing+panels, default_server → 444 |
| URL prefix dynamique | ✅ | Sur `sendfloo.*` les liens sont propres (`/pricing`), sur `/api/web/*` ils gardent le préfixe |
| Firewall ufw | ✅ | OpenSSH + Nginx Full autorisés |
| pm2 startup | ✅ | Auto-restart au boot configuré (`pm2 save`) |

### Test interne (curl avec Host header)
```
✅ Host: sendfloo.sendbid.app → / → HTTP 200 (landing 23 KB, "SendFloo" inside)
✅ Host: sendfloo.sendbid.app → /pricing → HTTP 200 (URLs propres /features /admin /agent)
✅ Host: sendfloo.sendbid.app → /admin → HTTP 200 (formulaire login)
✅ Host: sendbid.app → / → HTTP 301 Location: https://sendfloo.sendbid.app/
✅ Externe : curl -H "Host: sendfloo.sendbid.app" http://195.110.35.155/ → HTTP 200 OK
```

---

## ⚠️ Action utilisateur requise — Mise à jour DNS

Le DNS actuel pointe vers **`149.202.61.20`** (ancien hébergeur). Pour que le déploiement soit effectif et que SSL Let's Encrypt fonctionne, **mettez à jour les A records chez LWS** :

### Configuration DNS à appliquer dans le panneau LWS

| Type | Nom | Valeur | TTL |
|------|-----|--------|-----|
| A | `@` | `195.110.35.155` | 3600 |
| A | `www` | `195.110.35.155` | 3600 |
| A | `sendfloo` | `195.110.35.155` | 3600 |
| A | `api` | `195.110.35.155` | 3600 |

> ⏱️ **Propagation** : 5-60 minutes typiquement (TTL 3600s).
> Vous pouvez vérifier avec : `dig sendfloo.sendbid.app +short` (devrait renvoyer `195.110.35.155`).

---

## 🔐 Étape finale (à exécuter une fois DNS propagé)

Une fois `dig sendfloo.sendbid.app` retourne `195.110.35.155`, lancez la commande SSL :

```bash
ssh root@195.110.35.155
certbot --nginx \
  -d sendbid.app -d www.sendbid.app -d sendfloo.sendbid.app -d api.sendbid.app \
  --non-interactive --agree-tos --email contact@sendbid.app --redirect
```

Certbot va automatiquement :
1. Vérifier que les domaines pointent bien vers le VPS.
2. Demander un certificat SSL gratuit.
3. Modifier la config Nginx pour servir en HTTPS.
4. Configurer l'auto-renouvellement (cron certbot.timer).

---

## 🧪 Tests à effectuer après SSL

```bash
# Marketing public
curl -I https://sendfloo.sendbid.app/             # 200
curl -I https://sendfloo.sendbid.app/pricing      # 200
curl -I https://sendfloo.sendbid.app/faq          # 200

# Panels (avant login → 200 avec formulaire login)
curl -I https://sendfloo.sendbid.app/admin        # 200
curl -I https://sendfloo.sendbid.app/agent        # 200
curl -I https://sendfloo.sendbid.app/superagent   # 200

# Redirect principal
curl -I https://sendbid.app/                      # 301 → https://sendfloo.sendbid.app/

# API mobile
curl https://sendbid.app/api/corridors | head     # JSON pays

# Login admin via curl
curl -c /tmp/c.txt -X POST https://sendfloo.sendbid.app/admin/login \
  -d "email=admin@sendbid.app&password=Admin@123!"
curl -b /tmp/c.txt https://sendfloo.sendbid.app/admin
```

---

## 📋 Commandes de gestion VPS

```bash
ssh root@195.110.35.155

# Voir les logs
pm2 logs sendbid-backend            # backend Python
tail -f /var/log/nginx/access.log   # accès HTTP
tail -f /var/log/nginx/error.log    # erreurs nginx

# Redémarrer un service
pm2 restart sendbid-backend
systemctl reload nginx
systemctl restart mongod

# Mise à jour code (depuis votre poste)
# 1. Build nouveau tar.gz
cd /app && tar --exclude='node_modules' --exclude='.expo' --exclude='__pycache__' \
  --exclude='.git' --exclude='dist' --exclude='backend/.venv' \
  -czf /tmp/sendbid.tar.gz backend frontend
# 2. Transfert
scp /tmp/sendbid.tar.gz root@195.110.35.155:/tmp/
# 3. Sur le VPS
ssh root@195.110.35.155
cd /var/www/sendbid
tar -xzf /tmp/sendbid.tar.gz
cd backend && .venv/bin/pip install -r requirements.txt --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
pm2 restart sendbid-backend
cd ../frontend && yarn install && npx expo export --platform web --output-dir dist
```

---

## 🔑 Credentials de production (à changer après tests)

> ⚠️ Ces credentials sont **identiques** au dev. **Changez-les immédiatement** après le premier login en production via l'API ou en base MongoDB.

| Panel | Email | Password |
|-------|-------|----------|
| Admin | admin@sendbid.app | Admin@123! |
| Super-Admin | superadmin@sendbid.app | SuperAdmin@123! |
| Partner-Admin | partner@sendbid.app | Partner@123! |
| Agent | agent@paybid.app | Agent@123! |
| Super-Agent | superagent@sendbid.app | Super@123! |

### Procédure changement password admin
```bash
ssh root@195.110.35.155
mongosh sendbid_prod
> db.users.updateOne(
    { email: "admin@sendbid.app" },
    { $set: { password_hash: "<bcrypt hash du nouveau mdp>" } }
  )
```

Ou via API :
```bash
TOKEN=$(curl -s -X POST https://sendbid.app/api/auth/login \
  -d '{"identifier":"admin@sendbid.app","password":"Admin@123!"}' \
  -H "Content-Type: application/json" | jq -r .access_token)
curl -X POST https://sendbid.app/api/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"old_password":"Admin@123!","new_password":"VotreNouveauMotDePasseFort!"}'
```

---

## 🛡️ Recommandations sécurité post-déploiement

- [ ] Changer **TOUS** les credentials seed
- [ ] Désactiver le seed automatique en prod (commenter l'appel à `seed` dans `server.py`)
- [ ] Configurer backup MongoDB quotidien (`mongodump` + cron + transfert externe)
- [ ] Activer fail2ban : `apt install fail2ban` + jail SSH + jail Nginx
- [ ] Monitoring : Netdata (`bash <(curl -fsSL https://my-netdata.io/kickstart.sh)`)
- [ ] Activer logs rotation (`/etc/logrotate.d/sendbid`)
- [ ] Désactiver root SSH login après création user dédié

---

## 📞 Support

En cas de problème, vérifier dans cet ordre :
1. `pm2 logs sendbid-backend --lines 50`
2. `systemctl status nginx mongod`
3. `tail -20 /var/log/nginx/error.log`
4. `curl -v http://127.0.0.1:8001/api/web/` (backend direct)
5. `curl -v -H "Host: sendfloo.sendbid.app" http://127.0.0.1/` (via nginx)
