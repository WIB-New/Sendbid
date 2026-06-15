# 🚀 Déploiement Dokploy — SENDBID/PAYBID

Guide étape par étape pour déployer après l'audit du 12/06/2026.

## 📦 Prérequis

- Serveur Dokploy actif
- Réseau Docker `dokploy-network` existant (créé automatiquement par Dokploy)
- Domaines DNS configurés (A records) :
  - `api.sendfloo.sendbid.app` → IP du serveur Dokploy
  - `sendfloo.sendbid.app` → IP du serveur Dokploy
- MongoDB accessible (instance dédiée ou Atlas)

## ✅ Étape 1 — Pousser le code

1. Dans Emergent, cliquez sur **"Save to GitHub"** (en haut à droite).
2. Sélectionnez le repository lié à Dokploy.
3. Choisissez la branche cible (`main` généralement).
4. Validez le push avec le message :
   ```
   chore(deploy): Dokploy audit 12/06/2026 — secrets externalized, Stripe SDK official, frontend service
   ```

## ✅ Étape 2 — Configurer les variables d'environnement Dokploy

1. Dans Dokploy, ouvrez le service **backend**.
2. Onglet **Environment Variables**.
3. Cliquez **Bulk Import** (ou "Edit raw").
4. Copiez-collez le contenu de `deploy/.env.dokploy.example` puis remplissez les valeurs réelles.
5. **Variables rouges (🔴) obligatoires** sinon le serveur ne démarrera pas :
   - `MONGO_URL`, `JWT_SECRET`, `QR_HMAC_SECRET`
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`
   - `DEMO_CLIENT_EMAIL`, `DEMO_CLIENT_PASSWORD`, `DEMO_CLIENT_PIN`
   - `PUBLIC_BACKEND_URL`, `ALLOWED_ORIGINS`

## ✅ Étape 3 — Configurer le service frontend (build args)

Dans Dokploy, sur le service **frontend** :

```
EXPO_PUBLIC_BACKEND_URL     = https://api.sendfloo.sendbid.app
EXPO_PUBLIC_STRIPE_PK       = pk_live_xxxxx
EXPO_PUBLIC_APP_VARIANT     = sendbid     # ou paybid
GOOGLE_MAPS_IOS_API_KEY     = AIzaSyxxx
GOOGLE_MAPS_ANDROID_API_KEY = AIzaSyxxx
```

## ✅ Étape 4 — Volume Firebase (si Push Notifications activées)

Si vous utilisez les push notifications Firebase, mappez le service-account dans le conteneur :

```yaml
# Dans docker-compose.yml, section backend :
    volumes:
      - /etc/sendbid/firebase-service-account.json:/app/secrets/firebase-service-account.json:ro
```

Déposez votre fichier `firebase-service-account.json` sur le serveur Dokploy avant le deploy.

## ✅ Étape 5 — Déploiement

1. Dans Dokploy, cliquez **Deploy** sur le service backend.
2. Attendez que le healthcheck passe au vert (~40s après le start, cf. `start_period`).
3. Faites de même pour le service frontend.
4. Vérifiez :
   - `https://api.sendfloo.sendbid.app/api/health` → doit retourner 200 OK
   - `https://sendfloo.sendbid.app` → doit afficher l'app Expo Web

## 🔍 Vérifications post-déploiement

```bash
# Healthcheck backend
curl -s https://api.sendfloo.sendbid.app/api/health

# Login admin
curl -X POST https://api.sendfloo.sendbid.app/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"admin@sendbid.app","password":"VOTRE_ADMIN_PASSWORD"}'

# Packages Stripe (nécessite token)
curl -H "Authorization: Bearer TOKEN" https://api.sendfloo.sendbid.app/api/payments/packages
```

## 🚨 Rollback

En cas de problème après deploy :
- Dokploy → Service → **Deployments** → Cliquez sur la version précédente → **Redeploy**

## 🔐 Sécurité — Règle d'or

**Aucune** valeur de variable d'environnement ne doit JAMAIS apparaître dans :
- `docker-compose.yml`
- `Dockerfile`
- Code Python ou TypeScript
- Commit Git

Toutes les valeurs vivent **exclusivement** dans l'interface Dokploy.
