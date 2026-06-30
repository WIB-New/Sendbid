import axios, { AxiosInstance } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

export const api: AxiosInstance = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 20000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("sb_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function apiError(e: any): string {
  const status = e?.response?.status;
  const detail = e?.response?.data?.detail;

  // Messages clairs par code HTTP
  if (status === 401) return "Email ou mot de passe incorrect.";
  if (status === 403) return "Accès refusé. Votre compte est peut-être suspendu ou votre session a expiré.";
  if (status === 404) return "Ressource introuvable.";
  if (status === 429) return "Trop de tentatives. Veuillez patienter quelques minutes.";
  if (status === 500) return "Erreur serveur. Veuillez réessayer dans quelques instants.";
  if (status === 503) return "Service temporairement indisponible. Réessayez plus tard.";

  if (!detail) return e?.message || "Erreur inconnue. Vérifiez votre connexion.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d: any) => d?.msg || JSON.stringify(d)).join(" ");
  return String(detail);
}

export function wsUrl(path: string, token?: string | null): string {
  const base = (BASE || "").replace(/^http/, "ws");
  const sep = path.includes("?") ? "&" : "?";
  return token ? `${base}${path}${sep}token=${encodeURIComponent(token)}` : `${base}${path}`;
}
