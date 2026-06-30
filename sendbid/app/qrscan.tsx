/**
 * /qrscan.tsx — Scanner QR/SBTag Sendbid avec expo-camera (Lot 1.8).
 *
 * Aligne le bouton "Scanner" de l'écran "Mon SBTag" sur l'expérience attendue
 * (caméra en direct au lieu du formulaire de saisie de code).
 *
 * Comportement :
 *  - Demande la permission caméra contextuellement, gère granted/denied/blocked
 *  - Scanne les QR au format SENDBID pay-link (https://sendbid.app/pay/SB000xxx)
 *  - Sur scan valide → router.push("/wallet/p2p?target=SBTAG")
 *  - Bouton fallback "Saisir le code manuellement" → /verify-transfer
 *  - Web : caméra non disponible → fallback automatique sur saisie manuelle
 */
import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Platform, Linking } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { TText } from "../src/components/TText";
import { Button } from "../src/components/Button";
import { spacing, radii } from "../src/theme";
import { useTranslation } from "../src/i18n";

const PAY_LINK_RE = /https?:\/\/sendbid\.app\/pay\/([A-Z0-9]{4,12})/i;

export default function QRScanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [perm, requestPerm] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" && perm && !perm.granted && perm.canAskAgain) {
      requestPerm();
    }
  }, [perm, requestPerm]);

  const onScan = (event: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    const m = event.data?.match?.(PAY_LINK_RE);
    if (m) {
      const sbtag = m[1].toUpperCase();
      router.replace({ pathname: "/wallet/p2p", params: { target: `@${sbtag}` } } as any);
    } else {
      router.replace({ pathname: "/wallet/p2p", params: { target: event.data || "" } } as any);
    }
  };

  // Web : pas de scanner natif → on bascule l'utilisateur sur la saisie manuelle
  if (Platform.OS === "web") {
    return (
      <SafeAreaView style={styles.bg} edges={["top", "bottom"]}>
        <Header onBack={() => router.back()} />
        <View style={styles.centerBox}>
          <Ionicons name="laptop-outline" size={64} color="rgba(255,255,255,0.6)" />
          <TText variant="title" weight="extraBold" color="white" align="center" style={{ marginTop: 16 }}>
            Scanner indisponible sur le web
          </TText>
          <TText variant="caption" color="rgba(255,255,255,0.7)" align="center" style={{ marginTop: 8, maxWidth: 280 }}>
            Le scan QR utilise la caméra de votre téléphone — ouvrez Sendbid sur mobile pour l&apos;utiliser, ou saisissez le code manuellement.
          </TText>
          <Button title="Saisir un SBTag" icon="keypad" onPress={() => router.replace("/wallet/p2p" as any)} style={{ marginTop: 24, backgroundColor: "white" }} textColor="#022a6b" />
        </View>
      </SafeAreaView>
    );
  }

  if (!perm) {
    return (
      <SafeAreaView style={styles.bg}>
        <Header onBack={() => router.back()} />
        <View style={styles.centerBox}>
          <TText color="white">Initialisation de la caméra…</TText>
        </View>
      </SafeAreaView>
    );
  }

  if (!perm.granted) {
    return (
      <SafeAreaView style={styles.bg} edges={["top", "bottom"]}>
        <Header onBack={() => router.back()} />
        <View style={styles.centerBox}>
          <Ionicons name="camera-outline" size={64} color="rgba(255,255,255,0.6)" />
          <TText variant="title" weight="extraBold" color="white" align="center" style={{ marginTop: 16 }}>
            Autoriser la caméra
          </TText>
          <TText variant="caption" color="rgba(255,255,255,0.7)" align="center" style={{ marginTop: 8, maxWidth: 300 }}>
            Sendbid utilise la caméra pour scanner les QR codes SBTag de vos contacts et payer en un geste.
          </TText>
          {perm.canAskAgain ? (
            <Button title="Autoriser la caméra" icon="camera" onPress={requestPerm} style={{ marginTop: 24, backgroundColor: "white" }} textColor="#022a6b" />
          ) : (
            <Button title="Ouvrir les paramètres" icon="settings" onPress={() => Linking.openSettings()} style={{ marginTop: 24, backgroundColor: "white" }} textColor="#022a6b" />
          )}
          <TouchableOpacity onPress={() => router.replace("/verify-transfer" as any)} style={{ marginTop: 18 }}>
            <TText variant="caption" weight="bold" color="white">Saisir le code manuellement</TText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.bg}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : onScan}
      />
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <Header onBack={() => router.back()} onWhite />
        <View style={styles.frameWrap}>
          <View style={styles.frame} />
          <TText variant="caption" weight="bold" color="white" align="center" style={{ marginTop: 18, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4 }}>
            Pointez la caméra vers un QR SBTag
          </TText>
        </View>
        <View style={{ padding: 24 }}>
          <Button title="Saisir le code manuellement" icon="keypad" variant="outline" onPress={() => router.replace("/verify-transfer" as any)} style={{ borderColor: "white" }} textColor="white" />
        </View>
      </SafeAreaView>
    </View>
  );
}

function Header({ onBack, onWhite }: { onBack: () => void; onWhite?: boolean }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={[styles.iconBtn, onWhite && { backgroundColor: "rgba(0,0,0,0.45)" }]}>
        <Ionicons name="chevron-back" size={22} color="white" />
      </TouchableOpacity>
      <TText weight="extraBold" color="white">Scanner un SBTag</TText>
      <View style={styles.iconBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#022a6b" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  frameWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  frame: {
    width: 240, height: 240,
    borderRadius: radii.xl,
    borderWidth: 3, borderColor: "white",
    backgroundColor: "transparent",
  },
});
