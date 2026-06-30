# PAYBID - Application Mobile Agent

Application mobile pour les agents PayBID (retraits, commissions).

## Configuration

- **Backend** : `http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io`
- **Variante** : `paybid`
- **Package Android** : `com.paybid.app`

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
3. L'application PayBID se lance sur votre telephone

---

## 2. Builder l'APK PayBID

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
EXPO_PUBLIC_APP_VARIANT=paybid
APP_VARIANT=paybid
```

---

## Structure importante

```
paybid/
├── app/          # Pages de l'application
├── assets/       # Images et icones
├── app.config.js # Configuration Expo
├── eas.json      # Configuration build EAS
└── .env          # Variables d'environnement
```

---

# IGNOREZ CE QUI SUIT (contenu original Expo)

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
