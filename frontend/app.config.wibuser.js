/**
 * Configuration temporaire pour le compte wibuser
 */
const variant = process.env.APP_VARIANT || "sendbid";
const isPaybid = variant === "paybid";

module.exports = ({ config }) => ({
  ...config,
  name: isPaybid ? "PAYBID-Wibuser" : "SENDBID-Wibuser",
  slug: "sendbid-wibuser-dev",
  owner: "wibuser",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: isPaybid ? "paybid" : "sendbid",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  extra: {
    eas: {
      projectId: undefined // Force création nouveau projet
    }
  },
  ios: {
    ...(config.ios || {}),
    supportsTablet: true,
    bundleIdentifier: isPaybid ? "com.wibuser.paybid" : "com.wibuser.sendbid",
  },
  android: {
    ...(config.android || {}),
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: isPaybid ? "#994A26" : "#00147E",
    },
    package: isPaybid ? "com.wibuser.paybid" : "com.wibuser.sendbid",
  }
});
