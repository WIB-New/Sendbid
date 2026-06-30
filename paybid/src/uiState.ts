/**
 * Store léger Zustand pour piloter l'ouverture de la popup de vérification
 * depuis n'importe quel écran (icône bouclier dans le header, FirstLoginGuard, etc.).
 */
import { create } from "zustand";

type VerifPopupState = {
  open: boolean;
  splashOpen: boolean;
  show: () => void;
  hide: () => void;
  showSplash: () => void;
  hideSplash: () => void;
};

export const useVerifPopup = create<VerifPopupState>((set) => ({
  open: false,
  splashOpen: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
  showSplash: () => set({ splashOpen: true }),
  hideSplash: () => set({ splashOpen: false }),
}));
