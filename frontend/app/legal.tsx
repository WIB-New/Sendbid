import React, { useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "../src/components/Screen";
import { TText } from "../src/components/TText";
import { colors, spacing, radii } from "../src/theme";
import { useThemedColors } from "../src/themeContext";
const DOCS: Record<string, { title: string; body: string[] }> = {
  cgu: {
    title: "Conditions Générales d'Utilisation",
    body: [
      "Article 1 — Objet",
      "Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de l'application mobile SENDBID, éditée par SENDBID SAS, service de transfert d'argent international fonctionnant sur un modèle innovant de mise en relation par offres entre expéditeurs et agents payeurs locaux. En utilisant SENDBID, l'utilisateur accepte sans réserve les présentes conditions.",
      "Article 2 — Éligibilité",
      "L'utilisation de SENDBID est réservée aux personnes physiques âgées d'au moins 18 ans et aux personnes morales légalement constituées. L'utilisateur s'engage à fournir des informations exactes, complètes et à jour lors de son inscription et de sa vérification d'identité (KYC).",
      "Article 3 — Services proposés",
      "SENDBID permet : (a) l'envoi et la réception d'argent dans plus de 250 pays, (b) la sélection automatique du meilleur taux via le système d'offres agents, (c) trois modes de remise au choix (cash auprès d'un agent, virement bancaire, portefeuille mobile/MoMo), (d) le suivi en temps réel des transferts via chat intégré, (e) la gestion des bénéficiaires et moyens de paiement.",
      "Article 4 — Création de compte et vérification d'identité",
      "La création d'un compte nécessite l'acceptation des présentes CGU, la création d'un mot de passe et d'un code PIN à 6 chiffres. Conformément à la réglementation (Directive UE 2015/849 dite 5AMLD), une vérification d'identité graduée est requise : Tier 1 (pièce d'identité, <1 000 €/mois), Tier 2 (justificatif de domicile, <10 000 €/mois), Tier 3 (vérification renforcée, illimité). Les comptes entreprise requièrent documents KBIS/statuts et bénéficiaires effectifs.",
      "Article 5 — Frais et taux de change",
      "Les frais de transfert sont calculés dynamiquement via le système d'offres : les agents payeurs proposent leurs tarifs et l'offre gagnante est automatiquement retenue. Les frais totaux (commission SENDBID + commission agent) sont affichés de manière transparente avant la validation finale de chaque transfert. Le taux de change appliqué est celui du marché interbancaire majoré d'une marge de 0,5 à 2% selon le corridor.",
      "Article 6 — Obligations de l'utilisateur",
      "L'utilisateur s'engage à : (a) ne pas utiliser le service à des fins illicites (blanchiment, financement du terrorisme, fraude), (b) protéger la confidentialité de ses identifiants et de son PIN, (c) signaler sans délai toute transaction non autorisée, (d) respecter les plafonds de transfert associés à son niveau KYC, (e) fournir des informations véridiques sur le bénéficiaire et l'origine des fonds.",
      "Article 7 — Droit de rétractation et annulation",
      "L'utilisateur dispose d'un droit de rétractation de 14 jours sur les services financiers conformément au Code de la consommation. Une transaction peut être annulée sans frais tant qu'aucun agent n'a été assigné. Après assignation, des frais de 5% sont retenus. Une fois la remise effectuée au bénéficiaire, l'annulation n'est plus possible.",
      "Article 8 — Responsabilité",
      "SENDBID met en œuvre tous les moyens raisonnables pour assurer la disponibilité (SLA 99,9%) et la sécurité du service (chiffrement TLS 1.3, HSM pour les clés cryptographiques, 2FA). SENDBID ne saurait être tenu responsable en cas de force majeure, de coupures réseau, d'erreurs imputables à l'utilisateur (saisie erronée du bénéficiaire), ou d'indisponibilité d'un corridor causée par une réglementation locale.",
      "Article 9 — Résiliation",
      "L'utilisateur peut fermer son compte à tout moment depuis Profil → RGPD → Supprimer mon compte. SENDBID se réserve le droit de suspendre ou de fermer un compte en cas de violation des CGU, de suspicion de fraude, ou de non-respect des obligations KYC/AML. Les fonds légitimes sont restitués dans un délai de 30 jours.",
      "Article 10 — Droit applicable et litiges",
      "Les présentes CGU sont régies par le droit français. Tout litige relèvera des tribunaux compétents de Paris après tentative de résolution amiable via le service client. L'utilisateur peut saisir le médiateur de l'ACPR (www.acpr.banque-france.fr) ou la plateforme européenne de règlement en ligne (ec.europa.eu/consumers/odr).",
      "Article 11 — Modification des CGU",
      "SENDBID se réserve le droit de modifier les présentes CGU. Toute modification substantielle sera notifiée 30 jours avant son entrée en vigueur par notification push et email. La poursuite de l'utilisation vaut acceptation.",
    ],
  },
  privacy: {
    title: "Politique de Confidentialité",
    body: [
      "1. Responsable de traitement",
      "SENDBID SAS, immatriculée au RCS de Paris sous le numéro 900 000 000, dont le siège social est situé 10 rue de la Paix, 75002 Paris, est responsable de traitement au sens du Règlement Général sur la Protection des Données (RGPD — UE 2016/679). Délégué à la Protection des Données (DPO) : dpo@sendbid.app.",
      "2. Données collectées",
      "Nous collectons les catégories de données suivantes : (a) Données d'identification (nom, prénom, date de naissance, nationalité, photo pièce d'identité, selfie pour la vérification biométrique), (b) Données de contact (email, téléphone, adresse postale), (c) Données financières (historique des transactions, moyens de paiement, comptes bancaires, RIB, numéro de carte tokenisé), (d) Données techniques (adresse IP, type d'appareil, système d'exploitation, identifiants publicitaires désactivés par défaut), (e) Données de géolocalisation approximative (pays uniquement, pour conformité AML), (f) Données de communication avec le support.",
      "3. Finalités et bases légales",
      "Vos données sont traitées pour : (a) la fourniture du service de transfert (exécution contractuelle, art. 6.1.b RGPD), (b) la lutte anti-blanchiment/financement du terrorisme (obligation légale, art. 6.1.c RGPD — Code monétaire et financier), (c) la prévention de la fraude (intérêt légitime, art. 6.1.f RGPD), (d) l'amélioration du service et l'analyse statistique (intérêt légitime ou consentement), (e) les communications commerciales (consentement uniquement, art. 6.1.a RGPD — désactivable à tout moment).",
      "4. Durées de conservation",
      "Données KYC : 5 ans après la fin de la relation contractuelle (obligation AML). Données transactionnelles : 5 ans (Code du commerce). Données de contact marketing : jusqu'à désinscription + 3 ans. Logs de sécurité : 12 mois. Enregistrements d'appels support : 6 mois. Après ces durées, les données sont anonymisées ou supprimées de manière irréversible.",
      "5. Destinataires et transferts internationaux",
      "Vos données sont partagées avec : (a) nos prestataires techniques (AWS EU-Ireland pour l'hébergement, Stripe/Adyen pour le paiement, Twilio pour les SMS, SendGrid pour les emails, Didit pour la vérification KYC), (b) nos partenaires agents payeurs locaux (uniquement les informations strictement nécessaires au paiement), (c) les autorités compétentes sur réquisition légale (TRACFIN, ACPR, autorités judiciaires). Aucune donnée n'est vendue à des tiers à des fins marketing.",
      "6. Vos droits",
      "Conformément au RGPD, vous disposez des droits : (a) d'accès — consulter vos données depuis Profil → RGPD → Exporter mes données, (b) de rectification — modifier vos informations personnelles, (c) d'effacement — supprimer votre compte (sous réserve des obligations légales de conservation), (d) de limitation — demander la suspension du traitement, (e) de portabilité — recevoir vos données dans un format structuré (JSON/CSV), (f) d'opposition — notamment au traitement marketing, (g) de retirer votre consentement à tout moment.",
      "7. Exercice des droits",
      "Pour exercer vos droits, contactez dpo@sendbid.app en joignant une copie de votre pièce d'identité. Nous répondons sous 30 jours maximum. En cas de désaccord, vous pouvez saisir la CNIL (www.cnil.fr) ou l'autorité de protection des données de votre pays.",
      "8. Sécurité",
      "Nous mettons en œuvre des mesures techniques et organisationnelles de pointe : chiffrement TLS 1.3 en transit, chiffrement AES-256 au repos, HSM pour les clés maîtres, authentification 2FA optionnelle, audit de sécurité annuel (PASSI), conformité PCI-DSS niveau 1 via nos partenaires de paiement, programme de bug bounty.",
      "9. Cookies et traceurs",
      "L'application mobile n'utilise PAS de cookies publicitaires ni de traceurs tiers. Seuls des identifiants techniques nécessaires à l'authentification et à la sécurité de session sont utilisés. Aucun pixel de tracking marketing n'est intégré.",
      "10. Modifications",
      "Toute modification substantielle de la présente politique vous sera notifiée 30 jours avant son entrée en vigueur par email et notification push.",
    ],
  },
  mentions: {
    title: "Mentions Légales",
    body: [
      "Éditeur",
      "SENDBID SAS, société par actions simplifiée au capital de 100 000 euros, immatriculée au Registre du Commerce et des Sociétés de Paris sous le numéro 900 000 000, APE 6619Z (autres activités auxiliaires de services financiers), TVA intracommunautaire FR12 900 000 000.",
      "Siège social",
      "10 rue de la Paix, 75002 Paris, France. Téléphone : +33 1 80 88 88 88. Email : contact@sendbid.app.",
      "Directeur de publication",
      "Le Président de SENDBID SAS, Monsieur Albert Fasanya.",
      "Hébergeur",
      "Amazon Web Services EMEA SARL, 38 avenue John F. Kennedy, L-1855 Luxembourg. Centre de données primaire : AWS EU-West-1 (Dublin, Irlande). Centre de données de repli : AWS EU-Central-1 (Francfort, Allemagne).",
      "Agrément et supervision",
      "SENDBID agit en qualité d'agent de services de paiement sous le régime de l'établissement de paiement européen, sous le contrôle de l'Autorité de Contrôle Prudentiel et de Résolution (ACPR, 4 place de Budapest, 75436 Paris). Numéro d'agrément : en cours d'obtention. Les fonds des utilisateurs sont cantonnés sur un compte de cantonnement distinct du patrimoine de SENDBID conformément à l'article L522-17 du Code monétaire et financier.",
      "Adhésion à un dispositif de médiation",
      "En cas de litige, l'utilisateur peut saisir gratuitement le médiateur de l'ACPR (www.acpr.banque-france.fr/protection-clientele/mediation) ou la plateforme européenne de règlement en ligne des litiges (ec.europa.eu/consumers/odr).",
      "Propriété intellectuelle",
      "Le nom SENDBID®, le logo, la charte graphique, le code source et l'ensemble des contenus de l'application sont la propriété exclusive de SENDBID SAS et protégés par le droit d'auteur et le droit des marques. Toute reproduction, représentation ou exploitation non autorisée est prohibée.",
      "Crédits",
      "Illustrations & icônes : Ionicons (MIT License). Polices : Inter (SIL Open Font License). Développement : équipe interne SENDBID.",
    ],
  },
  refund: {
    title: "Politique de Remboursement",
    body: [
      "1. Principe général",
      "SENDBID s'engage à rembourser tout transfert n'ayant pas été exécuté conformément aux instructions de l'utilisateur, à condition que la demande soit formulée dans les délais prévus. Le remboursement est effectué sur le moyen de paiement initial (carte, virement, portefeuille Portefeuille).",
      "2. Annulation avant assignation d'un agent",
      "Tant qu'aucun agent n'a remporté l'offre (statut PENDING_PAYMENT ou BIDDING), l'utilisateur peut annuler le transfert gratuitement. Le remboursement est INSTANTANÉ sur le portefeuille Portefeuille, ou sous 1 à 3 jours ouvrés selon le moyen de paiement initial (carte bancaire, virement SEPA).",
      "3. Annulation après assignation d'un agent",
      "Une fois un agent assigné (statut AGENT_ASSIGNED ou PROCESSING), l'annulation entraîne la retenue : (a) des frais de service SENDBID (commission plateforme 1,5%), (b) de la commission agent (variable selon l'offre remportée), soit en moyenne 5% du montant envoyé. Le solde est crédité sous 24 heures sur le moyen de paiement initial.",
      "4. Annulation impossible",
      "Une fois le transfert remis physiquement au bénéficiaire (statut COMPLETED) ou crédité sur son compte bancaire/portefeuille mobile, l'annulation n'est plus possible. Dans ce cas, un litige doit être ouvert via Profil → Litiges et réclamations.",
      "5. Remboursement sur litige",
      "En cas de litige légitime (transfert non reçu, montant incorrect, bénéficiaire erroné par faute de l'agent), SENDBID mène une enquête sous 7 jours ouvrés maximum. Si le litige est tranché en faveur de l'utilisateur, le remboursement est intégral (frais et commissions inclus) et crédité sous 7 jours ouvrés maximum sur le moyen de paiement initial.",
      "6. Cas de force majeure",
      "En cas de sanction internationale (OFAC, UE) empêchant la remise, SENDBID rembourse intégralement l'utilisateur, y compris les frais, dans un délai de 5 jours ouvrés.",
      "7. Transferts frauduleux",
      "Tout transfert effectué par un tiers sans autorisation (piratage de compte, vol de téléphone) donne lieu à remboursement intégral sous réserve d'un dépôt de plainte officielle et d'une coopération pleine avec l'enquête interne.",
      "8. Modalités de demande",
      "Toute demande de remboursement doit être adressée à support@sendbid.app ou via Profil → Nous contacter, accompagnée du numéro de transfert et des pièces justificatives le cas échéant. Un accusé de réception est envoyé sous 24h.",
      "9. Absence de droit de rétractation",
      "Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation ne s'applique pas aux services de paiement exécutés intégralement avant l'expiration du délai de rétractation.",
    ],
  },
  aml: {
    title: "Charte AML-CFT (Lutte anti-blanchiment & financement du terrorisme)",
    body: [
      "1. Engagement de SENDBID",
      "SENDBID SAS est résolument engagée dans la lutte contre le blanchiment de capitaux et le financement du terrorisme (AML-CFT). Nous appliquons strictement la 5e directive européenne anti-blanchiment (UE 2018/843 dite 5AMLD), les articles L561-1 et suivants du Code monétaire et financier, et les recommandations du Groupe d'Action Financière (GAFI).",
      "2. Dispositif de conformité",
      "Un Responsable de la Conformité (RCSI) dédié supervise l'ensemble du dispositif AML-CFT. Un comité de conformité se réunit mensuellement pour examiner les cas sensibles. Un audit externe annuel est réalisé par un cabinet indépendant agréé.",
      "3. Connaissance du client (KYC)",
      "Tout utilisateur doit justifier de son identité avant toute transaction selon trois niveaux : Tier 1 — pièce d'identité valide (CNI, passeport) pour les transferts <1 000 €/mois, Tier 2 — ajout d'un justificatif de domicile <3 mois et vérification biométrique (liveness + reconnaissance faciale via Didit) pour les transferts <10 000 €/mois, Tier 3 — vérification renforcée avec justification de l'origine des fonds (fiches de paie, contrat de travail, relevé bancaire) pour les montants supérieurs. Les comptes entreprise nécessitent KBIS <3 mois, statuts à jour, identification des bénéficiaires effectifs (UBO) détenant >25%.",
      "4. Surveillance des transactions",
      "Chaque transaction fait l'objet d'un screening automatique en temps réel incluant : (a) vérification des listes de sanctions internationales (OFAC, UE, ONU, HMT), (b) détection de schémas suspects (structuration, smurfing, transactions rapides multiples, destinations à risque), (c) analyse comportementale (montants inhabituels, fréquence, corridors à risque), (d) notation de risque dynamique (low/medium/high).",
      "5. Vigilance renforcée",
      "Une vigilance renforcée est appliquée dans les cas suivants : (a) transferts vers des pays à risque élevé (listes GAFI, FR-T), (b) personnes politiquement exposées (PPE) et leurs proches, (c) transferts en espèces >3 000 € cumulés sur 7 jours, (d) profils inactifs réactivant soudainement leur activité.",
      "6. Signalement à TRACFIN",
      "Toute opération présentant des indices sérieux de blanchiment ou de financement du terrorisme fait l'objet d'une Déclaration de Soupçon (DS) transmise à TRACFIN (Traitement du Renseignement et Action contre les Circuits Financiers Clandestins, ministère de l'Économie) dans un délai maximal de 24 heures. Ces signalements sont strictement confidentiels et ne peuvent être révélés au client (interdiction de tipping-off).",
      "7. Mesures de gel",
      "Les comptes présentant des indices forts de fraude ou faisant l'objet d'une instruction judiciaire sont immédiatement gelés. Les fonds concernés sont placés sur un compte séquestre dans l'attente de la décision des autorités.",
      "8. Formation du personnel",
      "L'ensemble du personnel de SENDBID (notamment les équipes support, conformité, risque) suit une formation AML-CFT obligatoire à l'embauche puis annuellement. Un score de réussite >85% est exigé.",
      "9. Coopération avec les autorités",
      "SENDBID coopère pleinement avec l'ACPR, TRACFIN, les autorités judiciaires et fiscales. Toute réquisition légalement fondée fait l'objet d'une réponse dans les délais impartis, avec préservation des données sur requête.",
      "10. Sanctions internes",
      "Tout manquement à la présente charte par un collaborateur fait l'objet de sanctions disciplinaires pouvant aller jusqu'au licenciement pour faute grave, sans préjudice des poursuites pénales.",
    ],
  },
  guide: {
    title: "Guide d'utilisation SENDBID",
    body: [
      "Chapitre 1 — Créer votre compte",
      "1.1 Téléchargez SENDBID depuis le Play Store (Android) ou l'App Store (iOS). 1.2 Appuyez sur « Créer un compte », renseignez votre nom complet, email et numéro de téléphone. 1.3 Définissez un mot de passe robuste (8 caractères minimum, mélange majuscules/minuscules/chiffres). 1.4 Créez votre code PIN à 6 chiffres — évitez les séquences (123456) et les répétitions (111111). 1.5 Activez la connexion biométrique (Face ID / empreinte digitale) pour plus de confort.",
      "Chapitre 2 — Vérifier votre identité (KYC)",
      "La vérification d'identité est obligatoire pour des raisons réglementaires. Rendez-vous dans Profil → Vérification KYC. 2.1 Tier 1 (Silver, <1 000 €/mois) : renseignez vos informations personnelles + photo de votre pièce d'identité. Durée : 2 minutes. 2.2 Tier 2 (Gold, <10 000 €/mois) : ajoutez un justificatif de domicile de <3 mois et réalisez un selfie-vidéo pour la liveness. Durée : 5 minutes. Résultat sous 24h. 2.3 Tier 3 (Platinum, illimité) : justificatifs professionnels complémentaires. Contactez le support. 2.4 Compte entreprise : sélectionnez « Vérification KYC Entreprise » — KBIS, statuts, UBO requis.",
      "Chapitre 3 — Recharger votre portefeuille Portefeuille",
      "3.1 Accueil → bouton vert « Recharger ». 3.2 Choisissez le montant (de 10 € à 5 000 € par opération selon votre tier KYC). 3.3 Sélectionnez le moyen de paiement : carte bancaire (Visa/Mastercard, instantané), virement SEPA (24-48h). 3.4 Validez avec votre PIN. Un reçu est généré automatiquement dans Transferts → Reçus PDF.",
      "Chapitre 4 — Envoyer de l'argent",
      "4.1 Accueil → CTA « Nouveau transfert » (ou bouton orange « Envoyer »). 4.2 Étape 1 — Pays destinataire : choisissez parmi les 250 pays disponibles. 4.3 Étape 2 — Montant : saisissez le montant en EUR, voyez immédiatement le montant converti. 4.4 Étape 3 — Bénéficiaire : ajoutez un nouveau bénéficiaire ou sélectionnez-en un existant. Selon le mode de remise choisi, renseignez : Cash (nom complet + téléphone), Bank (IBAN ou numéro de compte + nom de la banque), MoMo (numéro MoMo + opérateur). 4.5 Étape 4 — Validation : vérifiez le récapitulatif (montant, frais, mode, bénéficiaire), choisissez entre remise standard ou VIP (livraison à domicile +2€), puis confirmez avec votre PIN. 4.6 Les agents enchérissent pendant 3 minutes — le gagnant est automatiquement assigné.",
      "Chapitre 5 — Suivre votre transfert",
      "5.1 Onglet Transferts → cliquez sur le transfert concerné. 5.2 Suivez les 7 étapes en temps réel : Offre → Agent assigné → En cours → Prêt pour remise → Remise VIP (si applicable) → Terminé. 5.3 Discutez avec l'agent via le chat intégré (messages + photos). 5.4 Appelez l'agent en un clic si nécessaire. 5.5 Partagez le code de remise à 6 chiffres avec votre bénéficiaire (JAMAIS l'envoyer par message non chiffré).",
      "Chapitre 6 — Recevoir de l'argent",
      "6.1 Votre expéditeur vous partage votre profile_id SENDBID (format SBxxxxxx). 6.2 Vous recevez une notification push dès qu'un transfert est en cours pour vous. 6.3 Pour retirer en cash : rendez-vous chez l'agent désigné (localisation + itinéraire dans l'app), présentez votre pièce d'identité + le code de remise à 6 chiffres. 6.4 Pour un virement bancaire/MoMo : les fonds sont crédités automatiquement sous 30 minutes à 24 heures selon le corridor.",
      "Chapitre 7 — Retirer vos fonds",
      "7.1 Accueil → bouton bleu « Retirer ». 7.2 Choisissez la destination : virement SEPA vers votre banque (24-48h) ou envoi vers un portefeuille mobile (instantané dans la zone UEMOA/CEMAC). 7.3 Validez avec PIN. Les fonds sont débités du portefeuille Portefeuille.",
      "Chapitre 8 — Programme de fidélité",
      "Chaque transfert vous rapporte des Floo Points : 1 point = 1 € envoyé. Profil → Programme fidélité. Niveaux : Bronze (0-500 pts) → Silver (500-2000) → Gold (2000-10000) → Platinum (>10000). Avantages : réduction de frais, corridors VIP, transfert express prioritaire, support dédié.",
      "Chapitre 9 — Sécurité",
      "9.1 Ne partagez JAMAIS votre PIN, mot de passe ou code de remise. 9.2 SENDBID ne vous demandera jamais votre PIN par email, SMS ou téléphone. 9.3 Activez la biométrie et la notification de chaque connexion. 9.4 En cas de perte de téléphone, contactez immédiatement le support pour bloquer votre compte. 9.5 Vérifiez régulièrement vos sessions actives dans Paramètres → Sessions.",
      "Chapitre 10 — Support",
      "Nous contacter : Profil → Nous contacter (chat, email, téléphone). FAQ : Profil → Aide & Support → FAQ. Urgence (compte piraté, transfert disparu) : support@sendbid.app ou +33 1 80 88 88 88 (24/7).",
    ],
  },
};

const LIST = [
  { key: "guide", icon: "book-outline", color: "#3B82F6" },
  { key: "cgu", icon: "document-text-outline", color: "#6B7280" },
  { key: "privacy", icon: "lock-closed-outline", color: "#8B5CF6" },
  { key: "mentions", icon: "newspaper-outline", color: "#6B7280" },
  { key: "refund", icon: "cash-outline", color: "#10B981" },
  { key: "aml", icon: "shield-checkmark", color: "#EF4444" },
];

export default function Legal() {
  const colors = useThemedColors();
  const params = useLocalSearchParams<{ doc?: string }>();
  const [openKey, setOpenKey] = useState<string | null>(params.doc || null);

  return (
    <Screen title="Documents légaux" back hero>
      <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
        Consultez l'ensemble des documents légaux et le guide d'utilisation.
      </TText>

      {LIST.map((d) => {
        const doc = DOCS[d.key];
        const isOpen = openKey === d.key;
        return (
          <View key={d.key} style={styles.row}>
            <TouchableOpacity testID={`legal-${d.key}`} style={styles.rowHead} onPress={() => setOpenKey(isOpen ? null : d.key)}>
              <View style={[styles.icon, { backgroundColor: d.color + "1A" }]}>
                <Ionicons name={d.icon as any} size={20} color={d.color} />
              </View>
              <TText variant="body" weight="semiBold" style={{ flex: 1, marginLeft: 12 }}>{doc.title}</TText>
              <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.neutrals.textTertiary} />
            </TouchableOpacity>
            {isOpen ? (
              <ScrollView style={styles.rowBody} nestedScrollEnabled>
                {doc.body.map((line, i) => (
                  <TText
                    key={i}
                    variant={i % 2 === 0 ? "caption" : "body"}
                    weight={i % 2 === 0 ? "extraBold" : undefined}
                    color={i % 2 === 0 ? colors.neutrals.textPrimary : colors.neutrals.textSecondary}
                    style={{ marginBottom: i % 2 === 0 ? 4 : 12, lineHeight: 20 }}
                  >
                    {line}
                  </TText>
                ))}
              </ScrollView>
            ) : null}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.neutrals.surface,
    borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.neutrals.border,
    marginBottom: 8, overflow: "hidden",
  },
  rowHead: { flexDirection: "row", alignItems: "center", padding: 14 },
  icon: { width: 36, height: 36, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  rowBody: { paddingHorizontal: 14, paddingBottom: 14, maxHeight: 240 },
});
