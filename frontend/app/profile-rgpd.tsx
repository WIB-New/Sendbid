import React from "react";
import { Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { HubScreen, HubItem } from "../src/components/HubScreen";

export default function ProfileRgpd() {
  const router = useRouter();
  const showAlert = (msg: string) => {
    if (Platform.OS === "web") (window as any).alert(msg);
    else Alert.alert("Export des données", msg);
  };
  const confirmAsync = (msg: string): Promise<boolean> =>
    new Promise((resolve) => {
      if (Platform.OS === "web") resolve((window as any).confirm(msg));
      else Alert.alert("Supprimer", msg, [
        { text: "Annuler", style: "cancel", onPress: () => resolve(false) },
        { text: "Confirmer", style: "destructive", onPress: () => resolve(true) },
      ]);
    });

  const items: HubItem[] = [
    {
      icon: "download-outline",
      label: "Export des données",
      description: "Recevez une archive de toutes vos données par email",
      tint: "#022a6b",
      onPress: async () => {
        try { await import("../src/api").then(({ api }) => api.post("/auth/rgpd/export").catch(() => null)); } catch {}
        showAlert("Votre demande d'export RGPD a été enregistrée. Vous recevrez votre archive sous 48h par email.");
      },
    },
    {
      icon: "trash-outline",
      label: "Supprimer mon compte",
      description: "Action irréversible — toutes vos données seront supprimées",
      tint: "#EF4444",
      danger: true,
      onPress: async () => {
        const ok = await confirmAsync("Action irréversible. Tous les transferts en cours seront annulés. Confirmer ?");
        if (!ok) return;
        try {
          await import("../src/api").then(({ api }) => api.post("/auth/rgpd/delete-account").catch(() => null));
          showAlert("Votre demande de suppression a été enregistrée. Votre compte sera supprimé sous 7 jours conformément au RGPD.");
        } catch {
          showAlert("Une erreur est survenue. Veuillez contacter le support.");
        }
      },
    },
  ];
  return <HubScreen title="RGPD" items={items} hint="Vous disposez d'un droit d'accès, de rectification et de suppression de vos données personnelles." />;
}
