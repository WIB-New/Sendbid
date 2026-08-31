import axios, { AxiosInstance } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PRODUCTION_URL = "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io";
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || PRODUCTION_URL;

if (!process.env.EXPO_PUBLIC_BACKEND_URL) {
  console.warn("[API] EXPO_PUBLIC_BACKEND_URL n'est pas définie. Utilisation du fallback de production.");
}

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
  const message = e?.response?.data?.message;

  // On privilégie le message exact du backend s'il est fourni
  if (typeof detail === "string" && detail.trim()) return detail;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(detail)) return detail.map((d: any) => d?.msg || JSON.stringify(d)).join(" ");

  // Fallbacks par code HTTP seulement si le backend n'a pas donné de message
  if (status === 400) return "Requête invalide. Veuillez vérifier vos informations.";
  if (status === 401) return "Session invalide ou identifiants incorrects. Veuillez vous reconnecter.";
  if (status === 403) return "Accès refusé. Votre compte est peut-être suspendu ou votre session a expiré.";
  if (status === 404) return "Ressource introuvable.";
  if (status === 422) return "Certains champs sont incorrects ou incomplets. Veuillez vérifier votre saisie.";
  if (status === 429) return "Trop de tentatives. Veuillez patienter quelques minutes.";
  if (status === 500) return "Erreur serveur. Veuillez réessayer dans quelques instants.";
  if (status === 503) return "Service temporairement indisponible. Réessayez plus tard.";

  return e?.message || "Erreur inconnue. Vérifiez votre connexion.";
}

export function wsUrl(path: string, token?: string | null): string {
  const base = (BASE || "").replace(/^http/, "ws");
  const sep = path.includes("?") ? "&" : "?";
  return token ? `${base}${path}${sep}token=${encodeURIComponent(token)}` : `${base}${path}`;
}
