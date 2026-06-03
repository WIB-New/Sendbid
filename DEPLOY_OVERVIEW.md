# 🌐 SendFloo / SendBID — Cartographie des URLs & Plan de Déploiement VPS

> **Document maître** récapitulant : (1) liens publics/privés avec credentials, (2) plan de déploiement VPS LWS, (3) configuration spécifique du sous-domaine `sendfloo.sendbid.app`.

---

## 1. 🔗 Cartographie complète des URLs

### A. Site marketing (public — aucun login requis)

| Page | URL en local | URL prod (à déployer) |
|------|-------------|-----------------------|
| 🏠 Accueil | `http://localhost:8001/api/web/` | `https://sendfloo.sendbid.app/` |
| ⚡ Fonctionnalités | `/api/web/features` | `https://sendfloo.sendbid.app/features` |
| 💰 Tarifs | `/api/web/pricing` | `https://sendfloo.sendbid.app/pricing` |
| ❓ FAQ | `/api/web/faq` | `https://sendfloo.sendbid.app/faq` |
| ℹ️ À propos | `/api/web/about` | `https://sendfloo.sendbid.app/about` |
| 📱 Téléchargement | `/api/web/download` | `https://sendfloo.sendbid.app/download` |

### B. Panneaux web professionnels (authentification requise)

| Panel | URL prod | Email | Mot de passe | Rôle DB |
|-------|---------|-------|--------------|---------|
| 🛡️ **Admin** (rouge) | `https://sendfloo.sendbid.app/admin` | `admin@sendbid.app` | `Admin@123!` | `admin` |
| 🛡️ Super-Admin | `https://sendfloo.sendbid.app/admin` | `superadmin@sendbid.app` | `SuperAdmin@123!` | `super_admin` |
| 🛡️ Partner-Admin | `https://sendfloo.sendbid.app/admin` | `partner@sendbid.app` | `Partner@123!` | `partner_admin` |
| 👤 **Agent** (orange) | `https://sendfloo.sendbid.app/agent` | `agent@paybid.app` | `Agent@123!` | `agent` |
| ⭐ **Super-Agent** (violet) | `https://sendfloo.sendbid.app/superagent` | `superagent@sendbid.app` | `Super@123!` | `super_agent` |

#### Sections accessibles par panel
- **Admin** : Dashboard, Utilisateurs, Agents, Transferts, Enchères live, Wallets, Audit
- **Agent** : Dashboard, Enchères live, Mes transferts, Float multi-devises, Mes gains
- **Super-Agent** : Dashboard, Mon réseau, Transferts réseau, Override commission

### C. Application mobile (SendBID — clients)

| Action | URL/Compte |
|--------|-----------|
| App mobile (PWA / Expo Go) | `https://sendbid.app/` (Expo web build statique) |
| Login client démo | `client@sendbid.app` / `Client@123!` / PIN: `123456` |
| API publique | `https://sendbid.app/api/*` (FastAPI proxy) |

### D. Application agent (PayBID)

| Action | URL/Compte |
|--------|-----------|
| App mobile PayBID | Même domaine `sendbid.app` (route `/paybid/...`) |
| Login agent démo | `agent@paybid.app` / `Agent@123!` |

> ⚠️ Tous ces credentials sont **seed** (créés au démarrage du backend). En production, changez-les via l'API `PUT /api/auth/me` ou directement en base.

---

## 2. 🚀 Plan de déploiement complet sur VPS LWS

### 2.1. Architecture cible

```
                          ┌───────────────────┐
              Internet ──→│  Nginx (80/443)   │
                          │  Let's Encrypt    │
                          └────────┬──────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
  sendbid.app/             sendfloo.sendbid.app/      api.sendbid.app/
  (Expo Web statique       (FastAPI /api/web/         (FastAPI /api/*)
   pour SendBID PWA)        marketing + panels)        (réservé futur)
        │                          │                          │
        └──────────────────────────┴──────────────────────────┘
                                   │
                                   ▼
                          ┌───────────────────┐
                          │ FastAPI (8001)    │
                          │ pm2 / supervisor  │
                          └────────┬──────────┘
                                   │
                                   ▼
                          ┌───────────────────┐
                          │ MongoDB (27017)   │
                          │ systemd (mongod)  │
                          └───────────────────┘
```

### 2.2. Pré-requis VPS LWS

| Élément | Recommandé |
|---------|-----------|
| OS | Ubuntu 22.04 LTS ou Debian 12 |
| CPU / RAM | 2 vCPU minimum / 4 Go RAM minimum (8 Go conseillé) |
| Disque | 40 Go SSD minimum |
| Accès | SSH root + IPv4 publique fixe |
| Domaine | `sendbid.app` géré chez LWS |

### 2.3. DNS — à configurer dans le panel LWS

```
Type   Nom        Valeur          TTL
A      @          <IP_VPS>        3600    ← sendbid.app
A      www        <IP_VPS>        3600    ← www.sendbid.app
A      sendfloo   <IP_VPS>        3600    ← sendfloo.sendbid.app (panels + marketing)
A      api        <IP_VPS>        3600    ← api.sendbid.app (réservé futur)
```

### 2.4. Étapes (résumé — voir `/app/DEPLOY_VPS.md` pour les commandes complètes)

1. **Setup VPS** : `apt update`, installer Node 20, Python 3.11, MongoDB 7, Nginx, Certbot, ufw, fail2ban, pm2.
2. **MongoDB** : `systemctl enable --now mongod`, créer un user dédié `sendbid_prod` avec password.
3. **Cloner le code** : `git clone` ou transfert `scp` depuis Emergent (bouton "Download code").
4. **Backend FastAPI** : `python3.11 -m venv`, `pip install -r requirements.txt`, créer `.env` (voir 2.6), démarrer via pm2.
5. **Frontend Expo** : `yarn install`, `npx expo export --platform web --output-dir dist`.
6. **Nginx** : 3 server blocks (voir 2.7), `certbot --nginx` pour SSL.
7. **Vérifications** : `curl -I https://sendbid.app/`, `https://sendfloo.sendbid.app/`, tester login admin.
8. **Sécurité** : changer credentials seed, backups Mongo quotidiens, fail2ban SSH.

### 2.5. Backend env variables (production)

```bash
# /var/www/sendbid/backend/.env
MONGO_URL=mongodb://sendbid:<password>@localhost:27017/sendbid_prod?authSource=admin
DB_NAME=sendbid_prod
JWT_SECRET=<générer 64 caractères aléatoires>
ENVIRONMENT=production

# LLM
EMERGENT_LLM_KEY=<si vous voulez garder Emergent>
# ou
OPENAI_API_KEY=<si bascule directe>

# Paiements
STRIPE_API_KEY=sk_live_<votre clé>
STRIPE_WEBHOOK_SECRET=whsec_<votre webhook>
PAYPAL_CLIENT_ID=<live>
PAYPAL_CLIENT_SECRET=<live>

# Notifications
SENDGRID_API_KEY=<votre clé>
TWILIO_ACCOUNT_SID=<votre SID>
TWILIO_AUTH_TOKEN=<votre token>
TWILIO_FROM=+33XXXXXXXXX

# CORS (autorise les domaines prod)
CORS_ORIGINS=https://sendbid.app,https://www.sendbid.app,https://sendfloo.sendbid.app
```

### 2.6. Frontend env variables (build Expo)

```bash
# /var/www/sendbid/frontend/.env
EXPO_PUBLIC_BACKEND_URL=https://sendbid.app
```

> Le frontend Expo appelle `${EXPO_PUBLIC_BACKEND_URL}/api/...` — l'API reste sur le domaine principal.

### 2.7. Nginx — configuration complète

```nginx
# /etc/nginx/sites-available/sendbid.conf

# --- 1) sendbid.app + www : frontend SendBID (Expo web statique) + API ---
server {
  listen 80;
  server_name sendbid.app www.sendbid.app;

  root /var/www/sendbid/frontend/dist;
  index index.html;

  # SPA fallback pour Expo Router
  location / {
    try_files $uri $uri.html $uri/ /index.html;
  }

  # API backend (toutes les routes /api/*)
  location /api/ {
    proxy_pass http://127.0.0.1:8001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
    client_max_body_size 50M;
  }
}

# --- 2) sendfloo.sendbid.app : panels web + marketing ---
server {
  listen 80;
  server_name sendfloo.sendbid.app;

  # Marketing + panels (URL "propres" vers /api/web/*)
  # Ex: /pricing -> /api/web/pricing  |  /admin -> /api/web/admin
  location / {
    proxy_pass http://127.0.0.1:8001/api/web/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
  }

  # API JSON (pour les éventuels appels XHR depuis les panels)
  location /api/ {
    proxy_pass http://127.0.0.1:8001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
    client_max_body_size 50M;
  }
}
```

```bash
ln -s /etc/nginx/sites-available/sendbid.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# SSL HTTPS (les 3 domaines en une commande)
certbot --nginx \
  -d sendbid.app -d www.sendbid.app -d sendfloo.sendbid.app \
  --non-interactive --agree-tos --email votre@email.com --redirect
```

### 2.8. Test de bout en bout après déploiement

```bash
# Marketing public
curl -I https://sendfloo.sendbid.app/             # 200
curl -I https://sendfloo.sendbid.app/pricing      # 200
curl -I https://sendfloo.sendbid.app/faq          # 200

# Panels (page de login)
curl -I https://sendfloo.sendbid.app/admin        # 200 (form login)
curl -I https://sendfloo.sendbid.app/agent        # 200
curl -I https://sendfloo.sendbid.app/superagent   # 200

# App mobile
curl -I https://sendbid.app/                      # 200
curl https://sendbid.app/api/corridors | head     # JSON pays

# Login admin via curl
curl -c /tmp/c.txt -X POST https://sendfloo.sendbid.app/admin/login \
  -d "email=admin@sendbid.app&password=Admin@123!"
curl -b /tmp/c.txt https://sendfloo.sendbid.app/admin
```

---

## 3. 🎯 Spécificités pour le sous-domaine `sendfloo.sendbid.app`

### Points clés à comprendre

1. **URLs vues par l'utilisateur final** sur `sendfloo.sendbid.app` :
   - `https://sendfloo.sendbid.app/`        → page marketing accueil
   - `https://sendfloo.sendbid.app/pricing` → page tarifs
   - `https://sendfloo.sendbid.app/admin`   → panel admin (avec login form)
   - Nginx réécrit tout vers `http://127.0.0.1:8001/api/web/...`
2. **Cookies de session** : maintenant configurés en `path="/"` (corrigé dans cette session) pour fonctionner aussi bien sur `https://sendbid.app/api/web/admin` que sur `https://sendfloo.sendbid.app/admin`.
3. **Aucune modification de code requise** pour le sous-domaine : tout est géré par la couche Nginx.
4. **Pas de CORS** nécessaire : les panels et le marketing sont **server-rendered** (Jinja2), pas d'XHR cross-origin.
5. **Templates Jinja2** : les liens internes (footer, navigation) utilisent toujours `/api/web/...` actuellement → ils fonctionnent en passant par Nginx qui réécrit. **Optionnel** : on peut ajouter un middleware qui détecte l'header `X-Forwarded-Host: sendfloo.sendbid.app` et génère des URLs propres `/pricing` au lieu de `/api/web/pricing` (recommandé pour le SEO et l'esthétique).

### Amélioration optionnelle — URLs propres sur le sous-domaine

Si vous souhaitez que les liens internes du site (boutons "Découvrir", footer) génèrent `/pricing` au lieu de `/api/web/pricing` quand l'utilisateur est sur `sendfloo.sendbid.app`, je peux ajouter une variable `URL_PREFIX` détectée dynamiquement depuis le `Host` header.

---

## 4. 📋 Checklist déploiement (à cocher en SSH)

- [ ] Accès SSH root au VPS LWS confirmé
- [ ] DNS `sendbid.app`, `www`, `sendfloo`, `api` configurés et propagés (`dig sendfloo.sendbid.app`)
- [ ] Code transféré sur le VPS (`/var/www/sendbid`)
- [ ] MongoDB 7 installé + auth activée + backup quotidien planifié
- [ ] Backend `.env` créé avec **toutes** les clés réelles (Stripe LIVE, PayPal LIVE, etc.)
- [ ] `pm2 start sendbid-backend` → `pm2 save` → `pm2 startup`
- [ ] Frontend buildé : `npx expo export --platform web --output-dir dist`
- [ ] Nginx config copiée + `nginx -t` OK + reload
- [ ] Certbot HTTPS pour les 3 domaines + auto-renew activé
- [ ] Test login admin via le navigateur ✅
- [ ] Changement des credentials seed (admin, agent, superagent) via l'API
- [ ] Firewall ufw activé (`OpenSSH` + `Nginx Full` only)
- [ ] Fail2ban activé pour SSH + Nginx
- [ ] Backup MongoDB cron quotidien vers S3 ou stockage LWS
- [ ] Monitoring (Netdata / Uptime Kuma) déployé

---

## 5. 📞 Que faire en cas de problème ?

| Symptôme | Diagnostic |
|----------|-----------|
| 502 Bad Gateway | `pm2 logs sendbid-backend` puis `pm2 restart sendbid-backend` |
| 404 sur tous les panels | Vérifier que le router `web_panels` est bien inclus dans `server.py` |
| Cookie de session non envoyé | Vérifier `path=/` (corrigé) et SSL valide |
| MongoDB connection refused | `systemctl status mongod` + vérifier `MONGO_URL` |
| Certbot fail | `nginx -t`, vérifier DNS propagé (`dig`) |
| CORS error depuis app mobile | Vérifier `CORS_ORIGINS` dans `.env` backend |

---

**Statut actuel** : ✅ Code prêt pour déploiement. Cookies corrigés pour fonctionner sur sous-domaine. Tests backend 43/43 passés.
**Action utilisateur requise** : Fournir l'accès SSH au VPS LWS + l'IP publique pour démarrer le déploiement effectif (impossible depuis ce conteneur).
