import React from "react";
import { t, useLocale } from "../src/i18n";
import { HubScreen, HubItem } from "../src/components/HubScreen";
import { useTranslation } from "../../src/i18n";

export default function ProfileHelp() {
  const { t } = useTranslation();
  useLocale((st) => st.locale);
  const items: HubItem[] = [
    { icon: "call-outline", label: "Nous contacter", description: "Support téléphonique, email, chat", route: "/contact", tint: "#022a6b" },
    { icon: "chatbubbles-outline", label: "FAQ (Questions fréquentes)", description: "Réponses aux questions les plus fréquentes", route: "/support", tint: "#8B5CF6" },
    { icon: "warning-outline", label: "Litiges et réclamations", description: "Ouvrir un litige, suivre une réclamation", route: "/disputes", tint: "#EF4444" },
    { icon: "folder-open-outline", label: "Ressources (documents légaux)", description: "CGU, CGV, Confidentialité, RGPD", route: "/legal", tint: "#10B981" },
  ];
  return <HubScreen title="Aide & Support" items={items} />;
}
