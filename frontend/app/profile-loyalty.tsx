import React from "react";
import { HubScreen, HubItem } from "../src/components/HubScreen";

export default function ProfileLoyalty() {
  const items: HubItem[] = [
    { icon: "gift-outline", label: "Parrainage", description: "Invitez vos proches et gagnez des récompenses", route: "/referral", tint: "#EC4899" },
    { icon: "trophy-outline", label: "Programme fidélité", description: "Niveaux Bronze, Silver, Gold, Platinum", route: "/loyalty", tint: "#F59E0B" },
    { icon: "star-outline", label: "Évaluations", description: "Vos avis sur les agents et leurs notes", route: "/ratings", tint: "#8B5CF6" },
  ];
  return <HubScreen title="Fidélité & Récompenses" items={items} />;
}
