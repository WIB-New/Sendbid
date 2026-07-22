# Guide Dokploy — Déploiement SendBID / PayBID

> Ce guide explique étape par étape comment déployer le projet sur Dokploy avec les domaines `sendbid.app` et `sendbid.sendbid.app`.

---

## 1. Prérequis dans Dokploy

- Accès à l'interface Dokploy : `http://149.202.61.20:3000`
- Le serveur Dokploy a Docker et Traefik actifs (IP : `149.202.61.20`)
- Votre nom de domaine `sendbid.app` pointe vers `149.202.61.20`
- Les sous-domaines suivants configurés en DNS type A vers `149.202.61.20` :
  - `sendbid.app`
  - `sendbid.sendbid.app`
  - `api.sendbid.app`
  - `admin.sendbid.app`

---

## 2. Créer un projet dans Dokploy

1. Cliquer sur **Projects** → **Create project**
2. Nom du projet : `sendbid`
3. Cliquer sur **Create**

---

## 3. Ajouter une application Docker Compose

1. Dans le projet `sendbid`, cliquer sur **Create Service**
2. Choisir **Docker Compose**
3. Nom du service : `sendbid-stack`
4. Source : **Git**
5. Remplir :
   - Repository : l'URL de ton repo Git (`https://github.com/ton-compte/SendBID.git`)
   - Branch : `main` (ou ta branche principale)
   - Compose file : `docker-compose.yml`
6. Cliquer sur **Create**

---

## 4. Configurer les variables d'environnement

Dans l'application `sendbid-stack`, aller dans l'onglet **Environment**.

Copier-coller le contenu du fichier `env-example.txt` (à la racine du projet) et remplacer les valeurs.

### Variables obligatoires minimum

```env
BACKEND_HOST=api.sendbid.app
ADMIN_HOST=admin.sendbid.app
FRONTEND_HOST=sendbid.sendbid.app
PUBLIC_BACKEND_URL=https://api.sendbid.app
EXPO_PUBLIC_BACKEND_URL=https://api.sendbid.app

MONGO_URL=mongodb+srv://user:password@cluster.mongodb.net/sendbid?retryWrites=true&w=majority
DB_NAME=sendbid

JWT_SECRET=remplace_par_une_longue_chaine_aleatoire
QR_HMAC_SECRET=remplace_par_une_autre_longue_chaine_aleatoire

ENVIRONMENT=production

ADMIN_EMAIL=admin@sendbid.app
ADMIN_PASSWORD=MonSuperAdminPass123!
DEMO_CLIENT_EMAIL=demo@sendbid.app
DEMO_CLIENT_PASSWORD=Demo@2026!
DEMO_CLIENT_PIN=123456

ALLOWED_ORIGINS=https://sendbid.sendbid.app,https://api.sendbid.app,https://admin.sendbid.app
```

### Variables optionnelles (mais recommandées)

```env
STRIPE_API_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
EXPO_PUBLIC_STRIPE_PK=pk_test_...

PAYPAL_CLIENT_ID=...
PAYPAL_SECRET=...
PAYPAL_MODE=sandbox

TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1234567890
TWILIO_FROM_PHONE=+1234567890

SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=noreply@sendbid.app
SENDGRID_FROM_NAME=SENDBID
```

Cliquer sur **Update** pour sauvegarder.

---

## 5. Vérifier le réseau Docker

Dokploy crée automatiquement un réseau Traefik, mais le `docker-compose.yml` attend `dokploy-network`.

Dans Dokploy, vérifier que le réseau externe `dokploy-network` existe :
- Aller dans **Servers** → **Your server** → **Networks**
- Si `dokploy-network` n'existe pas, cliquer sur **Create network** :
  - Name : `dokploy-network`
  - Driver : `bridge`
  - Cochez **External** (ou laissez Dokploy le gérer)

Alternative : remplacer dans `docker-compose.yml` le réseau externe par le réseau Dokploy par défaut.

---

## 6. Configurer les domaines dans Dokploy

Dokploy va lire les labels Traefik dans `docker-compose.yml`.

Les labels suivants sont déjà configurés :

```yaml
# Backend + Admin
- traefik.http.routers.sendbid-api.rule=Host(`api.sendbid.app`) || Host(`admin.sendbid.app`)

# Frontend
- traefik.http.routers.sendbid-frontend.rule=Host(`sendbid.sendbid.app`) || Host(`sendbid.app`)
```

### Étapes dans Dokploy :

1. Aller dans l'application `sendbid-stack`
2. Onglet **Domains**
3. Ajouter les domaines suivants (Dokploy génère automatiquement les certificats Let's Encrypt) :
   - `sendbid.app`
   - `sendbid.sendbid.app`
   - `api.sendbid.app`
   - `admin.sendbid.app`
4. S'assurer que HTTPS est activé (certificat auto-généré par Dokploy/Traefik)

> **Note** : le `docker-compose.yml` utilise `entrypoints=web` (HTTP). Dokploy gère généralement le HTTPS automatiquement via Traefik. Si ce n'est pas le cas, changer `entrypoints=web` en `entrypoints=websecure` ou laisser Dokploy forcer le HTTPS.

---

## 7. Déployer

1. Dans l'application `sendbid-stack`, aller dans l'onglet **Deployments**
2. Cliquer sur **Deploy**
3. Attendre que le build et le démarrage se terminent (3 à 10 minutes)
4. Vérifier les logs dans l'onglet **Logs**

---

## 8. Vérifier le déploiement

### Backend API

```bash
curl https://api.sendbid.app/api/health
```

Résultat attendu : `{"status":"ok"}` ou similaire.

### Frontend web

Ouvrir dans un navigateur :

```
https://sendbid.sendbid.app
```

### Panel admin

```
https://admin.sendbid.app/api/web/admin
```

---

## 9. Forcer HTTPS (important pour les APK)

Le `docker-compose.yml` actuel utilise `entrypoints=web` (HTTP). Il faut que Dokploy/Traefik redirige automatiquement HTTP vers HTTPS.

### Option A : laisser Dokploy gérer
Dans **Domains**, activez l'option **HTTPS** et la redirection HTTP → HTTPS.

### Option B : ajouter un middleware dans docker-compose.yml

Ajouter dans les labels du service `backend` et `frontend` :

```yaml
- traefik.http.routers.sendbid-api.entrypoints=websecure
- traefik.http.routers.sendbid-api.tls.certresolver=letsencrypt

- traefik.http.routers.sendbid-frontend.entrypoints=websecure
- traefik.http.routers.sendbid-frontend.tls.certresolver=letsencrypt
```

Puis redeployer.

---

## 10. Builder les APK après déploiement

Une fois le backend en ligne sur `https://api.sendbid.app`, tu peux builder les APK.

### Depuis ton ordinateur local

```bash
cd sendbid

# Connexion Expo
npx eas login

# APK SendBID client
npx eas build --platform android --profile preview --non-interactive

# APK PayBID agent
npx eas build --platform android --profile preview-paybid --non-interactive
```

Les liens de téléchargement s'affichent dans le terminal.

---

## 11. Tester les applications

### SendBID client

1. Installer l'APK SendBID sur un téléphone Android
2. Ouvrir l'application
3. Se connecter avec le compte démo :
   - Email : `demo@sendbid.app`
   - Mot de passe : celui défini dans `DEMO_CLIENT_PASSWORD`
   - PIN : `123456`
4. Vérifier le solde, ajouter un compte lié, recharger/retirer

### PayBID agent

1. Installer l'APK PayBID
2. Se connecter avec un compte agent (à créer via le panel admin ou seed)
3. Tester le scan QR et le cash-in/cash-out

---

## 12. Dépannage Dokploy

### Problème : le backend ne démarre pas

Vérifier les logs :
- Variables d'environnement manquantes (`JWT_SECRET`, `MONGO_URL`, etc.)
- Réseau `dokploy-network` introuvable
- Port 8000 déjà utilisé

### Problème : le frontend affiche une erreur réseau

Vérifier :
- `EXPO_PUBLIC_BACKEND_URL` pointe bien vers `https://api.sendbid.app`
- Le certificat HTTPS est valide
- `ALLOWED_ORIGINS` contient le domaine frontend

### Problème : le panel admin est inaccessible

Vérifier :
- Le domaine `admin.sendbid.app` est bien configuré
- Le label Traefik route bien vers le backend
- Le compte admin existe en base de données

### Problème : build EAS échoue

Vérifier :
- `npx tsc --noEmit` passe sans erreur
- Le compte Expo `wibuser` est valide
- Le `projectId` dans `app.config.js` est correct

---

## 13. Commandes utiles via SSH sur le serveur Dokploy

```bash
# Se connecter au serveur
ssh root@IP_DU_SERVEUR

# Voir les conteneurs
docker ps

# Voir les logs backend
docker logs sendbid-stack-backend-1 -f

# Voir les logs frontend
docker logs sendbid-stack-frontend-1 -f

# Redémarrer
docker compose -f /path/to/docker-compose.yml restart backend
```

---

## Récapitulatif des URLs

| Service | URL publique |
| --- | --- |
| Frontend web | `https://sendbid.sendbid.app` |
| Domaine principal | `https://sendbid.app` → redirige vers `https://sendbid.sendbid.app` |
| Backend API | `https://api.sendbid.app` |
| Panel admin | `https://admin.sendbid.app/api/web/admin` |
