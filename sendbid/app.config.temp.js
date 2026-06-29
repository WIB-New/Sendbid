/**
 * Configuration temporaire pour nouveau projet wibuser
 */
const variant = process.env.APP_VARIANT || "sendbid";
const isPaybid = variant === "paybid";

module.exports = {
  name: isPaybid ? "PAYBID-Temp" : "SENDBID-Temp",
  slug: "sendbid-temp-project",
  owner: "wibuser",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: isPaybid ? "paybid" : "sendbid",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: isPaybid ? "com.temp.paybid" : "com.temp.sendbid",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: isPaybid ? "#994A26" : "#00147E",
    },
    package: isPaybid ? "com.temp.paybid" : "com.temp.sendbid",
  }
};
