/**
 * Push notifications utility — registers an Expo push token with the SENDBID
 * backend and configures handlers. Safe to call on web (no-ops). Designed for
 * Expo Go preview (Expo tokens) and EAS native builds (FCM/APNs auto-routed).
 */
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { api } from "./api";

let cachedToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    // Newer SDKs prefer the iOS-aware shape but we keep both for SDK 54
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureChannel() {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Notifications SENDBID",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0F75D6",
      enableVibrate: true,
    });
  } catch {
    // ignore — channel setup is best-effort
  }
}

export async function registerForPushAndSync(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) {
    // Push tokens require a real device or a dev simulator with FCM creds.
    return null;
  }
  try {
    await ensureChannel();
    const settings = await Notifications.getPermissionsAsync();
    let status = settings.status;
    if (status !== "granted") {
      const ask = await Notifications.requestPermissionsAsync();
      status = ask.status;
    }
    if (status !== "granted") return null;

    const tokenInfo = await Notifications.getExpoPushTokenAsync();
    const token = tokenInfo?.data;
    if (!token || token === cachedToken) return token || null;

    cachedToken = token;
    try {
      await api.post("/notifications/register-token", {
        token,
        platform: Platform.OS,
        device_name: Device.deviceName || `${Device.brand || ""} ${Device.modelName || ""}`.trim(),
        provider: token.startsWith("ExponentPushToken[") ? "expo" : "fcm",
      });
    } catch (err) {
      // Non-fatal — backend may not be reachable yet.
      console.warn("[push] register-token failed", err);
    }
    return token;
  } catch (err) {
    console.warn("[push] registerForPushAndSync failed", err);
    return null;
  }
}

export async function clearPushRegistration() {
  if (!cachedToken) return;
  try {
    await api.post("/notifications/unregister-token", { token: cachedToken });
  } catch {
    // ignore
  }
  cachedToken = null;
}

export function getCachedPushToken() {
  return cachedToken;
}
