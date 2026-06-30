import React from "react";
import { useAuth } from "../src/store";
import { HubScreen, HubItem } from "../src/components/HubScreen";
import { useTranslation } from "../src/i18n";

export default function ProfileAccount() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const isCorporate = (user as any)?.account_type === "corporate" || (user as any)?.is_corporate === true;

  const items: HubItem[] = [
    { icon: "person-circle-outline", label: "Mes informations personnelles", description: "Nom, email, téléphone, adresse", route: "/personal-info", tint: "#3B82F6" },
    isCorporate
      ? { icon: "business-outline", label: "Vérification KYC Entreprise", description: "Statuts, registre, bénéficiaires effectifs", route: "/kyc/corporate", tint: "#8B5CF6" }
      : { icon: "shield-checkmark-outline", label: "Vérification KYC", description: "Identité, justificatifs, niveaux KYC", route: "/kyc", tint: "#10B981" },
    { icon: "notifications-outline", label: "Notifications reçues", description: "Historique de vos notifications", route: "/notifications", tint: "#F59E0B" },
  ];

  return <HubScreen title="Mon compte" items={items} />;
}
