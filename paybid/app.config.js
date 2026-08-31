/**
 * Dynamic Expo config — switches between SENDBID (client) and PAYBID (agent)
 * at build/start time depending on APP_VARIANT env var.
 */
const variant = "paybid";
const isPaybid = true;

module.exports = ({ config }) => ({
  ...config,
  name: "PAYBID",
  slug: "paybid",
  owner: "wibuser",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "paybid",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/images/splash-image.png",
    resizeMode: "contain",
    backgroundColor: "#994A26",
  },
  updates: {
    enabled: false,
  },
  extra: {
    ...config?.extra,
    appVariant: "paybid",
    eas: { projectId: "12851403-ae70-4e23-8cdd-f65e1405d270" },
  },
  ios: {
    ...(config?.ios || {}),
    supportsTablet: true,
    bundleIdentifier: "com.paybid.app",
  },
  android: {
    ...(config?.android || {}),
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#994A26",
    },
    package: "com.paybid.app",
    googleServicesFile: "./google-services.json",
    usesCleartextTraffic: (process.env.EXPO_PUBLIC_BACKEND_URL || "").startsWith("http://"),
  }
});
