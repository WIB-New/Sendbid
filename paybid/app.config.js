/**
 * Dynamic Expo config — switches between SENDBID (client) and PAYBID (agent)
 * at build/start time depending on APP_VARIANT env var.
 */
const variant = "paybid";
const isPaybid = true;

const IS_EAS = process.env.EAS_BUILD === "true";

module.exports = ({ config }) => ({
  ...config,
  name: "PAYBID",
  slug: "sendbid-temp-project",
  ...(IS_EAS ? { owner: "wibuser" } : {}),
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "paybid",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  updates: {
    enabled: false,
  },
  extra: {
    ...config?.extra,
    eas: { projectId: "8d97965d-d3f2-44d4-b147-7deb5865def9" },
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
    usesCleartextTraffic: true,
  }
});
