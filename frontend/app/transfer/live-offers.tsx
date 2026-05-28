/**
 * Live Offers — alias amélioré de l'écran d'enchères avec en-tête « Offres en temps réel de nos meilleurs agents ».
 * Délègue toute la logique métier à `auction.tsx` (déjà implémenté avec tours, offres WS-like et cards agents).
 */
import React from "react";
import AuctionScreen from "./auction";

export default function LiveOffers() {
  return <AuctionScreen />;
}
