# Guide de déploiement SendBID / PayBID

> Ce guide explique comment déployer le projet sur un VPS avec un nom de domaine, et comment builder deux APK fonctionnels (SendBID client + PayBID agent).

---

## 1. Prérequis

### VPS
- Un serveur sous **Ubuntu 22.04/24.04** (ou équivalent).
- **Docker** et **Docker Compose** installés.
- Un reverse proxy (recommandé : **Dokploy**, **Traefik**, ou **Nginx Proxy Manager**).
- Un nom de domaine pointant vers le VPS.

### Recommandé : Dokploy
Le `docker-compose.yml` est déjà configuré pour Dokploy avec le réseau `dokploy-network` et les labels Traefik.

### Comptes externes
Les fonctionnalités suivantes nécessitent des clés API :

| Service | Obligatoire | Variable |
| --- | --- | --- |
| MongoDB | Oui | `MONGO_URL` |
| Stripe | Non (recommandé) | `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET` |
| PayPal | Non (recommandé) | `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET` |
| Twilio | Non (recommandé) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` |
| SendGrid | Non (recommandé) | `SENDGRID_API_KEY` |
| Firebase | Non (recommandé) | `firebase-service-account.json` |

---

## 2. Préparer le fichier `.env`

1. Copier le fichier `env-example.txt` en `.env` à la racine du projet :

```bash
cp env-example.txt .env
```

2. Modifier toutes les valeurs `votredomaine.com` par votre vrai nom de domaine.
3. Remplir les clés API nécessaires.

Exemple minimal requis :

```env
BACKEND_HOST=api.sendbid.app
ADMIN_HOST=admin.sendbid.app
FRONTEND_HOST=sendbid.sendbid.app
PUBLIC_BACKEND_URL=https://api.sendbid.app
EXPO_PUBLIC_BACKEND_URL=https://api.sendbid.app

MONGO_URL=mongodb+srv://...
DB_NAME=sendbid

JWT_SECRET=super_secret_aleatoire_64_chars
QR_HMAC_SECRET=autre_secret_aleatoire

ADMIN_EMAIL=admin@sendbid.app
ADMIN_PASSWORD=MonAdminPass123!
DEMO_CLIENT_EMAIL=demo@sendbid.app
DEMO_CLIENT_PASSWORD=Demo@2026!
DEMO_CLIENT_PIN=123456

ALLOWED_ORIGINS=https://sendbid.sendbid.app,https://api.sendbid.app,https://admin.sendbid.app
```

---

## 3. Déployer sur le VPS

### 3.1 Copier le projet sur le serveur

```bash
git clone https://github.com/votre-repo/SendBID.git
cd SendBID
```

Puis créer le `.env` sur le serveur.

### 3.2 Créer le réseau Docker (si nécessaire)

```bash
docker network create dokploy-network
```

### 3.3 Lancer le backend et le frontend web

```bash
docker compose up -d --build
```

Cela lance :
- le backend FastAPI sur le port `8000`
- le frontend web statique (Expo Web build) sur le port `80`

### 3.4 Vérifier le déploiement

```bash
# Backend
curl https://api.sendbid.app/api/health

# Frontend web
# Ouvrir https://sendbid.sendbid.app dans un navigateur

# Panel admin
# Ouvrir https://admin.sendbid.app/api/web/admin dans un navigateur
```

### 3.5 Vérifier les logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

---

## 4. Builder les APK Android (SendBID + PayBID)

Les APK sont construits via **EAS Build** (Expo Application Services).

### 4.1 Prérequis EAS

- Un compte Expo : https://expo.dev
- Être connecté localement :

```bash
cd sendbid
npx eas login
```

### 4.2 Configurer `eas.json`

Le fichier `sendbid/eas.json` contient déjà 4 profils :

- `preview` : APK SendBID (test interne)
- `preview-paybid` : APK PayBID (test interne)
- `production` : AAB SendBID (Play Store)
- `production-paybid` : AAB PayBID (Play Store)

### 4.3 Builder l'APK SendBID (client)

```bash
cd sendbid
npx eas build --platform android --profile preview --non-interactive
```

Le lien de téléchargement de l'APK sera affiché dans le terminal.

### 4.4 Builder l'APK PayBID (agent)

```bash
cd sendbid
npx eas build --platform android --profile preview-paybid --non-interactive
```

### 4.5 Builder les deux en production (Play Store)

```bash
npx eas build --platform android --profile production --non-interactive
npx eas build --platform android --profile production-paybid --non-interactive
```

> **Note** : les builds EAS utilisent le compte `wibuser` et le projectId configuré dans `app.config.js`. Si vous voulez utiliser votre propre compte Expo, modifiez `owner` et `extra.eas.projectId` dans `app.config.js`.

---

## 5. Important : variantes SendBID vs PayBID

La même codebase Expo gère les deux applications grâce à la variable d'environnement `APP_VARIANT`.

- `APP_VARIANT=sendbid` → application client SENDBID
- `APP_VARIANT=paybid` → application agent PAYBID

Cette variable est définie dans `eas.json` pour chaque profil de build, et dans `app.config.js` pour la configuration Expo (nom, package Android, couleurs).

---

## 6. Tester après déploiement

### Comptes de démo

| Rôle | Email | Mot de passe | PIN |
| --- | --- | --- | --- |
| Client | `DEMO_CLIENT_EMAIL` | `DEMO_CLIENT_PASSWORD` | `DEMO_CLIENT_PIN` |
| Agent | `AGENT_EMAIL` (à créer) | — | `AGENT_PIN` (à créer) |

### Vérifications rapides

1. Ouvrir l'APK SendBID → s'inscrire ou se connecter avec le compte démo.
2. Vérifier l'affichage du solde et de la devise.
3. Aller dans **Profil → Comptes liés** → ajouter un compte Mobile Money / Banque / PayPal.
4. Aller dans **Recharger** → choisir **Portefeuille mobile** → vérifier que le compte lié est sélectionné.
5. Aller dans **Retirer** → choisir **Portefeuille mobile** / **Banque** / **PayPal** → vérifier la sélection forcée.
6. Ouvrir l'APK PayBID → se connecter en tant qu'agent → scanner un QR de retrait client.

---

## 7. Points de vigilance

1. **HTTP vs HTTPS** : si vous utilisez `http://` (pas de certificat SSL), l'application Android refuse parfois les requêtes. Le paramètre `usesCleartextTraffic: true` est déjà activé dans `app.config.js` pour les builds preview.
2. **Clés API** : sans `STRIPE_API_KEY` / `PAYPAL_SECRET`, les paiements par carte/PayPal retourneront "non configuré".
3. **Notifications push** : nécessitent le fichier `google-services.json` pour Android et un compte Firebase.
4. **MongoDB** : si vous utilisez MongoDB Atlas, autorisez l'IP du VPS dans la whitelist.
5. **Domaine** : mettez à jour `EXPO_PUBLIC_BACKEND_URL` dans le `.env` avant chaque build APK.

---

## 8. Commandes utiles

```bash
# Rebuild après modification du code
docker compose up -d --build

# Voir les logs backend
docker compose logs -f backend

# Redémarrer un service
docker compose restart backend

# Vérifier TypeScript avant build
cd sendbid
npx tsc --noEmit

# Builder les deux APK
npx eas build --platform android --profile preview --non-interactive
npx eas build --platform android --profile preview-paybid --non-interactive
```

---

## 9. URLs après déploiement

| Service | URL |
| --- | --- |
| Frontend web | `https://sendbid.sendbid.app` |
| Backend API | `https://api.sendbid.app` |
| Panel admin | `https://admin.sendbid.app/api/web/admin` |
| Redirection principal | `https://sendbid.app` → `https://sendbid.sendbid.app` |

---

## 10. Fichiers importants modifiés pour ce déploiement

- `docker-compose.yml` : configurable via `.env`, routes Traefik pour backend/frontend/admin
- `sendbid/app.config.js` : support dynamique `sendbid` / `paybid`
- `sendbid/eas.json` : profils de build pour les deux variantes, URL backend mise à jour
- `sendbid/Dockerfile` : build statique Expo Web
- `env-example.txt` : variables d'environnement requises
- `deploy.sh` : script de déploiement automatique

---

## 11. Support

Si un build échoue, vérifier dans l'ordre :

1. `npx tsc --noEmit` passe sans erreur.
2. Les variables d'environnement sont bien définies dans le `.env`.
3. Le backend répond correctement sur `PUBLIC_BACKEND_URL`.
4. Le compte Expo / projectId dans `app.config.js` est valide.
