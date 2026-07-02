import { api } from "../api";

/**
 * FX Service — abstraction autour de l'API /transfers/fx-rate.
 *
 * Objectif : n'importe quel écran peut convertir un montant d'une devise à une autre
 * sans se soucier des appels API, du cache, ou des taux fixes/variables.
 *
 * Quand l'API FX est déployée, elle sera utilisée en priorité.
 * En fallback (offline / API indisponible), on utilise une table de taux par défaut.
 */

export type FxRate = {
  from: string;
  to: string;
  rate: number;
  margin_percent: number;
  fixed: boolean;
  country?: string;
};

type CacheEntry = {
  rate: FxRate;
  fetchedAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache: Record<string, CacheEntry> = {};

const cacheKey = (from: string, to: string) => `${from.toUpperCase()}_${to.toUpperCase()}`;

/** Fallbacks connus (taux indicatifs) — utilisés seulement si l'API est KO. */
export const FX_FALLBACK: Record<string, { rate: number; fixed: boolean }> = {
  "EUR_XOF": { rate: 655.957, fixed: true },
  "EUR_XAF": { rate: 655.957, fixed: true },
  "EUR_USD": { rate: 1.08, fixed: false },
  "EUR_GBP": { rate: 0.86, fixed: false },
  "EUR_MAD": { rate: 10.85, fixed: false },
  "EUR_CAD": { rate: 1.47, fixed: false },
  "EUR_CHF": { rate: 0.94, fixed: false },
  "EUR_CDF": { rate: 2950, fixed: false },
  "EUR_GNF": { rate: 9500, fixed: false },
  "EUR_MGA": { rate: 4900, fixed: false },
  "EUR_TND": { rate: 3.32, fixed: false },
  "EUR_DZD": { rate: 145, fixed: false },
};

function getFallbackRate(from: string, to: string): FxRate {
  const fromU = from.toUpperCase();
  const toU = to.toUpperCase();
  const direct = FX_FALLBACK[`${fromU}_${toU}`];
  if (direct) {
    return { from: fromU, to: toU, rate: direct.rate, margin_percent: 1.0, fixed: direct.fixed };
  }
  // Inverse
  const inverse = FX_FALLBACK[`${toU}_${fromU}`];
  if (inverse) {
    return { from: fromU, to: toU, rate: 1 / inverse.rate, margin_percent: 1.0, fixed: inverse.fixed };
  }
  // Parité 1:1 inconnue
  return { from: fromU, to: toU, rate: 1, margin_percent: 0, fixed: false };
}

/**
 * Récupère le taux FX from → to.
 * Utilise le cache si disponible, sinon appelle l'API, sinon fallback.
 */
export async function getFxRate(from: string, to: string, forceRefresh = false): Promise<FxRate> {
  const key = cacheKey(from, to);
  const now = Date.now();
  const cached = cache[key];

  if (!forceRefresh && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate;
  }

  try {
    const { data } = await api.get("/transfers/fx-rate", {
      params: { from_currency: from, to_currency: to },
    });
    const rate: FxRate = {
      from: data.from || from.toUpperCase(),
      to: data.to || to.toUpperCase(),
      rate: Number(data.rate) || 1,
      margin_percent: Number(data.margin_percent) ?? 1.0,
      fixed: Boolean(data.fixed),
      country: data.country,
    };
    cache[key] = { rate, fetchedAt: now };
    return rate;
  } catch (e) {
    // API non disponible → fallback
    return getFallbackRate(from, to);
  }
}

/**
 * Convertit un montant from → to.
 */
export async function convertFx(
  amount: number,
  from: string,
  to: string,
  forceRefresh = false,
): Promise<{ amount: number; rate: FxRate }> {
  const rate = await getFxRate(from, to, forceRefresh);
  return { amount: amount * rate.rate, rate };
}

/**
 * Convertit un montant EUR vers une devise locale (utile pour les frais fixes).
 */
export async function convertFromEur(amountEur: number, toCurrency: string): Promise<number> {
  const { amount } = await convertFx(amountEur, "EUR", toCurrency);
  return amount;
}

/**
 * Invalide le cache pour une paire ou tout le cache.
 */
export function invalidateFxCache(from?: string, to?: string) {
  if (from && to) {
    delete cache[cacheKey(from, to)];
  } else {
    Object.keys(cache).forEach((k) => delete cache[k]);
  }
}
