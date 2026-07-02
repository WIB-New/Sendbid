# SENDBID - Application Mobile Client
PS C:\Users\Utilisateur\Desktop\Sendfloo.SendBID-06juin2026\sendbid> $env:EXPO_DEVTOOLS_LISTEN_ADDRESS="192.168.1.113"; $env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.113"; npx expo start --offline --clear --port 8084  


pour build apk sur exp 

npx eas-cli build -p android --profile preview


Application mobile pour les clients SendBID (envoi d'argent, encheres).

## Configuration

- **Backend** : `http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io`
- **Variante** : `sendbid`
- **Package Android** : `com.sendbid.app`

---

## 1. Lancer l'app avec QR Code (test sur telephone)

### Installer les dependances
```bash
npm install
```

### Lancer le serveur Expo
```bash
npx expo start --dev-client --clear
```

### Scanner le QR Code
1. Ouvrez **Expo Go** sur votre telephone Android
2. Scannez le QR code qui apparait dans le terminal
3. L'application SendBID se lance sur votre telephone

---

## 2. Builder l'APK SendBID

### Build preview (APK a telecharger)
```bash
npx eas build --platform android --profile preview --non-interactive
```

### Suivre le build
Le lien du build apparait dans le terminal.
Connectez-vous sur https://expo.dev avec le compte **wibuser** pour telecharger l'APK.

---

## Variables d'environnement (.env)

```
EXPO_PUBLIC_BACKEND_URL=http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io
EXPO_PUBLIC_APP_VARIANT=sendbid
APP_VARIANT=sendbid
```

---

## Structure importante

```
sendbid/
├── app/          # Pages de l'application
├── assets/       # Images et icones
├── app.config.js # Configuration Expo
├── eas.json      # Configuration build EAS
└── .env          # Variables d'environnement
```
