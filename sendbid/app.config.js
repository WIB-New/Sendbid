/**
 * Dynamic Expo config — switches between SENDBID (client) and PAYBID (agent)
 * at build/start time depending on APP_VARIANT env var.
 */
const variant = process.env.APP_VARIANT || process.env.EXPO_PUBLIC_APP_VARIANT || "sendbid";
const isPaybid = variant === "paybid";

module.exports = ({ config }) => ({
  ...config,
  name: isPaybid ? "PAYBID" : "SENDBID",
  slug: "sendbid-temp-project",
  owner: "wibuser",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: isPaybid ? "paybid" : "sendbid",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/images/splash-image.png",
    resizeMode: "contain",
    backgroundColor: isPaybid ? "#994A26" : "#00147E",
  },
  updates: {
    enabled: false,
  },
  extra: {
    ...config?.extra,
    appVariant: variant,
    eas: { projectId: "8d97965d-d3f2-44d4-b147-7deb5865def9" },
  },
  ios: {
    ...(config?.ios || {}),
    supportsTablet: true,
    bundleIdentifier: isPaybid ? "com.paybid.app" : "com.sendbid.app",
  },
  android: {
    ...(config?.android || {}),
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: isPaybid ? "#994A26" : "#00147E",
    },
    package: isPaybid ? "com.paybid.app" : "com.sendbid.app",
    googleServicesFile: "./google-services.json",
    usesCleartextTraffic: (process.env.EXPO_PUBLIC_BACKEND_URL || "").startsWith("http://"),
  }
});
