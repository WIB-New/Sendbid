/**
 * Dynamic Expo config — switches between SENDBID (client) and PAYBID (agent)
 * at build/start time depending on APP_VARIANT env var.
 */
const variant = process.env.APP_VARIANT || process.env.EXPO_PUBLIC_APP_VARIANT || "sendbid";
const isPaybid = variant === "paybid";

const IS_EAS = process.env.EAS_BUILD === "true";

module.exports = ({ config }) => ({
  ...config,
  name: isPaybid ? "PAYBID" : "SENDBID",
  slug: isPaybid ? "paybid-temp-project" : "sendbid-temp-project",
  ...(IS_EAS ? { owner: "wibuser" } : {}),
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: isPaybid ? "paybid" : "sendbid",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  updates: {
    enabled: false,
  },
  extra: {
    ...config?.extra,
    ...(IS_EAS ? { eas: { projectId: "8d97965d-d3f2-44d4-b147-7deb5865def9" } } : {}),
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
    usesCleartextTraffic: true,
  }
});
