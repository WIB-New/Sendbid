/**
 * i18n — FR/EN/ES/AR setup for SENDBID & PAYBID.
 * Uses i18n-js + expo-localization to detect the device locale.
 */
import { I18n } from "i18n-js";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import fr from "./fr";
import en from "./en";
import es from "./es";
import ar from "./ar";

export const i18n = new I18n({ fr, en, es, ar });
i18n.enableFallback = true;
i18n.defaultLocale = "fr";

export const SUPPORTED_LOCALES = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "ar", label: "العربية", flag: "🇸🇦", rtl: true },
] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]["code"];

/**
 * useLocale — petit store Zustand qui force le re-render des composants
 * quand la langue change. À utiliser au niveau du root layout en clé du Stack
 * pour propager le changement à l'ensemble de l'arbre.
 */
export const useLocale = create<{ locale: LocaleCode; setLocale: (c: LocaleCode) => Promise<void> }>((set) => ({
  locale: "fr",
  setLocale: async (code) => {
    i18n.locale = code;
    try { await AsyncStorage.setItem(STORAGE_KEY, code); } catch {}
    set({ locale: code });
  },
}));

const STORAGE_KEY = "sb_locale";

export async function initLocale(): Promise<LocaleCode> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.some((l) => l.code === stored)) {
      i18n.locale = stored;
      useLocale.setState({ locale: stored as LocaleCode });
      return stored as LocaleCode;
    }
  } catch {}
  const code: LocaleCode = "fr";
  i18n.locale = code;
  useLocale.setState({ locale: code });
  return code;
}

export async function setLocale(code: LocaleCode) {
  await useLocale.getState().setLocale(code);
}

/** Shortcut translator */
export const t = (key: string, options?: object): string => i18n.t(key, options);
