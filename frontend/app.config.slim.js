/**
 * Configuration ultra-optimisée pour APKs < 100Mo
 */
const variant = process.env.APP_VARIANT || "sendbid";
const isPaybid = variant === "paybid";

module.exports = {
  name: isPaybid ? "PAYBID" : "SENDBID",
  slug: "sendbid-slim",
  owner: "wibuser",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: isPaybid ? "paybid" : "sendbid",
  userInterfaceStyle: "automatic",
  newArchEnabled: false, // Désactivé pour réduire la taille
  extra: {
    eas: {
      projectId: "8d97965d-d3f2-44d4-b147-7deb5865def9"
    }
  },
  ios: {
    supportsTablet: false, // Réduit la taille
    bundleIdentifier: isPaybid ? "com.wibuser.paybid" : "com.wibuser.sendbid",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: isPaybid ? "#994A26" : "#00147E",
    },
    package: isPaybid ? "com.wibuser.paybid" : "com.wibuser.sendbid",
    enableJetifier: true,
    enableHermes: true, // Hermes réduit la taille de l'APK
  }
};
