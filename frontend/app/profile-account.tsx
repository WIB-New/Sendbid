import React from "react";
import { Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/store";
import { HubScreen, HubItem } from "../src/components/HubScreen";
import { api } from "../src/api";

export default function ProfileAccount() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const router = useRouter();
  const isCorporate = (user as any)?.account_type === "corporate" || (user as any)?.is_corporate === true;

  const confirmDelete = () => {
    const exec = async () => {
      try {
        await api.post("/auth/rgpd/delete-account").catch(() => null);
        await logout();
        router.replace("/welcome");
      } catch {}
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && (window as any).confirm("Suppression définitive : tous vos transferts seront annulés et votre compte sera supprimé sous 7 jours. Confirmer ?")) exec();
      return;
    }
    Alert.alert(
      "Supprimer mon compte",
      "Suppression définitive : tous vos transferts seront annulés et votre compte sera supprimé sous 7 jours conformément au RGPD.",
      [{ text: "Annuler", style: "cancel" }, { text: "Supprimer", style: "destructive", onPress: exec }],
    );
  };

  const items: HubItem[] = [
    { icon: "person-circle-outline", label: "Mes informations personnelles", description: "Nom, email, téléphone, adresse", route: "/personal-info", tint: "#3B82F6" },
    isCorporate
      ? { icon: "business-outline", label: "Vérification KYC Entreprise", description: "Statuts, registre, bénéficiaires effectifs", route: "/kyc/corporate", tint: "#8B5CF6" }
      : { icon: "shield-checkmark-outline", label: "Vérification KYC", description: "Identité, justificatifs, niveaux KYC", route: "/kyc", tint: "#10B981" },
    { icon: "notifications-outline", label: "Notifications reçues", description: "Historique de vos notifications", route: "/notifications", tint: "#F59E0B" },
    { icon: "trash-outline", label: "Supprimer mon compte", description: "Action irréversible — conformément au RGPD", onPress: confirmDelete, tint: "#EF4444", danger: true },
  ];

  return <HubScreen title="Mon compte" items={items} />;
}
