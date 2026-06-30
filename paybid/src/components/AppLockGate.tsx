/**
 * AppLockGate — Verrouille l'app au retour de l'arrière-plan ET au démarrage à froid
 *
 * Comportement :
 * - Mémorise l'instant où l'app passe en background
 * - Si la mise en avant a lieu après > LOCK_AFTER_MS, exige une PIN-gate
 * - À chaque démarrage où une session est restaurée (hydrate()), exige aussi une PIN-gate
 * - Si l'utilisateur n'a pas de PIN ou n'est pas connecté → no-op
 *
 * Monté globalement dans _layout.tsx (uniquement quand `user` est connecté).
 */
import React, { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { useAuth } from "../store";
import { PinGate } from "./PinGate";

const LOCK_AFTER_MS = 60 * 1000; // 60s

// Flag interne : indique si l'unlock initial a déjà été effectué pour CETTE session app
// (réinitialisé à chaque montée du composant, donc à chaque cold start)
let _initialUnlockDone = false;

/**
 * À appeler depuis le flux de login juste après une connexion par mot de passe / biométrie réussie.
 * Cela évite que la PIN-gate de cold start se déclenche immédiatement après un login.
 */
export function markFreshLogin() {
  _initialUnlockDone = true;
}

export default function AppLockGate() {
  const user = useAuth((s) => s.user);
  const [locked, setLocked] = useState(false);
  const lastBackgroundedAtRef = useRef<number | null>(null);
  const wasInactiveRef = useRef<boolean>(false);

  // Cold-start lock : la première fois qu'on a un utilisateur "restauré" depuis le storage,
  // on exige le PIN. Le flag _initialUnlockDone est réinitialisé entre les sessions JS.
  useEffect(() => {
    if (!user) return;
    if (_initialUnlockDone) return;
    if (!(user as any)?.has_pin) {
      // Pas de PIN → on considère l'unlock comme implicite
      _initialUnlockDone = true;
      return;
    }
    setLocked(true);
  }, [user]);

  useEffect(() => {
    // Cycle AppState (mobile uniquement)
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "background" || state === "inactive") {
        if (!wasInactiveRef.current) {
          lastBackgroundedAtRef.current = Date.now();
          wasInactiveRef.current = true;
        }
      } else if (state === "active") {
        if (wasInactiveRef.current && lastBackgroundedAtRef.current) {
          const elapsed = Date.now() - lastBackgroundedAtRef.current;
          if (user && (user as any)?.has_pin && elapsed >= LOCK_AFTER_MS) {
            setLocked(true);
          }
        }
        wasInactiveRef.current = false;
        lastBackgroundedAtRef.current = null;
      }
    });
    return () => sub.remove();
  }, [user]);

  const onSuccess = () => {
    _initialUnlockDone = true;
    setLocked(false);
  };
  const onCancel = async () => {
    setLocked(false);
    try { await useAuth.getState().logout(); } catch {}
  };

  return (
    <PinGate
      visible={locked}
      title="App verrouillée"
      subtitle="Entrez votre code PIN pour reprendre"
      onSuccess={onSuccess}
      onCancel={onCancel}
      allowBiometric
    />
  );
}
