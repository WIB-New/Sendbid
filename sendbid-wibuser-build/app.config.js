/**
 * Dynamic Expo config — switches between SENDBID (client) and PAYBID (agent)
 * at build/start time depending on `APP_VARIANT` env var.
 *
 * Build SENDBID : APP_VARIANT=sendbid eas build --profile preview-sendbid
 * Build PAYBID  : APP_VARIANT=paybid  eas build --profile preview-paybid
 */
const variant = process.env.APP_VARIANT || "sendbid";
const isPaybid = variant === "paybid";

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    eas: {
      ...config.extra?.eas,
      projectId: undefined
    }
  },
  name: isPaybid ? "PAYBID" : "SENDBID",
  slug: "sendbid-wibuser",
  owner: process.env.EXPO_OWNER || "albertfas",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: isPaybid ? "paybid" : "sendbid",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    ...(config.ios || {}),
    supportsTablet: true,
    // ⚠️ Doit MATCHER les package_name enregistrés dans google-services.json (sinon le task
    //     ':app:processReleaseGoogleServices' du build Android échoue avec
    //     "No matching client found for package name 'XXX'").
    //     Firebase Console enregistre com.sendbid.app et com.paybid.app — on s'aligne.
    bundleIdentifier: isPaybid ? "com.paybid.app" : "com.sendbid.app",
    infoPlist: {
      NSCameraUsageDescription: isPaybid
        ? "Scanner le QR / code client à la remise des fonds"
        : "Scanner les QR codes de transfert",
      NSPhotoLibraryUsageDescription: "Importer un avatar de profil",
      NSLocationWhenInUseUsageDescription: isPaybid
        ? "Vous localiser pour recevoir des enchères proches de vous"
        : "Suivre votre transfert VIP en temps réel",
      NSContactsUsageDescription: "Sélectionner un bénéficiaire dans vos contacts",
      NSFaceIDUsageDescription: "Connexion biométrique sécurisée",
    },
    config: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY || "",
    },
  },
  android: {
    ...(config.android || {}),
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: isPaybid ? "#994A26" : "#00147E",
    },
    package: isPaybid ? "com.paybid.app" : "com.sendbid.app",
    // ⚠️ DOIT MATCHER les package_name déclarés dans google-services.json (sinon le
    //     task ':app:processReleaseGoogleServices' du build Android échoue avec
    //     "No matching client found for package name 'XXX'").
    // Firebase config file pour les notifications push (FCM)
    // Le fichier google-services.json doit être présent à la racine /app/frontend/
    googleServicesFile: "./google-services.json",
    permissions: [
      "android.permission.CAMERA",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.READ_CONTACTS",
      "android.permission.USE_BIOMETRIC",
      "android.permission.USE_FINGERPRINT",
      "android.permission.RECEIVE_BOOT_COMPLETED",
      "android.permission.VIBRATE",
      "android.permission.WAKE_LOCK",
    ],
    edgeToEdgeEnabled: true,
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY || "",
      },
    },
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-secure-store",
    "expo-local-authentication",
    "expo-localization",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: isPaybid ? "#B1581E" : "#00147E",
      },
    ],
    "expo-web-browser",
  ],
  experiments: { typedRoutes: true },
  extra: {
    appVariant: variant,
    eas: {
      projectId: "7730c3d8-f109-491e-97fb-d55ab47b8bda",
    },
  },
});
