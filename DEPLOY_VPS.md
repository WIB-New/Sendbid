# 🚀 Guide de déploiement SendBID/PayBID sur VPS LWS

## Prérequis
- VPS Ubuntu 22.04 LTS / Debian 12
- Accès root SSH
- Domaine `sendbid.app` géré chez LWS (DNS)
- Au moins 2 vCPU + 4 Go RAM

## 1. Configuration DNS chez LWS

Dans le panel DNS de LWS pour `sendbid.app` :
```
Type  Name      Value            TTL
A     @         <IP_VPS>         3600
A     www       <IP_VPS>         3600
A     sendfloo  <IP_VPS>         3600
A     api       <IP_VPS>         3600
```

## 2. Setup initial du VPS

```bash
# SSH
ssh root@<IP_VPS>

# Update + dépendances système
apt update && apt upgrade -y
apt install -y curl git nginx certbot python3-certbot-nginx \
  python3.11 python3.11-venv python3-pip mongodb-org \
  build-essential ufw fail2ban

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g yarn pm2

# Firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

## 3. MongoDB

```bash
# Importer la clé GPG MongoDB officielle
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update && apt install -y mongodb-org
systemctl enable --now mongod

# Vérifier
mongosh --eval "db.runCommand({ ping: 1 })"
```

## 4. Cloner le code source

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/<votre-user>/<votre-repo>.git sendbid
cd sendbid
```

> 💡 **Astuce** : Si pas encore sur Git, faites un `tar` depuis Emergent (bouton "Download code") puis transférez via `scp` au VPS.

## 5. Backend FastAPI

```bash
cd /var/www/sendbid/backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Créer le fichier .env
cat > .env << 'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=sendbid_prod
JWT_SECRET=<générer-un-secret-fort-64-caractères>
EMERGENT_LLM_KEY=<si-utilisé>
STRIPE_API_KEY=<votre-clé-stripe-live>
PAYPAL_CLIENT_ID=<votre-paypal>
PAYPAL_CLIENT_SECRET=<votre-paypal-secret>
SENDGRID_API_KEY=<votre-sendgrid>
TWILIO_ACCOUNT_SID=<twilio>
TWILIO_AUTH_TOKEN=<twilio>
EOF

# Test que ça démarre
uvicorn server:app --host 0.0.0.0 --port 8001
# Ctrl+C une fois OK
```

### Supervisor (PM2 pour Python aussi)
```bash
pm2 start --name sendbid-backend --interpreter /var/www/sendbid/backend/.venv/bin/python \
  -- /var/www/sendbid/backend/.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 \
  --cwd /var/www/sendbid/backend
pm2 save
pm2 startup systemd  # exécuter la commande affichée
```

## 6. Frontend Expo (build web)

```bash
cd /var/www/sendbid/frontend
yarn install
# Build statique du frontend Expo en mode web
npx expo export --platform web --output-dir dist
# Le dossier `dist/` contient tout le frontend statique
```

## 7. Nginx — Reverse proxy + SSL

```bash
cat > /etc/nginx/sites-available/sendbid.app << 'EOF'
# Frontend principal : sendbid.app + www
server {
  listen 80;
  server_name sendbid.app www.sendbid.app;

  root /var/www/sendbid/frontend/dist;
  index index.html;

  location / {
    try_files $uri $uri.html $uri/ /index.html;
  }

  # Backend API
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

# Sous-domaine sendfloo : panels web
server {
  listen 80;
  server_name sendfloo.sendbid.app;

  # Toutes les routes vont vers le backend (panels HTML + API)
  location / {
    proxy_pass http://127.0.0.1:8001/api/web/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:8001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
    client_max_body_size 50M;
  }
}
EOF

ln -s /etc/nginx/sites-available/sendbid.app /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

## 8. SSL Let's Encrypt

```bash
certbot --nginx -d sendbid.app -d www.sendbid.app -d sendfloo.sendbid.app \
  --non-interactive --agree-tos --email <votre@email>
# Auto-renouvellement déjà configuré via systemd timer
```

## 9. Vérifications finales

```bash
# Tester routes
curl -I https://sendbid.app/                              # → 200
curl -I https://sendbid.app/api/health                    # → 200 (si endpoint health existe)
curl -I https://sendfloo.sendbid.app/                     # → 200 (landing panels)
curl -I https://sendfloo.sendbid.app/admin                # → 200 (panel admin)
curl -I https://sendfloo.sendbid.app/agent                # → 200
curl -I https://sendfloo.sendbid.app/superagent           # → 200

# Logs
pm2 logs sendbid-backend
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## 10. Mises à jour ultérieures

```bash
cd /var/www/sendbid
git pull
# Backend
cd backend && source .venv/bin/activate && pip install -r requirements.txt && pm2 restart sendbid-backend
# Frontend
cd ../frontend && yarn install && npx expo export --platform web --output-dir dist
```

## 🔐 Sécurité production

- Changez tous les mots de passe seedés (admin@sendfloo, agent@sendfloo, etc.)
- Activez backups MongoDB quotidiens (`mongodump` + cron + S3)
- Configurez fail2ban pour SSH
- Activez monitoring (Netdata ou similaire)
- Activez audit logs sur les actions admin

---
📞 **En cas de problème** : vérifier `pm2 logs`, `nginx -t`, `systemctl status mongod`, `certbot certificates`.
