# SendBID / PayBID - Guide de demarrage

## 1. Lancer le Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Le backend sera accessible sur : `http://localhost:8000`
Health check : `http://localhost:8000/api/health`

---

## 2. Lancer l'app SendBID (QR Code)

```bash
cd sendbid
npm install
npx expo start --dev-client --clear
```

Scannez le QR code avec Expo Go sur votre telephone.

---

## 3. Lancer l'app PayBID (QR Code)

```bash
cd paybid
npm install
npx expo start --dev-client --clear
```

Scannez le QR code avec Expo Go sur votre telephone.

---

## 4. Builder les APKs

### SendBID APK
```bash
cd sendbid
npx eas build --platform android --profile preview --non-interactive
```

### PayBID APK
```bash
cd paybid
npx eas build --platform android --profile preview --non-interactive
```

Telechargez les APKs sur : https://expo.dev/accounts/wibuser/projects/sendbid-temp-project/builds

---

## Structure du projet

```
Sendfloo.SendBID-06juin2026/
├── backend/    - Serveur API FastAPI + MongoDB
├── sendbid/    - App mobile client (envoi argent, encheres)
├── paybid/     - App mobile agent (retraits, commissions)
├── deploy/     - Configuration deploiement
└── docs/       - Documentation
```

---

## Backend en ligne (production)

URL : `http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io`
Health : `{"status":"ok","mongo":"up"}`
