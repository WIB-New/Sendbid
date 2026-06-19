# 🚀 Déploiement Sendbid + Paybid sur VPS via Dokploy

Guide pas-à-pas pour déployer le monorepo Sendbid (client) + Paybid (agent) sur votre VPS Debian 13 avec Dokploy.

---

## 📋 Informations VPS

| Champ | Valeur |
|---|---|
| **Hostname** | `vps121136.serveur-vps.net` |
| **IP** | `195.110.35.155` |
| **OS** | Debian 13 |
| **Utilisateur SSH** | `root` |

## 🌐 Domaines

| Service | Domaine |
|---|---|
| Sendbid (client) | `app.sendfloo.sendbid.app` |
| Paybid (agent) | `agent.sendfloo.sendbid.app` |
| API backend | `api.sendfloo.sendbid.app` |
| Dokploy admin | `dokploy.sendfloo.sendbid.app` |

---

## 📍 Étape 1 — Configuration DNS (chez votre registrar)

Ajoutez ces **4 enregistrements A** pointant vers `195.110.35.155` :

```
Type  Nom                              Valeur            TTL
A     app.sendfloo                     195.110.35.155    300
A     agent.sendfloo                   195.110.35.155    300
A     api.sendfloo                     195.110.35.155    300
A     dokploy.sendfloo                 195.110.35.155    300
```

> 💡 Si votre zone DNS gère `sendfloo.sendbid.app` directement, ajoutez plutôt :
> - `dokploy` / `app` / `agent` / `api` → `195.110.35.155`
> 
> Un enregistrement wildcard `*.sendfloo` couvrirait également les 4 cas en une seule entrée.

Vérifiez avec : `dig app.sendfloo.sendbid.app +short` → doit renvoyer `195.110.35.155`.

---

## 📍 Étape 2 — Push du code sur GitHub

Dans **Emergent**, cliquez sur le bouton **"Push to GitHub"** (en haut à droite) et créez/connectez un dépôt **privé** (ex. `sendbid-app`).

Le push inclut automatiquement :
- ✅ Le `Dockerfile` backend (`/backend/Dockerfile`)
- ✅ Le `Dockerfile` frontend (`/frontend/Dockerfile`)
- ✅ Le `nginx.conf` frontend (`/frontend/nginx.conf`)
- ✅ Le `docker-compose.yml` racine
- ✅ Le `.env.production.example` racine
- ✅ Le script `deploy/install-dokploy.sh`
- ✅ Cette documentation

---

## 📍 Étape 3 — Installation de Dokploy sur le VPS

Connectez-vous en SSH :

```bash
ssh root@195.110.35.155
```

Lancez le script d'installation (méthode 1 — depuis GitHub) :

```bash
curl -fsSL https://raw.githubusercontent.com/<VOTRE_USER>/<VOTRE_REPO>/main/deploy/install-dokploy.sh | bash
```

OU méthode 2 — copie manuelle depuis votre machine locale :

```bash
# Sur votre Mac/PC, dans le repo cloné depuis GitHub :
scp deploy/install-dokploy.sh root@195.110.35.155:/root/
ssh root@195.110.35.155 'chmod +x /root/install-dokploy.sh && /root/install-dokploy.sh'
```

> ⏱ ~5–10 minutes — installe Docker, configure le firewall et déploie Dokploy.

À la fin, le script vous affiche :
`Dokploy UI : http://195.110.35.155:3000`

---

## 📍 Étape 4 — Premier accès Dokploy

1. Ouvrez `http://195.110.35.155:3000`
2. Créez le **compte admin** (email + mot de passe forts ; gardez-les en sécurité)
3. **Settings → Server → Domain** :
   - Domain : `dokploy.sendfloo.sendbid.app`
   - ✅ Activez **Let's Encrypt**
4. Attendez ~1 min — Dokploy obtient son certificat SSL et bascule sur HTTPS
5. Reconnectez-vous via `https://dokploy.sendfloo.sendbid.app`

---

## 📍 Étape 5 — Connecter votre dépôt GitHub

1. **Settings → Git → GitHub** → "Add GitHub Provider"
2. Autorisez l'app Dokploy GitHub à accéder à votre dépôt `sendbid-app`

---

## 📍 Étape 6 — Créer le projet Sendbid

1. **Dashboard → New Project** → nom : `sendbid`
2. **+ Add Service → Compose**
   - **Source** : Git (GitHub provider)
   - **Repository** : `<VOTRE_USER>/<VOTRE_REPO>`
   - **Branch** : `main`
   - **Compose path** : `docker-compose.yml`
   - **Compose type** : `docker-compose`
3. **Environment** : copiez le contenu de `.env.production.example` et remplacez TOUS les `CHANGEME` :
   - `JWT_SECRET` → `openssl rand -base64 64`
   - `MONGO_PASSWORD` → `openssl rand -base64 32`
   - Autres clés (Stripe / SendGrid / Twilio / PayPal / Emergent LLM) → les vraies valeurs prod
4. **Domains** : ajoutez les 3 entrées :

   | Host | Service | Container Port | HTTPS |
   |---|---|---|---|
   | `app.sendfloo.sendbid.app` | `frontend` | 80 | ✅ Let's Encrypt |
   | `agent.sendfloo.sendbid.app` | `frontend` | 80 | ✅ Let's Encrypt |
   | `api.sendfloo.sendbid.app` | `backend` | 8000 | ✅ Let's Encrypt |

5. **Deploy !** ⏱ ~5-15 min de build (Docker + Expo export web)

---

## 📍 Étape 7 — Vérifications post-déploiement

```bash
# Backend OK ?
curl -i https://api.sendfloo.sendbid.app/api/health
# → 200 OK attendu

# Sendbid charge ?
curl -I https://app.sendfloo.sendbid.app
# → 200 OK attendu (HTML)

# Paybid charge ?
curl -I https://agent.sendfloo.sendbid.app
# → 200 OK attendu
```

Connectez-vous avec les comptes demo :
- **Sendbid** : `client@sendbid.app` / `Client@123!` / PIN `123456`
- **Paybid** : `agent@paybid.app` / `Agent@123!` / PIN `123456`
- **Admin web** : `admin@sendbid.app` / `Admin@123!`

> ⚠️ **IMPORTANT** : changez immédiatement les mots de passe des comptes demo en prod via l'admin web !

---

## 🔧 Maintenance courante

### Re-déploiement automatique sur push GitHub
Activez **Auto Deploy** dans le projet Dokploy → chaque `git push` sur `main` redéploie automatiquement.

### Voir les logs
Dans Dokploy : **Service → Logs**

### Sauvegarde MongoDB
Dokploy → **Database → MongoDB → Backups** (S3 / local)

### Re-seed admin/agent demo
Sur le VPS :
```bash
docker compose -p sendbid exec backend python seed.py
```

### Mise à jour
```bash
# Depuis Emergent : "Push to GitHub" → Dokploy déploie automatiquement
# OU manuellement dans Dokploy : Service → Redeploy
```

---

## 🆘 En cas d'échec

| Symptôme | Solution |
|---|---|
| `502 Bad Gateway` sur api.* | Backend pas encore prêt — patientez 30s puis recheckez les logs |
| `ERR_SSL_PROTOCOL_ERROR` | DNS pas encore propagé — `dig` pour confirmer puis attendre |
| Build frontend très long (>10 min) | Normal : ~8 min pour `npx expo export -p web` au premier build |
| Erreur `MONGO_PASSWORD requis` | Vous avez oublié de configurer les env vars dans Dokploy |
| Docker installation échoue sur Debian 13 (trixie) | Le script utilise automatiquement le canal `bookworm` (compat binaire) |

---

## 📞 Support

- Dokploy docs : https://docs.dokploy.com
- Logs détaillés : Dokploy UI → service → tab "Logs"
- Healthcheck backend : `https://api.sendfloo.sendbid.app/api/health`
- Healthcheck frontend : `https://app.sendfloo.sendbid.app/healthz`

---

## 🔒 Recommandations sécurité post-installation

1. **Désactivez le login SSH par mot de passe** (utilisez une clé SSH) :
   ```bash
   # Sur votre Mac/PC :
   ssh-keygen -t ed25519 -C "votre-email"
   ssh-copy-id root@195.110.35.155
   # Puis sur le VPS :
   sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
   systemctl restart ssh
   ```
2. **Fermez le port 3000** une fois Dokploy migré sur son domaine HTTPS :
   ```bash
   ufw deny 3000/tcp
   ```
3. **Activez les sauvegardes MongoDB** dans Dokploy (S3 recommandé)
4. **Activez 2FA** sur Dokploy : Settings → Profile → Two-Factor Auth
5. **Changez régulièrement** les secrets JWT_SECRET et MONGO_PASSWORD
