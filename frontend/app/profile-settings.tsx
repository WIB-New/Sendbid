import React from "react";
import { HubScreen, HubItem } from "../src/components/HubScreen";

export default function ProfileSettings() {
  const items: HubItem[] = [
    { icon: "shield-outline", label: "Sécurité", description: "Code PIN, mot de passe, biométrie, sessions", route: "/security", tint: "#EF4444" },
    { icon: "options-outline", label: "Préférences", description: "Langue, thème, devise secondaire", route: "/preferences", tint: "#022a6b" },
    { icon: "notifications", label: "Réglage des notifications", description: "Préférences push, email, SMS", route: "/notifications-settings", tint: "#F59E0B" },
  ];

  return <HubScreen title="Paramètres" items={items} />;
}
