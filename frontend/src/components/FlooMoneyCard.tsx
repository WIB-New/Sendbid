import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, Modal, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, shadows } from "../theme";
import { TText } from "./TText";
import { SendBidLogo } from "./Logo";
import { PINPad } from "./PINPad";
import { api } from "../api";

type Props = {
  balance: number;
  currency: string;
  fullName: string;
  profileId: string;
  /** Compact mode: half height — used on home page */
  compact?: boolean;
};

function buildHandle(fullName: string, profileId: string) {
  const clean = (s: string) =>
    (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z]/g, "")
      .toLowerCase();
  const parts = (fullName || "").trim().split(/\s+/);
  const first = clean(parts[0] || "user");
  const last = clean(parts[1] || "");
  const digits = (profileId || "").replace(/\D/g, "").slice(-4).padStart(4, "0") || "0000";
  return last ? `@${first}.${last}${digits}` : `@${first}${digits}`;
}

// Module-level visibility flag — reset à chaque fresh app load (login masqué par défaut).
let __showBalanceGlobal = false;
const __listeners: Array<(v: boolean) => void> = [];
function setShowBalance(v: boolean) {
  __showBalanceGlobal = v;
  __listeners.forEach((l) => l(v));
}

export function FlooMoneyCard({ balance, currency, fullName, profileId, compact = false }: Props) {
  const handle = buildHandle(fullName, profileId);
  const [show, setShow] = useState(__showBalanceGlobal);
  const [pinModal, setPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  React.useEffect(() => {
    const fn = (v: boolean) => setShow(v);
    __listeners.push(fn);
    return () => { const i = __listeners.indexOf(fn); if (i >= 0) __listeners.splice(i, 1); };
  }, []);

  const onTogglePress = () => {
    if (show) { setShowBalance(false); return; }
    setPin(""); setErr(null); setPinModal(true);
  };

  const submitPin = async () => {
    if (pin.length !== 6) return;
    setBusy(true); setErr(null);
    try {
      // Utilise l'endpoint de vérification PIN existant
      await api.post("/auth/verify-pin", { pin });
      setShowBalance(true);
      setPinModal(false); setPin("");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "PIN incorrect");
    } finally { setBusy(false); }
  };

  // Solde masqué : chaîne de points / gros format
  const shown = show ? balance.toFixed(2) : "••••";

  return (
    <>
      <LinearGradient
        colors={colors.gradients.flooMoney}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.cardCompact, shadows.lg]}
      >
        {/* Ligne 1 : Logo + Portefeuille + handle (en haut à droite) */}
        <View style={styles.topRow}>
          <View style={styles.logoBlock}>
            <View style={styles.logoChip}>
              <SendBidLogo size={32} />
            </View>
            <TText weight="extraBold" color="white" style={styles.titleText}>
              Portefeuille
            </TText>
          </View>
          <TText variant="label" color="rgba(255,255,255,0.85)" numberOfLines={1}>
            {handle}
          </TText>
        </View>

        {/* Ligne 2 : Label "Solde disponible" + toggle œil */}
        <View style={styles.balanceLabelRow}>
          <TText variant="label" color="rgba(255,255,255,0.8)">
            Solde disponible
          </TText>
          <TouchableOpacity testID="balance-toggle" onPress={onTogglePress} style={styles.eyeBtn}>
            <Ionicons name={show ? "eye" : "eye-off"} size={14} color="white" />
          </TouchableOpacity>
        </View>

        {/* Ligne 3 : Solde principal + devise */}
        <View style={styles.balanceRow}>
          <TText weight="extraBold" color="white" style={styles.balanceHuge} numberOfLines={1} adjustsFontSizeToFit>
            {shown}
          </TText>
          <TText variant="body" weight="semiBold" color="rgba(255,255,255,0.85)" style={{ marginLeft: 6 }}>
            {currency}
          </TText>
        </View>
      </LinearGradient>

      {/* PIN Modal pour démasquer */}
      <Modal visible={pinModal} transparent animationType="slide" onRequestClose={() => setPinModal(false)}>
        <View style={styles.modal}>
          <View style={styles.sheet}>
            <View style={styles.modalIcon}>
              <Ionicons name="eye" size={26} color="white" />
            </View>
            <TText variant="subtitle" weight="extraBold" align="center" style={{ marginTop: 10 }}>
              Afficher le solde
            </TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginTop: 4, marginBottom: spacing.md }}>
              Saisissez votre code PIN pour démasquer votre solde.
            </TText>
            <PINPad pin={pin} onChange={setPin} />
            {err ? <TText variant="caption" color={colors.status.error} align="center" style={{ marginTop: 8 }}>{err}</TText> : null}
            <TouchableOpacity
              testID="balance-pin-submit"
              onPress={submitPin}
              disabled={pin.length !== 6 || busy}
              style={[styles.submitBtn, (pin.length !== 6 || busy) && { opacity: 0.5 }]}
            >
              <TText weight="extraBold" color="white">{busy ? "Vérification…" : "Valider"}</TText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setPinModal(false); setPin(""); }} style={{ alignItems: "center", marginTop: 10 }}>
              <TText variant="caption" color={colors.neutrals.textSecondary}>Annuler</TText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    aspectRatio: 1.55,
    borderRadius: radii.xxl,
    padding: spacing.lg,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  cardCompact: {
    width: "100%",
    borderRadius: radii.xxl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    overflow: "hidden",
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logoBlock: { flexDirection: "row", alignItems: "center", flex: 1 },
  logoChip: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  titleText: { fontSize: 18, letterSpacing: 0.3 },
  balanceLabelRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  balanceRow: { flexDirection: "row", alignItems: "baseline", marginTop: 2 },
  balanceHuge: { fontSize: 34, lineHeight: 40, includeFontPadding: false },
  eyeBtn: { marginLeft: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  modal: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: "white", borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg, paddingBottom: spacing.xl },
  modalIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  submitBtn: { backgroundColor: colors.primary.base, borderRadius: radii.full, paddingVertical: 14, alignItems: "center", marginTop: 16 },
});
