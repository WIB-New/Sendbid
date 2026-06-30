import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { api, apiError } from "./api";

const isWeb = Platform.OS === "web";
const secureSet = async (k: string, v: string) =>
  isWeb ? AsyncStorage.setItem(k, v) : SecureStore.setItemAsync(k, v);
const secureGet = async (k: string) => (isWeb ? AsyncStorage.getItem(k) : SecureStore.getItemAsync(k));
const secureDel = async (k: string) =>
  isWeb ? AsyncStorage.removeItem(k) : SecureStore.deleteItemAsync(k);

export type User = {
  id: string;
  profile_id: string;
  email: string;
  phone: string;
  full_name: string;
  email_verified: boolean;
  phone_verified: boolean;
  kyc_tier: number;
  kyc_status: string;
  loyalty_level: string;
  loyalty_points: number;
  biometric_enabled: boolean;
  avatar_url?: string | null;
  language: string;
  theme: string;
  notif_prefs?: { push: boolean; email: boolean; sms: boolean };
  pin_created?: boolean;
  has_pin?: boolean;
  country?: string | null;
  role?: "user" | "admin" | "super_admin" | "partner_admin" | "agent_admin";
};

export type Wallet = { id: string; user_id: string; balance: number; currency: string };

type AuthState = {
  user: User | null;
  wallet: Wallet | null;
  token: string | null;
  hydrated: boolean;
  setSession: (token: string, user: User) => Promise<void>;
  hydrate: () => Promise<void>;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
  setWallet: (w: Wallet) => void;
  saveBiometricToken: (t: string) => Promise<void>;
  getBiometricToken: () => Promise<string | null>;
  clearBiometricToken: () => Promise<void>;
};

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  wallet: null,
  token: null,
  hydrated: false,
  setSession: async (token, user) => {
    await AsyncStorage.setItem("sb_token", token);
    await AsyncStorage.setItem("sb_user", JSON.stringify(user));
    set({ token, user });
    try {
      const { data } = await api.get("/wallet");
      set({ wallet: data });
    } catch {}
  },
  hydrate: async () => {
    const token = await AsyncStorage.getItem("sb_token");
    const userStr = await AsyncStorage.getItem("sb_user");
    if (token && userStr) {
      try {
        const { data } = await api.get("/auth/me");
        set({ token, user: data.user, wallet: data.wallet, hydrated: true });
        return;
      } catch {
        await AsyncStorage.removeItem("sb_token");
        await AsyncStorage.removeItem("sb_user");
      }
    }
    set({ hydrated: true });
  },
  refreshMe: async () => {
    try {
      const { data } = await api.get("/auth/me");
      set({ user: data.user, wallet: data.wallet });
    } catch (e) {
      console.warn("refreshMe", apiError(e));
    }
  },
  logout: async () => {
    await AsyncStorage.removeItem("sb_token");
    await AsyncStorage.removeItem("sb_user");
    set({ user: null, wallet: null, token: null });
  },
  setUser: (u) => set({ user: u }),
  setWallet: (w) => set({ wallet: w }),
  saveBiometricToken: async (t) => {
    await secureSet("sb_biometric_token", t);
  },
  getBiometricToken: async () => secureGet("sb_biometric_token"),
  clearBiometricToken: async () => {
    await secureDel("sb_biometric_token");
  },
}));

// PIN session state (mémoire seulement, pas persisté)
type PinSessionState = {
  pinValidated: boolean;
  setPinValidated: (v: boolean) => void;
};
export const usePinSession = create<PinSessionState>((set) => ({
  pinValidated: false,
  setPinValidated: (v) => set({ pinValidated: v }),
}));

// Transfer flow draft (client side)
type DraftState = {
  draft: any;
  setDraft: (d: any) => void;
  patchDraft: (patch: any) => void;
  clear: () => void;
};
export const useDraft = create<DraftState>((set, get) => ({
  draft: null,
  setDraft: (d) => set({ draft: d }),
  patchDraft: (p) => set({ draft: { ...(get().draft || {}), ...p } }),
  clear: () => set({ draft: null }),
}));
