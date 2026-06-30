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
import de from "./de";
import it from "./it";
import pt from "./pt";

export const i18n = new I18n({ fr, en, es, ar, de, it, pt });
i18n.enableFallback = true;
i18n.defaultLocale = "fr";

export const SUPPORTED_LOCALES = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "ar", label: "العربية", flag: "🇸🇦", rtl: true },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]["code"];

import { I18nManager } from "react-native";

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
    // Bascule RTL pour l'arabe (et autres langues RTL si on en ajoute).
    // I18nManager.forceRTL nécessite un reload de l'app natif pour effet complet.
    const shouldBeRTL = code === "ar";
    if (I18nManager.isRTL !== shouldBeRTL) {
      try {
        I18nManager.allowRTL(shouldBeRTL);
        I18nManager.forceRTL(shouldBeRTL);
      } catch {}
    }
    set({ locale: code });
  },
}));

/** Indique si la langue active est RTL (utile pour les overrides ponctuels). */
export function isRTL(): boolean {
  return i18n.locale === "ar";
}

const STORAGE_KEY = "sb_locale";

export async function initLocale(): Promise<LocaleCode> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.some((l) => l.code === stored)) {
      i18n.locale = stored;
      // RTL setup au démarrage si la langue persistée est l'arabe
      if (stored === "ar" && !I18nManager.isRTL) {
        try { I18nManager.allowRTL(true); I18nManager.forceRTL(true); } catch {}
      } else if (stored !== "ar" && I18nManager.isRTL) {
        try { I18nManager.allowRTL(false); I18nManager.forceRTL(false); } catch {}
      }
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
