import React, { useState, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Share, Alert, ScrollView, Modal } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { TText } from "../src/components/TText";
import { Button } from "../src/components/Button";
import { useAuth } from "../src/store";
import { colors, spacing, radii } from "../src/theme";

export default function SBTagPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [showInfo, setShowInfo] = useState(false);

  if (!user) return null;

  const sbtag = user.profile_id || "SB000000";
  const payLink = `https://sendbid.app/pay/${sbtag}`;
  const initials = (user.full_name || "U")
    .split(" ")
    .filter(Boolean)
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const onShare = async () => {
    try {
      await Share.share({
        title: "Mon SBTag SENDBID",
        message: `Envoyez-moi de l'argent via SENDBID — mon SBTag : ${sbtag}\nLien : ${payLink}`,
      });
    } catch {}
  };

  const onCopy = async () => {
    await Clipboard.setStringAsync(payLink);
    Alert.alert("Copié", "Le lien de paiement a été copié dans le presse-papiers.");
  };

  const onDownload = () => {
    Alert.alert(
      "Télécharger le QR",
      "Astuce : utilisez le bouton Partager pour enregistrer le QR via l'application de votre choix (Photos, Mail, Drive…).",
      [{ text: "Partager maintenant", onPress: onShare }, { text: "OK", style: "cancel" }]
    );
  };

  const onScan = () => router.push("/scan-qr" as any);

  return (
    <View style={styles.bg}>
      <LinearGradient colors={["#022a6b", "#052080"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={20} color="white" />
            </TouchableOpacity>
            <TText variant="title" weight="extraBold" color="white">Mon SBTag</TText>
            <TouchableOpacity onPress={() => setShowInfo(true)} style={styles.iconBtn}>
              <Ionicons name="information-circle-outline" size={22} color="white" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.card} contentContainerStyle={styles.cardInner} showsVerticalScrollIndicator={false}>
        {/* Avatar + nom */}
        <View style={styles.avatarBox}>
          <LinearGradient colors={["#04d46f", "#04ba28"]} style={styles.avatarCircle}>
            <TText variant="title" weight="extraBold" color="white">{initials}</TText>
          </LinearGradient>
          <TText variant="title" weight="extraBold" align="center" style={{ marginTop: 10 }}>
            {user.full_name}
          </TText>
          <View style={styles.sbtagPill}>
            <Ionicons name="pricetag" size={14} color="#022a6b" />
            <TText variant="caption" weight="extraBold" color="#022a6b" style={{ marginLeft: 6, letterSpacing: 1 }}>
              @{sbtag}
            </TText>
          </View>
        </View>

        {/* Texte explicatif */}
        <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginTop: 12, marginBottom: spacing.lg, paddingHorizontal: spacing.md }}>
          Votre SBTag est votre identifiant unique SENDBID. Partagez-le pour recevoir des paiements ou scanner celui d'un proche pour lui envoyer de l'argent.
        </TText>

        {/* QR code */}
        <View style={styles.qrBox}>
          <View style={styles.qrInner}>
            <QRCode
              value={payLink}
              size={200}
              color="#022a6b"
              backgroundColor="white"
            />
          </View>
          <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginTop: 12 }}>
            Lien de paiement
          </TText>
          <TouchableOpacity onPress={onCopy} style={styles.linkRow}>
            <TText variant="caption" weight="bold" color={colors.primary.base} numberOfLines={1}>
              {payLink}
            </TText>
            <Ionicons name="copy-outline" size={14} color={colors.primary.base} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>

        {/* Actions principales */}
        <View style={styles.actionsRow}>
          <ActionBtn testID="sbtag-share" icon="share-social-outline" label="Partager" color="#022a6b" onPress={onShare} />
          <ActionBtn testID="sbtag-download" icon="download-outline" label="Télécharger" color="#04d46f" onPress={onDownload} />
          <ActionBtn testID="sbtag-scan" icon="scan-outline" label="Scanner" color="#3D52D5" onPress={onScan} />
        </View>

        {/* Actions secondaires */}
        <TouchableOpacity testID="sbtag-request" style={styles.bigBtn} onPress={onShare}>
          <View style={[styles.bigIcon, { backgroundColor: "#04d46f" }]}>
            <Ionicons name="arrow-down-circle" size={22} color="white" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <TText weight="extraBold">Demander un paiement</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary}>Partagez votre SBTag pour recevoir de l'argent</TText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity testID="sbtag-send" style={styles.bigBtn} onPress={() => router.push("/wallet/p2p" as any)}>
          <View style={[styles.bigIcon, { backgroundColor: "#022a6b" }]}>
            <Ionicons name="paper-plane" size={22} color="white" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <TText weight="extraBold">Envoyer un paiement</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary}>Saisissez un SBTag, email ou téléphone</TText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />
        </TouchableOpacity>
      </ScrollView>

      {/* Info modal */}
      <Modal visible={showInfo} transparent animationType="fade" onRequestClose={() => setShowInfo(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.modalBg} onPress={() => setShowInfo(false)}>
          <View style={styles.modalCard}>
            <Ionicons name="information-circle" size={32} color="#022a6b" style={{ alignSelf: "center" }} />
            <TText variant="subtitle" weight="extraBold" align="center" style={{ marginTop: 8 }}>
              Qu'est-ce que le SBTag ?
            </TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 10, lineHeight: 18 }}>
              Le SBTag est votre identifiant unique SENDBID (ex : @{sbtag}). Il remplace votre numéro de téléphone ou votre email pour recevoir des paiements de manière simple et sécurisée.{"\n\n"}
              • Partagez-le par message ou réseaux sociaux{"\n"}
              • Présentez le QR code pour un paiement en personne{"\n"}
              • Aucune information bancaire n'est exposée
            </TText>
            <Button title="Compris" onPress={() => setShowInfo(false)} style={{ marginTop: spacing.lg, backgroundColor: "#022a6b" }} />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function ActionBtn({ testID, icon, label, color, onPress }: { testID: string; icon: any; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={styles.actionBtn} activeOpacity={0.85}>
      <View style={[styles.actionIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={20} color="white" />
      </View>
      <TText variant="label" weight="extraBold" align="center" style={{ marginTop: 6 }}>{label}</TText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#022a6b" },
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl + 8 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  card: { flex: 1, backgroundColor: colors.neutrals.background, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, marginTop: -spacing.lg },
  cardInner: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  avatarBox: { alignItems: "center", marginTop: spacing.sm },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#04ba28", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  sbtagPill: { flexDirection: "row", alignItems: "center", backgroundColor: "#04d46f33", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 8 },
  qrBox: { backgroundColor: "white", borderRadius: radii.xl, padding: spacing.lg, alignItems: "center", borderWidth: 1, borderColor: colors.neutrals.border },
  qrInner: { padding: 12, backgroundColor: "white", borderRadius: radii.lg, borderWidth: 2, borderColor: "#022a6b22" },
  linkRow: { flexDirection: "row", alignItems: "center", marginTop: 4, paddingHorizontal: 12 },
  actionsRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: spacing.lg },
  actionBtn: { flex: 1, alignItems: "center", backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, paddingVertical: spacing.md },
  actionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  bigBtn: { flexDirection: "row", alignItems: "center", backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, padding: spacing.md, marginTop: spacing.md },
  bigIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modalCard: { width: "100%", maxWidth: 380, backgroundColor: "white", borderRadius: radii.xxl, padding: spacing.lg },
});
