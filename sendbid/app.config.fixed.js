/**
 * Configuration corrigée pour résoudre Network Error et variantes
 */
const variant = process.env.APP_VARIANT || "sendbid";
const isPaybid = variant === "paybid";

module.exports = {
  name: isPaybid ? "PAYBID" : "SENDBID",
  slug: isPaybid ? "paybid-fixed" : "sendbid-fixed", // Slugs différents !
  owner: "wibuser",
  version: "1.0.1",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: isPaybid ? "paybid" : "sendbid",
  userInterfaceStyle: "automatic",
  newArchEnabled: false,
  extra: {
    eas: {
      projectId: "8d97965d-d3f2-44d4-b147-7deb5865def9"
    },
    // Variables pour l'application
    APP_VARIANT: variant,
    EXPO_PUBLIC_APP_VARIANT: variant,
    EXPO_PUBLIC_BACKEND_URL: "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io"
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: isPaybid ? "com.wibuser.paybid" : "com.wibuser.sendbid",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: isPaybid ? "#994A26" : "#00147E",
    },
    package: isPaybid ? "com.wibuser.paybid" : "com.wibuser.sendbid",
    enableJetifier: true,
    enableHermes: true,
  }
};
