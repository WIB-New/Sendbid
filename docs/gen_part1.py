"""
SendFloo — Générateur de tous les documents projet (partie 1 sur 2).
Documents 1.x à 3.x : Cadrage, Métier, Technique.
"""
import sys
sys.path.insert(0, "/app/docs")
from _helpers import *


# ============================================================================
# 1.1 — NOTE DE CADRAGE / PROJECT CHARTER
# ============================================================================

def doc_1_1_note_cadrage():
    doc = init_doc()
    add_cover(doc,
              title="Note de cadrage projet",
              subtitle="SendFloo — Plateforme de transfert d'argent par enchère inversée",
              doc_code="SF-PMO-NC-001",
              version="1.0")

    add_toc(doc, [
        ("1. Objectif du projet", 1),
        ("2. Contexte et problème à résoudre", 1),
        ("3. Périmètre", 1),
        ("4. Hors périmètre", 1),
        ("5. Parties prenantes", 1),
        ("6. Hypothèses", 1),
        ("7. Contraintes", 1),
        ("8. Budget estimatif", 1),
        ("9. Planning macro", 1),
        ("10. Critères de succès", 1),
    ])

    h1(doc, "1. Objectif du projet")
    p(doc, "Le projet SendFloo a pour objectif de construire et lancer une plateforme de "
           "transfert d'argent international fondée sur un mécanisme inédit : l'enchère "
           "inversée en temps réel. Là où les acteurs traditionnels du marché (Western Union, "
           "MoneyGram, Wise) imposent un tarif fixe ou semi-dynamique, SendFloo met les agents "
           "locaux en compétition pendant 30 secondes pour proposer le meilleur taux de frais "
           "à l'expéditeur.")
    p(doc, "L'ambition de SendFloo est triple :")
    bullet(doc, [
        "Réduire le coût moyen d'un transfert d'argent de la diaspora vers l'Afrique de 35 % à 50 % par rapport aux acteurs en place, en redistribuant la marge captée par les intermédiaires aux exépditeurs et aux agents.",
        "Offrir une expérience utilisateur native, multilingue (7 langues), accessible et inclusive : enchère live, suivi temps réel, biométrie, paiements 100 % in-app, support 24/7.",
        "Construire un réseau de confiance composé d'agents certifiés, notés, rémunérés équitablement, avec une gouvernance opérationnelle reproductible dans 250+ pays.",
    ])
    h2(doc, "Objectifs SMART")
    table(doc, ["Objectif", "Métrique", "Cible", "Échéance"], [
        ["Acquisition utilisateurs", "MAU (Monthly Active Users)", "50 000", "M+12"],
        ["Volume transféré", "GMV cumulé", "100 M€", "M+18"],
        ["Réseau agents actifs", "Agents Approuvés", "2 500", "M+12"],
        ["Économies utilisateur moyennes", "% de gain vs concurrents", "≥ 35 %", "Dès M+3"],
        ["Taux de réussite transferts", "% complétés vs initiés", "≥ 98 %", "Dès M+6"],
        ["NPS produit", "Net Promoter Score", "≥ 55", "M+12"],
        ["Couverture corridors", "Nombre de corridors actifs", "150", "M+18"],
    ])

    h1(doc, "2. Contexte et problème à résoudre")
    h2(doc, "2.1 Marché global du transfert international")
    p(doc, "Le marché mondial des transferts internationaux personnels (remittances) "
           "représente selon la Banque Mondiale 860 milliards USD en 2024, dont environ "
           "100 milliards à destination de l'Afrique subsaharienne. La croissance annuelle "
           "moyenne (CAGR) se situe entre 5 et 7 %. Pour les corridors France ↔ Afrique de "
           "l'Ouest et France ↔ Afrique Centrale, le volume estimé est de 7 à 9 milliards "
           "EUR/an, avec un coût moyen pour l'expéditeur de 5 à 8 % du montant transféré.")
    h2(doc, "2.2 Problème identifié")
    bullet(doc, [
        "Frais excessifs et opaques : 5 à 8 % du montant en moyenne, avec des taux de change cachés.",
        "Faible transparence sur la chaîne de valeur : l'utilisateur ignore qui touche quoi.",
        "Délais de livraison variables et peu prévisibles, surtout en zone rurale.",
        "Mauvaise expérience utilisateur sur mobile : applications datées, vérifications interminables.",
        "Réseau d'agents fragmenté, mal rémunéré, peu fidélisé.",
        "Accès limité à certaines régions / villes secondaires.",
    ])
    h2(doc, "2.3 Solution proposée")
    p(doc, "SendFloo introduit un mécanisme d'enchère inversée de 30 secondes : l'expéditeur "
           "indique le montant, le pays et la ville de destination. Tous les agents disponibles "
           "et accrédités dans le corridor reçoivent l'offre en temps réel (WebSocket). Pendant "
           "30 secondes, ils peuvent proposer leur taux de commission (entre une borne min et "
           "max imposée par la règle de gestion plate-forme). L'expéditeur voit en direct chaque "
           "offre arriver et choisit l'agent qu'il préfère (souvent, mais pas toujours, le moins "
           "cher : la note de l'agent, sa distance, sa langue peuvent influer).")

    h1(doc, "3. Périmètre")
    h2(doc, "3.1 Périmètre fonctionnel")
    bullet(doc, [
        "Application mobile SENDBID (iOS + Android) pour les expéditeurs : compte, KYC, wallet FlooMoney, transfert, enchère, suivi.",
        "Application mobile PAYBID (iOS + Android) pour les agents : KYC pro, float multi-devises, enchères entrantes, retraits, QR code.",
        "Site web marketing public (sendfloo.sendbid.app + sendbid.app) : 6 pages (accueil, fonctionnalités, tarifs, FAQ, à propos, téléchargement).",
        "Panneaux web Admin / Super-Admin / Partner-Admin / Agent / Super-Agent : tableaux de bord, gestion utilisateurs, suivi transactions, réconciliation, override commission.",
        "API publique JSON FastAPI : endpoints authentifiés (clients & agents), endpoints publics (corridors, FX), webhooks Stripe / PayPal.",
        "Intégrations paiements : Stripe (carte), PayPal, Mobile Money (MTN, Orange, Wave, Moov).",
        "Système de notifications : push (FCM/APN), email (SendGrid), SMS (Twilio).",
        "Mécanisme d'enchère temps réel : WebSocket, broadcast par corridor, fenêtre 30 secondes, gestion 'next round'.",
    ])
    h2(doc, "3.2 Périmètre géographique")
    p(doc, "Le lancement initial cible 6 corridors prioritaires :")
    table(doc, ["Corridor", "Volume estimé / an", "Lancement"], [
        ["France → Cameroun", "1,8 Mds €", "M0 (MVP)"],
        ["France → Sénégal", "1,2 Mds €", "M0 (MVP)"],
        ["France → Côte d'Ivoire", "1,1 Mds €", "M+3"],
        ["France → Maroc", "1,5 Mds €", "M+3"],
        ["UK → Nigéria", "2,0 Mds €", "M+6"],
        ["USA → Mexique", "12 Mds €", "M+9 (vague 2)"],
    ])

    h1(doc, "4. Hors périmètre")
    p(doc, "Les éléments suivants ne font PAS partie de la première version livrable :")
    bullet(doc, [
        "Cryptomonnaies (BTC, ETH, USDC) — exploration prévue en V2.",
        "Crédit consommation, micro-financement, assurance — produits annexes non-priorisés.",
        "B2B (paiements professionnels, paie internationale) — réservé à une roadmap dédiée.",
        "Cartes bancaires SendFloo physiques — out-of-scope MVP.",
        "Chatbot IA support client (utilisation Live agent uniquement en V1).",
        "API publique pour partenaires tiers — réservé V2 (post-stabilisation).",
        "Compatibilité Windows Phone, BlackBerry, KaiOS.",
        "Site web client (les paiements et transferts se font UNIQUEMENT via app mobile).",
    ])

    h1(doc, "5. Parties prenantes")
    table(doc, ["Rôle", "Identité / Entité", "Responsabilité principale", "Impliqué dans"], [
        ["Sponsor exécutif", "Direction Générale", "Vision, arbitrages stratégiques", "Comité de pilotage mensuel"],
        ["Product Owner", "Severin F.", "Roadmap, priorisation backlog", "Sprints, daily, démo"],
        ["CTO / Lead Architecte", "Jules M.", "Architecture, sécurité, build", "Toutes décisions techniques"],
        ["Head of Operations", "Anne K.", "KYC, support, agents", "SOP, gestion réseau agents"],
        ["Head of Compliance", "Marc D.", "AML/CFT, KYC, audit", "Politique conformité, contrôles"],
        ["Head of Marketing", "À recruter", "Acquisition, partenariats", "Lancement corridors"],
        ["DPO (Délégué Protection Données)", "Externe", "RGPD, registre traitements", "Politique données"],
        ["Investisseurs / Board", "Fonds + Business Angels", "Validation budget, jalons", "Reporting trimestriel"],
        ["Partenaires paiements", "Stripe, PayPal, MTN, Orange", "Acquisition fonds, KYC reverse", "Intégration, SLA"],
        ["Régulateur EU", "ACPR (France) / BCEAO (zone UEMOA)", "Agrément EMI/PSP", "Dossiers réglementaires"],
        ["Auditeur externe", "Cabinet à désigner", "Audit annuel comptes & sécurité", "Audit annuel"],
    ])

    h1(doc, "6. Hypothèses")
    bullet(doc, [
        "L'agrément EMI (ou contrat de partenariat avec un EMI existant) est obtenu avant la mise en production.",
        "Les partenaires Mobile Money valident l'intégration sandbox puis production dans les 90 jours.",
        "Les flux de change EUR / XAF / XOF / NGN restent dans la fourchette habituelle (volatilité < ±5 %) durant la phase de lancement.",
        "Le coût d'acquisition utilisateur (CAC) reste inférieur à 18 € par utilisateur activé.",
        "Le réseau d'agents pilote (60 agents en zone Yaoundé/Douala/Dakar) accepte les conditions tarifaires plate-forme.",
        "Les utilisateurs cibles disposent d'un smartphone sous iOS ≥ 13 ou Android ≥ 8.0.",
        "La connectivité réseau est suffisamment stable pour supporter les WebSocket d'enchère en zone urbaine et péri-urbaine.",
    ])

    h1(doc, "7. Contraintes")
    h2(doc, "7.1 Contraintes réglementaires")
    bullet(doc, [
        "Respect Directive DSP2 (UE) + Loi 2024-364 sur les services de paiement français.",
        "KYC graduel 3 niveaux selon volume : Tier 1 (basique, ≤ 500 €/jour), Tier 2 (ID validé, ≤ 5 000 €/jour), Tier 3 (justificatifs complets, ≤ 20 000 €/jour).",
        "Conservation documentaire AML/CFT : 5 ans après dernière transaction.",
        "Déclaration TRACFIN obligatoire pour toute opération suspecte.",
        "RGPD : DPO désigné, registre des traitements, droit à l'effacement implémenté.",
    ])
    h2(doc, "7.2 Contraintes techniques")
    bullet(doc, [
        "Délai d'enchère figé à 30 secondes (UX et règle métier).",
        "Backend hébergé en UE (Frankfurt ou Paris) pour la conformité RGPD.",
        "Backup MongoDB quotidien avec rétention 14 jours minimum + externalisation S3 chiffrée hebdomadaire.",
        "Authentification multi-facteur obligatoire pour tout compte admin / agent / super-agent.",
        "Tous les flux applicatifs en HTTPS / TLS 1.3 minimum.",
    ])
    h2(doc, "7.3 Contraintes budgétaires")
    p(doc, "Budget plafonné à 1,2 M€ pour les 18 premiers mois (build + lancement), tel que validé par le Comité Exécutif.")

    h1(doc, "8. Budget estimatif")
    table(doc, ["Poste", "Détail", "Coût (€)", "% total"], [
        ["Équipe produit & tech (CDI + freelance)", "12 personnes en moyenne sur 18 mois", "780 000", "65 %"],
        ["Infrastructure cloud + monitoring", "VPS, MongoDB Atlas, CDN, monitoring", "48 000", "4 %"],
        ["Licences logicielles (SaaS)", "Stripe fees, SendGrid, Twilio, Github, Linear", "32 000", "2,7 %"],
        ["Agrément EMI + frais juridiques", "Dépôt + cabinet + Compliance Officer", "120 000", "10 %"],
        ["Marketing & acquisition", "Ads, influencers, événements, contenu", "150 000", "12,5 %"],
        ["Réserve (10 % imprévus)", "Buffer projet", "70 000", "5,8 %"],
        ["TOTAL", "—", "1 200 000", "100 %"],
    ])

    h1(doc, "9. Planning macro")
    table(doc, ["Phase", "Jalons", "Date estimée"], [
        ["Phase 0 — Cadrage & spécifications", "Note de cadrage, business case validés", "M-1"],
        ["Phase 1 — Build MVP (mobile + backend)", "Comptes, KYC Tier 1, wallet, transfert simple", "M+3"],
        ["Phase 2 — Enchère temps réel + agents", "WebSocket, panel agent, intégration Mobile Money", "M+6"],
        ["Phase 3 — Beta fermée corridor France ↔ Cameroun", "60 agents pilotes, 500 clients testeurs", "M+8"],
        ["Phase 4 — Lancement public 2 corridors", "Marketing, ads, SEO, partenariats", "M+10"],
        ["Phase 5 — Scale 6 corridors + V2 features", "Expansion géo, programme fidélité", "M+15"],
        ["Phase 6 — Audit & agrément EMI propre", "Indépendance opérateur paiement", "M+18"],
    ])

    h1(doc, "10. Critères de succès")
    p(doc, "Le succès du projet sera évalué selon 5 dimensions :")
    table(doc, ["Dimension", "Indicateur", "Seuil de succès"], [
        ["Adoption", "MAU à M+12", "≥ 50 000"],
        ["Économie", "GMV cumulé à M+18", "≥ 100 M€"],
        ["Qualité produit", "NPS produit", "≥ 55"],
        ["Fiabilité", "Taux de transferts complétés", "≥ 98 %"],
        ["Conformité", "Aucune sanction réglementaire majeure", "0 incident bloquant"],
    ])
    callout(doc, "Critère bloquant",
            "Tout incident de sécurité critique (vol de fonds, breach RGPD) constituera un échec "
            "indépendamment des autres KPI. La sécurité prime sur toutes les autres dimensions.",
            color="C9A227")

    return save(doc, "01_Cadrage_NoteDeCadrage.docx")


# ============================================================================
# 1.2 — BUSINESS CASE
# ============================================================================

def doc_1_2_business_case():
    doc = init_doc()
    add_cover(doc, title="Business Case", subtitle="SendFloo — Justification économique du projet",
              doc_code="SF-PMO-BC-002", version="1.0")
    add_toc(doc, [
        ("1. Opportunité marché", 1),
        ("2. Cible client", 1),
        ("3. Volumes prévisionnels", 1),
        ("4. Revenus attendus", 1),
        ("5. Structure de coûts", 1),
        ("6. ROI prévisionnel", 1),
        ("7. Risques business", 1),
    ])

    h1(doc, "1. Opportunité marché")
    h2(doc, "1.1 Taille du marché")
    p(doc, "Selon la Banque Mondiale (Remittance Prices Worldwide, 2024) :")
    bullet(doc, [
        "Marché mondial des remittances : 860 Mds USD / an, croissance 5-7 % CAGR.",
        "Afrique subsaharienne : 100 Mds USD, dont environ 25 Mds depuis l'Europe.",
        "Coût moyen mondial d'un transfert (TMT) : 6,18 % en Q2 2024.",
        "Objectif fixé par les Nations Unies (SDG 10.c) : réduire à 3 % d'ici 2030.",
    ])
    h2(doc, "1.2 Gisement de valeur capturable")
    p(doc, "Sur le corridor France ↔ Cameroun seul (1,8 Mds €/an), si SendFloo capture 5 % du "
           "marché et applique une commission moyenne nette de 1,8 % (vs ~6 % chez les acteurs "
           "traditionnels), cela représente :")
    table(doc, ["Corridor", "Volume capté", "Commission nette plate-forme", "Revenu annuel SendFloo"], [
        ["France → Cameroun", "5 % × 1,8 Mds = 90 M€", "1,8 %", "1,62 M€"],
        ["France → Sénégal", "5 % × 1,2 Mds = 60 M€", "1,8 %", "1,08 M€"],
        ["France → Côte d'Ivoire", "5 % × 1,1 Mds = 55 M€", "1,8 %", "0,99 M€"],
        ["Total 3 corridors initiaux", "205 M€", "—", "3,69 M€"],
    ])

    h1(doc, "2. Cible client")
    h2(doc, "2.1 Persona 1 — Solange (cliente diaspora)")
    bullet(doc, [
        "Femme, 38 ans, vit à Bondy (93), aide-soignante.",
        "Originaire de Yaoundé. Envoie 250 € tous les 15 du mois à sa mère.",
        "Utilise actuellement Western Union (frais ~17 €) → SendFloo lui coûterait ~5 €.",
        "Économie annuelle : 288 € si SendFloo l'accompagne 24 mois.",
        "Frustration principale : opacité des frais et délais incertains.",
    ])
    h2(doc, "2.2 Persona 2 — Jules (agent PayBID)")
    bullet(doc, [
        "Homme, 32 ans, agent indépendant à Yaoundé (Mvog-Mbi).",
        "Possède un petit local + caisse en XAF avec un float quotidien de 500 000 XAF.",
        "Reçoit aujourd'hui 25 à 40 transferts/jour, marge moyenne de 1 200 XAF/op.",
        "Cherche à optimiser ses commissions et fidéliser ses clients via PayBID.",
        "Frustration principale : pas de visibilité sur la concurrence agent-à-agent.",
    ])
    h2(doc, "2.3 Segmentation et hiérarchie de besoins")
    table(doc, ["Segment", "Volume cible", "Besoin principal", "Tier KYC"], [
        ["Étudiants diaspora", "50 €–200 €", "Frais très bas", "Tier 1"],
        ["Familles régulières", "150 €–500 €", "Fiabilité, suivi temps réel", "Tier 2"],
        ["Entrepreneurs / commerçants", "500 €–5 000 €", "Volume, multi-devises", "Tier 3"],
        ["Ponctuels (mariages, urgences)", "1 000 €–20 000 €", "Disponibilité immédiate", "Tier 3"],
    ])

    h1(doc, "3. Volumes prévisionnels")
    h2(doc, "3.1 Modèle de croissance trimestrielle (Année 1)")
    table(doc, ["Trimestre", "Nouveaux utilisateurs", "MAU cumul", "GMV trimestriel", "Transferts/trim."], [
        ["T1", "1 500", "1 200", "240 000 €", "950"],
        ["T2", "4 500", "5 100", "1 100 000 €", "4 400"],
        ["T3", "12 000", "15 500", "3 500 000 €", "14 200"],
        ["T4", "25 000", "37 000", "9 800 000 €", "39 200"],
        ["Année 1 total", "43 000", "37 000 (fin Y1)", "14,6 M€", "58 750"],
    ])
    h2(doc, "3.2 Projection sur 36 mois (volume annuel)")
    table(doc, ["Année", "MAU fin année", "GMV annuel", "Revenu net SendFloo"], [
        ["Y1", "37 000", "14,6 M€", "263 K€"],
        ["Y2", "180 000", "120 M€", "2,16 M€"],
        ["Y3", "550 000", "440 M€", "7,92 M€"],
    ])

    h1(doc, "4. Revenus attendus")
    p(doc, "SendFloo monétise via 4 leviers complémentaires :")
    h2(doc, "4.1 Commission plate-forme (revenu principal)")
    bullet(doc, [
        "Prélevée sur chaque transfert COMPLETED.",
        "Taux moyen pondéré attendu : 0,8 % du montant + 0,80 € fixe.",
        "Exemple sur 250 € : commission 0,8 % × 250 + 0,80 = 2,80 € net.",
    ])
    h2(doc, "4.2 Abonnement PayBID Agent (revenu récurrent)")
    bullet(doc, [
        "Plan PayBID : 9,90 €/mois ou 99 €/an.",
        "Plan Super-Agent : 49 €/mois.",
        "Objectif M+12 : 2 500 agents PayBID × 9,90 € × 12 = 297 000 €/an.",
    ])
    h2(doc, "4.3 Spread sur taux de change (revenu indirect)")
    p(doc, "Sur chaque conversion EUR ↔ XAF/XOF, SendFloo applique une marge de 0,5 à 1,2 % sur "
           "le taux interbancaire. Cette marge est transparente (affichée à l'utilisateur).")
    h2(doc, "4.4 Partenariats commerciaux")
    bullet(doc, [
        "Affiliations avec opérateurs Mobile Money (rev-share 0,1 à 0,3 %).",
        "API B2B futur (post-V1) pour entreprises avec employés diaspora.",
    ])
    h2(doc, "4.5 P&L synthétique année 3")
    table(doc, ["Source de revenu", "Année 3 (€)", "% du total"], [
        ["Commission plate-forme (~0,8 % × 440 M€)", "3 520 000", "65 %"],
        ["Abonnements PayBID + Super-Agent", "750 000", "14 %"],
        ["Spread FX (~0,7 % × 440 M€)", "3 080 000", "57 %"],
        ["Partenariats (rev-share)", "440 000", "8 %"],
        ["Total revenus bruts", "7 790 000", "100 %"],
    ])

    h1(doc, "5. Structure de coûts")
    h2(doc, "5.1 Coûts variables (par transaction)")
    table(doc, ["Poste", "Coût moyen / transaction"], [
        ["Frais paiement entrant (Stripe / PayPal)", "1,4 % + 0,25 €"],
        ["Frais paiement sortant (Mobile Money / Banque)", "0,5 à 1 %"],
        ["Coût de l'agent (commission moyenne reversée)", "1,8 % à 3,2 %"],
        ["Coût TX support / KYC moyen", "0,15 €"],
        ["Total coût variable", "~3,5 % à 5,5 %"],
    ])
    h2(doc, "5.2 Coûts fixes annuels (Year 3)")
    table(doc, ["Catégorie", "Montant annuel"], [
        ["Salaires & charges (équipe 25 personnes)", "1 800 000 €"],
        ["Infrastructure cloud + monitoring", "120 000 €"],
        ["Licences SaaS (Stripe, Twilio, Segment...)", "85 000 €"],
        ["Marketing & acquisition", "900 000 €"],
        ["Compliance + audits", "200 000 €"],
        ["Locaux + fonctions support", "180 000 €"],
        ["Total coûts fixes", "3 285 000 €"],
    ])

    h1(doc, "6. ROI prévisionnel")
    table(doc, ["Année", "Revenus", "Coûts totaux", "EBITDA", "Investissement cumulé", "ROI cumulé"], [
        ["Y1", "263 K€", "1 050 K€", "-787 K€", "1 050 K€", "-75 %"],
        ["Y2", "2 160 K€", "2 100 K€", "+60 K€", "2 990 K€", "-23 %"],
        ["Y3", "7 790 K€", "5 200 K€", "+2 590 K€", "5 600 K€", "+91 %"],
    ])
    p(doc, "Point mort opérationnel attendu : Q3 Y2. Payback complet de l'investissement initial à fin Y3.", italic=True)

    h1(doc, "7. Risques business")
    table(doc, ["Risque", "Probabilité", "Impact", "Mitigation"], [
        ["Délai d'agrément EMI > 12 mois", "Moyenne", "Critique", "Partenariat initial avec EMI existant"],
        ["Concurrent local lance enchère similaire", "Faible", "Moyen", "Avance technologique + UX différenciante"],
        ["Volatilité FX > 10 %", "Moyenne", "Élevé", "Couverture FX dynamique + spread protecteur"],
        ["CAC > 25 €/utilisateur", "Moyenne", "Élevé", "Programme parrainage + organic growth"],
        ["Fraude opérationnelle (agent collusion)", "Moyenne", "Critique", "Système scoring + audit aléatoire + sanctions"],
        ["Panne Mobile Money corridor clé", "Moyenne", "Élevé", "Multi-partenaires (MTN + Orange + Wave) par corridor"],
        ["Perte d'agrément suite à incident AML", "Faible", "Critique", "Compliance Officer + équipe AML dédiée"],
    ])
    return save(doc, "01_Cadrage_BusinessCase.docx")


# ============================================================================
# 1.3 — GOUVERNANCE PROJET
# ============================================================================

def doc_1_3_gouvernance():
    doc = init_doc()
    add_cover(doc, title="Gouvernance projet", subtitle="SendFloo — Pilotage, instances et circuits de décision",
              doc_code="SF-PMO-GOV-003", version="1.0")
    add_toc(doc, [
        ("1. Sponsors et exécutifs", 1),
        ("2. Comité projet (PMO)", 1),
        ("3. Rôles et responsabilités (RACI)", 1),
        ("4. Circuits de décision", 1),
        ("5. Instances de suivi", 1),
        ("6. Fréquence des réunions", 1),
        ("7. Gestion des escalades", 1),
    ])

    h1(doc, "1. Sponsors et exécutifs")
    p(doc, "La gouvernance du projet SendFloo repose sur 3 niveaux : exécutif (sponsors), "
           "opérationnel (Comité Projet) et tactique (équipes Scrum / opérations terrain).")
    h2(doc, "1.1 Sponsors")
    table(doc, ["Rôle", "Nom", "Mission"], [
        ["Sponsor exécutif principal", "Direction Générale", "Garant de l'alignement avec la stratégie globale, valide le budget annuel et les jalons majeurs."],
        ["Sponsor co-fondateur produit", "CEO / Severin F.", "Vision produit, arbitrages roadmap, communication externe."],
        ["Sponsor co-fondateur technique", "CTO / Jules M.", "Architecture, sécurité, qualité technique."],
        ["Sponsor finances", "CFO (à recruter)", "Garant du modèle économique et du pilotage budgétaire."],
    ])

    h1(doc, "2. Comité projet (PMO)")
    p(doc, "Le Comité Projet est l'instance hebdomadaire de pilotage opérationnel. Sa composition :")
    bullet(doc, [
        "Product Owner",
        "CTO / Lead Architecte",
        "Head of Operations",
        "Head of Compliance",
        "Head of Marketing (à compter de M+6)",
        "Scrum Master / Chef de projet",
    ])
    p(doc, "Le Comité valide les sprints, gère les arbitrages d'urgence, et fait remonter "
           "les blocages critiques au Sponsor exécutif.")

    h1(doc, "3. Rôles et responsabilités (RACI)")
    p(doc, "Matrice RACI sur les principales activités du projet. R = Responsable, A = Accountable, "
           "C = Consulté, I = Informé.")
    table(doc, ["Activité", "Sponsor", "PO", "CTO", "Head Ops", "Head Compliance"], [
        ["Définition roadmap", "A", "R", "C", "C", "C"],
        ["Architecture technique", "I", "C", "AR", "I", "C"],
        ["Politique KYC / AML", "I", "C", "C", "C", "AR"],
        ["Onboarding agents", "I", "C", "I", "AR", "C"],
        ["Communication crise", "AR", "R", "C", "R", "C"],
        ["Audit annuel", "A", "I", "C", "C", "R"],
        ["Validation MEP", "A", "R", "R", "R", "R"],
    ])

    h1(doc, "4. Circuits de décision")
    h2(doc, "4.1 Décisions opérationnelles courantes")
    bullet(doc, [
        "Validation user story / backlog : PO (autonomie).",
        "Choix techniques mineurs : CTO (autonomie).",
        "Recrutement junior / freelance : Manager direct + RH.",
    ])
    h2(doc, "4.2 Décisions tactiques")
    bullet(doc, [
        "Changement de scope sprint > 30 % : Comité Projet.",
        "Choix d'un nouveau partenaire technique : Comité Projet + Sponsor finances.",
        "Réorientation roadmap trimestrielle : Comité Projet + Sponsor exécutif.",
    ])
    h2(doc, "4.3 Décisions stratégiques")
    bullet(doc, [
        "Budget annuel : Sponsor exécutif + Board.",
        "Lancement nouveau corridor pays : Sponsor exécutif + Compliance + Marketing.",
        "Acquisition externe / partenariat majeur : Sponsor exécutif + Board.",
    ])

    h1(doc, "5. Instances de suivi")
    table(doc, ["Instance", "Fréquence", "Participants", "Livrables"], [
        ["Daily stand-up dev", "Quotidien (15 min)", "Squad dev", "Avancement, blocages"],
        ["Sprint review + démo", "Bi-hebdo", "Toute l'équipe + Sponsor", "Démo, feedback"],
        ["Rétrospective sprint", "Bi-hebdo", "Squad", "Plan d'amélioration"],
        ["Comité Projet", "Hebdo (1h)", "PMO complet", "Décisions tactiques, escalades"],
        ["Steering Committee", "Mensuel (2h)", "Sponsors + PMO", "Validation jalons, budget"],
        ["Board (Investisseurs)", "Trimestriel", "Sponsors + Board", "Reporting financier + KPI"],
        ["Comité Sécurité / Compliance", "Bimensuel", "CTO + Head Compliance + DPO", "Audit, conformité"],
        ["Comité Réseau Agents", "Mensuel", "Head Ops + 5 agents pilotes", "Feedback terrain"],
    ])

    h1(doc, "6. Fréquence des réunions")
    p(doc, "Synthèse hebdo type :")
    bullet(doc, [
        "Lundi 09h00 — Comité Projet (PMO complet).",
        "Mardi → Vendredi 09h00 — Daily standup squad dev.",
        "Mardi 16h00 (semaine impaire) — Sprint review + démo.",
        "Vendredi 14h00 (semaine impaire) — Rétrospective sprint.",
        "1er jeudi du mois — Steering Committee (sponsors).",
        "Dernier vendredi du trimestre — Board investisseurs.",
    ])

    h1(doc, "7. Gestion des escalades")
    h2(doc, "7.1 Niveaux d'escalade")
    table(doc, ["Niveau", "Critère déclencheur", "Délai prise en charge", "Responsable"], [
        ["N1 — Opérationnel", "Bug non bloquant, demande standard", "≤ 4h ouvrées", "Squad lead"],
        ["N2 — Tactique", "Blocage sprint, dépendance partenaire", "≤ 1 jour ouvré", "PMO / Comité Projet"],
        ["N3 — Stratégique", "Incident critique, perte de fonds, breach", "≤ 2h", "Sponsor exécutif + CTO"],
        ["N4 — Crise majeure", "Atteinte réputation, panne > 4h, fraude", "Immédiat", "CEO + Comm de crise"],
    ])
    h2(doc, "7.2 Procédure escalade N3 / N4")
    numbered(doc, [
        "Détection — toute personne du projet peut déclencher une escalade par message « ESCALADE NIVEAU X » dans Slack #pmo-critical.",
        "Triage immédiat — l'Officier d'astreinte (rotation hebdo) confirme le niveau dans les 15 minutes.",
        "Activation cellule — N3 : CTO + PO + Head Ops convoqués ; N4 : CEO + Comm activés.",
        "Communication — toutes les 30 minutes en interne, toutes les 2h en externe le cas échéant.",
        "Post-mortem — sous 5 jours ouvrés, document publié + actions correctives planifiées.",
    ])
    return save(doc, "01_Cadrage_Gouvernance.docx")


# ============================================================================
# 2.1 — CAHIER DES CHARGES FONCTIONNEL
# ============================================================================

def doc_2_1_cdcf():
    doc = init_doc()
    add_cover(doc, title="Cahier des charges fonctionnel", subtitle="SendFloo — Spécifications fonctionnelles globales",
              doc_code="SF-PRD-CDCF-001", version="1.0")
    add_toc(doc, [
        ("1. Description du service", 1),
        ("2. Parcours utilisateur", 1),
        ("3. Cas d'usage", 1),
        ("4. Règles métier", 1),
        ("5. Frais et taux", 1),
        ("6. Plafonds", 1),
        ("7. Statuts de transaction", 1),
        ("8. Exceptions", 1),
        ("9. Contraintes opérationnelles", 1),
    ])

    h1(doc, "1. Description du service")
    p(doc, "SendFloo est une plate-forme de transfert d'argent international qui repose sur "
           "trois piliers fonctionnels :")
    bullet(doc, [
        "Wallet FlooMoney intégré (multi-devises EUR, USD, XAF, XOF, NGN, MAD).",
        "Mécanisme d'enchère inversée en temps réel sur les frais agent (30 secondes).",
        "Réseau d'agents physiques certifiés pour la remise des fonds (cash, banque, Mobile Money).",
    ])
    p(doc, "Le service s'articule autour de deux applications mobiles natives (SENDBID pour les "
           "clients, PAYBID pour les agents), d'un site web marketing public et de panneaux web "
           "de gestion (Admin, Super-Admin, Agent, Super-Agent, Partner-Admin).")

    h1(doc, "2. Parcours utilisateur")
    h2(doc, "2.1 Parcours client SENDBID — premier transfert")
    numbered(doc, [
        "Téléchargement app SENDBID (App Store / Play Store).",
        "Inscription par email + téléphone (OTP SMS + OTP email).",
        "Création PIN 6 chiffres + activation biométrie (Face ID / Touch ID).",
        "KYC Tier 1 : nom, prénom, date de naissance, adresse (auto-complétion Google).",
        "Choix d'un bénéficiaire (création nouveau ou sélection contact).",
        "Saisie montant + pays/ville de destination + mode de livraison (cash, banque, momo).",
        "Démarrage de l'enchère : 30 secondes avec affichage live des bids agent.",
        "Sélection de l'agent gagnant (recommandation : meilleur taux × note).",
        "Recharge wallet si solde insuffisant : Stripe / PayPal / Mobile Money in-app.",
        "Confirmation du transfert + saisie PIN ou biométrie.",
        "Notification push de validation + statut « AGENT_ASSIGNED ».",
        "Notification de remise effective au bénéficiaire (status « COMPLETED »).",
        "Notation de l'agent (1 à 5 étoiles) + commentaire optionnel.",
    ])
    h2(doc, "2.2 Parcours agent PAYBID — enchère gagnée")
    numbered(doc, [
        "Notification push entrante : nouvelle enchère dans corridor + ville.",
        "Ouverture app PAYBID, écran enchère live (30 sec).",
        "Saisie taux proposé (entre frais_min et frais_max plate-forme).",
        "Soumission bid : visible immédiatement par client.",
        "Si gagnant : notification + statut « AGENT_ASSIGNED ».",
        "Génération automatique d'un code de retrait (10 chiffres) + QR signé.",
        "Bénéficiaire se présente : agent scanne QR ou saisit code de retrait + ID bénéf.",
        "Validation côté backend (vérification du KYC bénéficiaire si Tier ≥ 2).",
        "Remise des fonds en cash / virement / push Mobile Money.",
        "Marquage transfert « COMPLETED » + crédit commission agent (float interne).",
        "Réconciliation comptable nocturne (flux entrant vs sortant).",
    ])

    h1(doc, "3. Cas d'usage")
    table(doc, ["UC #", "Acteur", "Description", "Pré-condition", "Post-condition"], [
        ["UC-01", "Client", "Créer un compte SENDBID", "Aucune", "Compte Tier 0 créé, OTP validé"],
        ["UC-02", "Client", "Compléter KYC Tier 1", "UC-01 OK", "Tier 1, plafond 500€/jour"],
        ["UC-03", "Client", "Compléter KYC Tier 2 (ID)", "UC-01 OK", "Tier 2, plafond 5 000€/jour"],
        ["UC-04", "Client", "Recharger wallet via Stripe", "UC-01 OK + payment method", "Solde mis à jour"],
        ["UC-05", "Client", "Initier transfert simple", "UC-02 + solde suffisant", "Transfer en statut BIDDING"],
        ["UC-06", "Agent", "Soumettre une enchère", "Agent approuvé + dans corridor", "Bid enregistré, visible client"],
        ["UC-07", "Client", "Sélectionner agent gagnant", "UC-05 en BIDDING", "Transfer en AGENT_ASSIGNED"],
        ["UC-08", "Agent", "Remettre les fonds via QR", "UC-07 + scan QR valide", "Transfer en COMPLETED"],
        ["UC-09", "Client", "Annuler avant remise", "Transfer en BIDDING ou AGENT_ASSIGNED", "Transfer en CANCELLED + refund"],
        ["UC-10", "Admin", "Suspendre un agent", "Agent existant", "Statut agent → suspended"],
        ["UC-11", "Super-Agent", "Consulter performance réseau", "Comptes agents rattachés", "Dashboard réseau affiché"],
        ["UC-12", "Système", "Réconciliation nocturne", "Cron 02h00", "Écarts identifiés et notifiés"],
    ])

    h1(doc, "4. Règles métier")
    h2(doc, "4.1 Règles d'enchère")
    bullet(doc, [
        "Durée fixe : 30 secondes (configurable côté admin entre 15 et 60 sec).",
        "Bid minimum agent : 1,2 % du montant (configurable par corridor).",
        "Bid maximum agent : doit être ≤ frais_client_max (par exemple 4,5 %).",
        "Agents éligibles : status=approved, available=true, corridor match, KYC pro Tier 2.",
        "Si aucun bid reçu après 30 sec → option « relancer un round » (3 max par transfert).",
        "Si toujours aucun bid après 3 rounds → transfert ANNULÉ, fonds restitués.",
        "Un agent ne peut pas soumettre plus de 3 bids sur le même transfert.",
    ])
    h2(doc, "4.2 Règles de sélection")
    bullet(doc, [
        "Le client peut choisir n'importe quel bid (pas obligé de prendre le moins cher).",
        "Recommandation produit : meilleur score = bid_fee_percent × 0,6 + note_agent × 0,3 + temps_remise × 0,1.",
        "Délai de sélection : 60 secondes après fin enchère, sinon auto-sélection du meilleur score.",
    ])

    h1(doc, "5. Frais et taux")
    h2(doc, "5.1 Structure de frais")
    bullet(doc, [
        "Frais plate-forme : 0,8 % du montant + 0,80 € fixe (visible avant validation).",
        "Frais agent : 1,2 % à 4,5 % (issu de l'enchère).",
        "Spread FX : 0,5 à 1,2 % sur le taux interbancaire (transparent, affiché).",
        "Aucun frais caché. Total visible = montant_envoyé + frais_plate-forme + frais_agent.",
    ])
    h2(doc, "5.2 Tarification par corridor (à fin Y1)")
    table(doc, ["Corridor", "Frais agent min", "Frais agent max", "Spread FX"], [
        ["FR → CM (XAF)", "1,5 %", "3,5 %", "0,8 %"],
        ["FR → SN (XOF)", "1,2 %", "3,2 %", "0,7 %"],
        ["FR → CI (XOF)", "1,8 %", "3,8 %", "0,7 %"],
        ["FR → MA (MAD)", "1,3 %", "3,2 %", "0,5 %"],
        ["UK → NG (NGN)", "2,0 %", "4,5 %", "1,1 %"],
    ])

    h1(doc, "6. Plafonds")
    table(doc, ["Tier KYC", "Plafond / jour", "Plafond / mois", "Plafond / an"], [
        ["Tier 0 (créé, pas vérifié)", "0 €", "0 €", "0 €"],
        ["Tier 1 (basique)", "500 €", "2 000 €", "12 000 €"],
        ["Tier 2 (ID validé)", "5 000 €", "20 000 €", "100 000 €"],
        ["Tier 3 (justificatifs complets)", "20 000 €", "100 000 €", "1 000 000 €"],
    ])

    h1(doc, "7. Statuts de transaction")
    table(doc, ["Statut", "Description", "Transitions sortantes"], [
        ["DRAFT", "Brouillon — pas encore initié.", "→ BIDDING"],
        ["BIDDING", "Enchère en cours (≤ 30 sec).", "→ AGENT_ASSIGNED | EXPIRED | CANCELLED"],
        ["EXPIRED", "Aucun bid reçu après 30 sec × 3 rounds.", "→ CANCELLED (refund auto)"],
        ["AGENT_ASSIGNED", "Agent sélectionné, en attente de remise.", "→ PROCESSING | CANCELLED | DISPUTED"],
        ["PROCESSING", "Agent en cours de remise (QR scanné).", "→ COMPLETED | FAILED | DISPUTED"],
        ["READY_FOR_PICKUP", "Mode cash : code généré, bénéf en route.", "→ PROCESSING | EXPIRED"],
        ["COMPLETED", "Fonds remis au bénéficiaire (irréversible).", "(terminal)"],
        ["CANCELLED", "Annulé par client ou système.", "(terminal)"],
        ["FAILED", "Échec technique ou opérationnel.", "(terminal)"],
        ["DISPUTED", "Litige ouvert par client ou agent.", "→ COMPLETED | CANCELLED après arbitrage"],
    ])

    h1(doc, "8. Exceptions")
    bullet(doc, [
        "Aucun agent disponible dans corridor : auto-cancel + refund après 3 rounds échoués.",
        "Bénéficiaire absent à la remise (cash) : transfer expire après 48h, refund auto à 60 %, agent compensé.",
        "Code de retrait erroné 3 fois : compte bénéficiaire bloqué temporairement (1h), notification client.",
        "Solde wallet insuffisant après enchère : transfert AGENT_ASSIGNED bloqué, client a 5 min pour recharger sinon CANCELLED.",
        "Perte de connectivité agent pendant remise : système retry auto + notification + suivi manuel par support.",
    ])

    h1(doc, "9. Contraintes opérationnelles")
    bullet(doc, [
        "Disponibilité service 24/7/365 avec SLA 99,9 % (downtime mensuel < 45 min).",
        "Latence enchère temps réel < 200 ms (WebSocket).",
        "Délai moyen de remise des fonds (cash) : < 60 minutes en zone urbaine, < 4h en péri-urbaine.",
        "Support client multilingue (FR, EN, ES, AR, PT) en moins de 5 min (chat) ou 24h (email).",
        "Réconciliation comptable quotidienne (cron 02h00 UTC).",
        "Backup MongoDB quotidien, rétention 14 jours + externalisation chiffrée S3 hebdomadaire.",
    ])
    return save(doc, "02_Metier_CahierDesChargesFonctionnel.docx")


# ============================================================================
# 2.2 — SPECIFICATIONS FONCTIONNELLES DETAILLEES (panels + écran par écran)
# ============================================================================

def doc_2_2_specs_fonctionnelles():
    doc = init_doc()
    add_cover(doc, title="Spécifications fonctionnelles détaillées",
              subtitle="SendFloo — Écrans, règles, fonctionnalités des panels web",
              doc_code="SF-PRD-SFD-002", version="1.0")
    add_toc(doc, [
        ("1. Écrans mobile SENDBID (client)", 1),
        ("2. Écrans mobile PAYBID (agent)", 1),
        ("3. Panel web Admin", 1),
        ("4. Panel web Super-Admin", 1),
        ("5. Panel web Agent", 1),
        ("6. Panel web Super-Agent", 1),
        ("7. Panel web Partner-Admin", 1),
        ("8. Messages et codes d'erreur", 1),
        ("9. Notifications & événements", 1),
    ])

    h1(doc, "1. Écrans mobile SENDBID (client)")
    h2(doc, "1.1 Onboarding")
    bullet(doc, [
        "/landing — Présentation valeur, CTA Inscription/Connexion.",
        "/(auth)/signup — Email + téléphone (pays auto-détecté, code pays + numéro séparés).",
        "/(auth)/login — Identifier (email OU téléphone OU profile_id) + mot de passe.",
        "/(auth)/otp — Saisie OTP 6 chiffres (90s + resend).",
        "/(auth)/create-pin — Création PIN 6 chiffres, double saisie.",
        "/(auth)/biometric — Activation Face ID / Touch ID (skippable).",
    ])
    h2(doc, "1.2 Onglets principaux (tab bar)")
    bullet(doc, [
        "/(tabs)/index — Accueil : balance, action rapide envoi, transferts récents.",
        "/(tabs)/wallet — Wallet : historique transactions, recharge, retrait.",
        "/(tabs)/transfer — Nouveau transfert : steppers 4 étapes.",
        "/(tabs)/transfers — Liste tous les transferts + filtres statut.",
        "/(tabs)/profile — Profil + paramètres.",
    ])
    h2(doc, "1.3 Flux transfert")
    numbered(doc, [
        "/transfer/new/step1 — Bénéficiaire (existant ou nouveau).",
        "/transfer/new/step2 — Montant + corridor + mode livraison.",
        "/transfer/new/step3 — Récap frais + démarrage enchère.",
        "/transfer/auction — Enchère live 30 sec (WebSocket).",
        "/transfer/select-agent — Sélection agent (auto si timeout).",
        "/transfer/[id] — Détail transfert + statut + chat avec agent.",
        "/transfer/[id]/rate — Notation après COMPLETED.",
    ])

    h1(doc, "2. Écrans mobile PAYBID (agent)")
    bullet(doc, [
        "/paybid/(tabs)/index — Dashboard : statut online/offline, gains du jour, ench. live.",
        "/paybid/(tabs)/auctions — Liste enchères entrantes en temps réel.",
        "/paybid/auction/[id] — Détail enchère + soumission bid.",
        "/paybid/(tabs)/transfers — Mes transferts (assignés, en cours, complétés).",
        "/paybid/transfer/[id] — Détail + QR scanner + remise fonds.",
        "/paybid/(tabs)/float — Float multi-devises (EUR, XAF, XOF...) + déclaration cash-in.",
        "/paybid/(tabs)/earnings — Gains aujourd'hui, semaine, mois, total.",
        "/paybid/(tabs)/profile — Profil agent + KYC pro + tier (Silver/Gold/Platinum).",
        "/paybid/scan — Scanner QR universel.",
    ])

    h1(doc, "3. Panel web Admin")
    p(doc, "URL : /admin sur sendbid.app et sendfloo.sendbid.app. Authentification email + mot de passe (cookie session 12h).")
    h2(doc, "3.1 Dashboard")
    bullet(doc, [
        "6 KPI cards : Utilisateurs (+ delta 30j), Agents actifs / en attente, Transferts totaux / complétés, En cours, Volume €, Float déclaré.",
        "Tableau « Derniers transferts » (10 lignes) avec colonnes : ID, expéditeur, destination, montant, statut, date.",
        "Tableau « Agents récents » (8 lignes) avec colonnes : Nom, Pays/Ville, Statut, KYC, Note, Date.",
        "Lien rapide vers chaque section.",
    ])
    h2(doc, "3.2 Section Utilisateurs (/admin/users)")
    bullet(doc, [
        "Liste paginée 200 max par page.",
        "Colonnes : Nom, Email, Téléphone, Rôle (badge), KYC Tier, Date création.",
        "Filtres : par tier, par rôle, par date.",
        "Action : voir détail, suspendre, forcer logout, changer rôle (avec confirmation).",
    ])
    h2(doc, "3.3 Section Agents (/admin/agents)")
    bullet(doc, [
        "Colonnes : Nom, Email, Pays/Ville, Statut (badge coloré), Tier loyalty, Note, Transferts comptés, Disponibilité.",
        "Filtres : status (approved, pending, suspended), tier, ville.",
        "Action : approuver, suspendre, voir KYC docs, voir historique transferts.",
    ])
    h2(doc, "3.4 Section Transferts (/admin/transfers)")
    bullet(doc, [
        "Colonnes : ID, expéditeur, bénéficiaire, destination, montant, statut, date.",
        "Filtres : statut, corridor, fourchette montant, période.",
        "Action : voir détail complet (incluant bids, commissions, codes retrait).",
        "Bouton « Forcer cancel » + « Marquer disputed » avec audit log.",
    ])
    h2(doc, "3.5 Section Enchères live (/admin/auctions)")
    bullet(doc, [
        "Vue temps réel WebSocket des transferts en statut BIDDING.",
        "Colonnes : ID, montant, destination, bids reçus, meilleur frais, début enchère.",
        "Aucune action — monitoring uniquement.",
    ])
    h2(doc, "3.6 Section Wallets (/admin/wallets)")
    bullet(doc, [
        "Liste des wallets clients avec nom + email + balance EUR + devises secondaires + dernière activité.",
        "Action : voir transactions, créditer manuellement (avec justification + audit log), bloquer wallet.",
    ])
    h2(doc, "3.7 Section Audit / Réconciliation (/admin/audit)")
    bullet(doc, [
        "Agrégation des mouvements de float agent par type (cash-in, payout, settlement, adjustment) et devise.",
        "Vue type / devise / total / occurrences.",
        "Export CSV (réservé V2).",
    ])

    h1(doc, "4. Panel web Super-Admin")
    p(doc, "Super-set du panel Admin avec en plus :")
    bullet(doc, [
        "Gestion des comptes admins (créer, suspendre, changer rôle).",
        "Configuration plate-forme : frais min/max par corridor, durée enchère, plafonds par tier.",
        "Console de logs applicatifs (read-only, filtrable).",
        "Section « Pays/Corridors » : activer / désactiver un pays, configurer partenaires Mobile Money par pays.",
        "Section « Variables système » : feature flags (activer/désactiver fonctions à chaud).",
        "Section « Backups » : voir les backups MongoDB, déclencher backup manuel, restaurer (avec double confirmation).",
    ])

    h1(doc, "5. Panel web Agent")
    p(doc, "URL : /agent. Réservé aux comptes role=agent. Vues miroir de l'app mobile PAYBID :")
    bullet(doc, [
        "Dashboard : statut, gains today/week/month, enchères pendantes, transferts en cours.",
        "Section « Enchères live » : monitoring depuis desktop (utile pour agents avec back-office).",
        "Section « Mes transferts » : historique complet, recherche, filtre statut.",
        "Section « Float » : visualisation par devise + mouvements 30 derniers jours.",
        "Section « Gains » : graphique cumul + tableau détaillé commission par transfert.",
    ])

    h1(doc, "6. Panel web Super-Agent")
    p(doc, "URL : /superagent. Réservé role=super_agent.")
    bullet(doc, [
        "Dashboard réseau : nb agents enfants, transferts totaux réseau, volume €, override commission cumulée.",
        "Section « Mon réseau » : liste agents rattachés avec performance individuelle.",
        "Section « Transferts réseau » : tous les transferts complétés par les agents enfants.",
        "Section « Override commission » : 10 % du volume agent reversé au super-agent (configurable).",
        "Action : recommander un nouveau agent (workflow d'approbation par admin).",
    ])

    h1(doc, "7. Panel web Partner-Admin")
    p(doc, "URL : /admin (avec role=partner_admin). Variante restreinte d'Admin :")
    bullet(doc, [
        "Visibilité limitée aux corridors / pays sous responsabilité du partenaire.",
        "Pas d'accès à la configuration plate-forme.",
        "Pas d'accès aux comptes admins ni à la section Audit.",
        "Accès lecture seule aux wallets de leur périmètre.",
    ])

    h1(doc, "8. Messages et codes d'erreur")
    table(doc, ["Code", "Message", "Cause", "Action utilisateur"], [
        ["AUTH-001", "Identifiants invalides", "Email/mdp incorrect", "Réessayer ou « Mot de passe oublié »"],
        ["AUTH-002", "Compte verrouillé", "5 tentatives échouées", "Attendre 15 min ou contact support"],
        ["KYC-001", "Tier insuffisant", "Tentative au-dessus du plafond", "Compléter KYC niveau supérieur"],
        ["WAL-001", "Solde insuffisant", "Recharge nécessaire", "Bouton « Recharger »"],
        ["AUC-001", "Aucun agent disponible", "Corridor sans agent online", "Relancer après 3 min ou changer corridor"],
        ["AUC-002", "Enchère expirée", "30 sec écoulées sans sélection", "Relancer un round (max 3)"],
        ["PAY-001", "Paiement échoué", "Stripe/PayPal a refusé", "Vérifier carte ou changer de méthode"],
        ["AGT-001", "Agent suspendu", "Statut agent = suspended", "Contacter admin"],
        ["NET-001", "Connexion perdue", "WebSocket déconnecté", "Reconnexion auto + bandeau warning"],
    ])

    h1(doc, "9. Notifications & événements")
    table(doc, ["Événement", "Canal(s)", "Cible", "Template ID"], [
        ["Inscription validée", "Email", "Client", "tpl_signup_ok"],
        ["KYC validé", "Push + Email", "Client", "tpl_kyc_approved"],
        ["KYC refusé", "Email", "Client", "tpl_kyc_rejected"],
        ["Recharge wallet OK", "Push", "Client", "tpl_wallet_topup"],
        ["Nouvelle enchère dispo", "Push", "Agents corridor", "tpl_auction_new"],
        ["Bid accepté", "Push", "Agent gagnant", "tpl_bid_won"],
        ["Transfert COMPLETED", "Push + SMS bénéf", "Client + bénéf", "tpl_transfer_done"],
        ["Litige ouvert", "Email", "Admin + agent", "tpl_dispute_open"],
        ["Connexion suspecte", "Email", "Client", "tpl_suspicious_login"],
    ])

    return save(doc, "02_Metier_SpecsFonctionnellesDetaillees.docx")


# ============================================================================
# 2.3 — USER STORIES / BACKLOG
# ============================================================================

def doc_2_3_user_stories():
    doc = init_doc()
    add_cover(doc, title="User stories & backlog produit",
              subtitle="SendFloo — Stories sprint par sprint avec critères d'acceptation",
              doc_code="SF-PRD-US-003", version="1.0")
    add_toc(doc, [
        ("1. Définition du DONE", 1),
        ("2. Backlog par épopée", 1),
        ("3. User stories détaillées (échantillon)", 1),
        ("4. Priorisation et dépendances", 1),
    ])

    h1(doc, "1. Définition du DONE")
    bullet(doc, [
        "Code mergé sur main + revue par au moins 1 dev senior.",
        "Tests unitaires écrits, couverture > 70 % sur les modules touchés.",
        "Tests E2E (Playwright pour panels, Detox pour mobile) passants.",
        "Critères d'acceptation validés par PO en démo sprint.",
        "Documentation mise à jour (README, OpenAPI, notion).",
        "Aucun bug bloquant ouvert sur la story.",
        "Déployé en staging et fumé manuellement.",
        "Aucune régression détectée sur smoke tests automatisés.",
    ])

    h1(doc, "2. Backlog par épopée")
    table(doc, ["Épopée", "Stories", "Priorité", "Sprint cible"], [
        ["E1 — Auth & onboarding", "12", "P0", "S1 → S3"],
        ["E2 — Wallet FlooMoney", "9", "P0", "S2 → S4"],
        ["E3 — KYC graduel", "11", "P0", "S3 → S6"],
        ["E4 — Transfert simple (sans enchère)", "8", "P0", "S4 → S5"],
        ["E5 — Enchère temps réel", "14", "P0", "S5 → S8"],
        ["E6 — App agent PAYBID", "16", "P0", "S6 → S10"],
        ["E7 — Panels web Admin/Agent/Super", "10", "P1", "S8 → S11"],
        ["E8 — Notifications push/email/sms", "7", "P1", "S6 → S9"],
        ["E9 — i18n + dark mode", "6", "P1", "S9 → S11"],
        ["E10 — Biométrie + sécurité avancée", "5", "P1", "S10 → S12"],
        ["E11 — Programme fidélité agents", "4", "P2", "S12 → S14"],
        ["E12 — Réconciliation comptable", "6", "P2", "S11 → S13"],
    ])

    h1(doc, "3. User stories détaillées (échantillon)")
    h2(doc, "US-105 — Démarrer une enchère depuis l'app client")
    p(doc, "En tant que client KYC Tier ≥ 1 avec solde suffisant, je veux pouvoir démarrer "
           "une enchère de 30 secondes en sélectionnant un montant, un bénéficiaire et un "
           "mode de livraison, afin d'obtenir le meilleur frais agent disponible.")
    p(doc, "Critères d'acceptation :", bold=True)
    bullet(doc, [
        "Le bouton « Démarrer l'enchère » est désactivé si solde < montant + frais plate-forme.",
        "Le bouton est désactivé si aucun bénéficiaire n'est sélectionné.",
        "Au clic, le statut du transfert passe à BIDDING + chrono 30s démarre.",
        "Un événement WebSocket est broadcasté à tous les agents du corridor.",
        "Si aucun bid n'est reçu après 30s, un bandeau propose « Relancer un round » (max 3).",
        "L'animation du chrono est visible et précise (mise à jour chaque seconde).",
    ])
    p(doc, "Dépendances :", bold=True)
    bullet(doc, [
        "US-090 (création du wallet)",
        "US-095 (gestion solde)",
        "US-100 (bénéficiaire valide)",
        "US-130 (broadcast WebSocket agent)",
    ])

    h2(doc, "US-180 — Soumettre un bid en tant qu'agent")
    p(doc, "En tant qu'agent PAYBID approuvé et en ligne, je veux pouvoir soumettre un bid "
           "(taux de commission) sur une enchère active dans mon corridor, afin de remporter "
           "le transfert et générer une commission.")
    p(doc, "Critères d'acceptation :", bold=True)
    bullet(doc, [
        "Le formulaire bid est accessible uniquement aux agents status=approved.",
        "Le taux saisi doit être entre frais_min_corridor et frais_max_corridor.",
        "L'agent ne peut pas soumettre plus de 3 bids sur une même enchère.",
        "Le bid soumis est immédiatement visible côté client (latence WebSocket < 200ms).",
        "Un toast de confirmation s'affiche côté agent après chaque soumission.",
        "Si l'enchère est déjà finie quand le bid arrive, message d'erreur clair.",
    ])

    h1(doc, "4. Priorisation et dépendances")
    p(doc, "La priorisation suit la méthode RICE (Reach × Impact × Confidence / Effort).")
    table(doc, ["Story type", "P0 (must)", "P1 (should)", "P2 (could)", "P3 (won't)"], [
        ["Engagement utilisateur", "Inscription, KYC Tier 1, transfert simple", "Notifications push", "Programme fidélité", "B2B API"],
        ["Mécanisme produit", "Enchère 30s, sélection agent, remise QR", "Multi-rounds, recommandation IA", "Mode hors-ligne", "Crypto"],
        ["Sécurité", "JWT, bcrypt, PIN, OTP, audit log", "Biométrie native, 2FA email", "Geo-blocking, fraud score IA", "Hardware token"],
        ["Conformité", "KYC 3 tiers, plafonds, sanctions screening", "Déclaration TRACFIN auto", "Reporting BCE", "Crypto AML"],
    ])
    return save(doc, "02_Metier_UserStoriesBacklog.docx")


# ============================================================================
# 2.4 — CATALOGUE DES REGLES METIER
# ============================================================================

def doc_2_4_regles_metier():
    doc = init_doc()
    add_cover(doc, title="Catalogue des règles métier",
              subtitle="SendFloo — Toutes les règles de calcul, plafonds et exceptions",
              doc_code="SF-PRD-RM-004", version="1.0")
    add_toc(doc, [
        ("1. Règles de calcul des frais", 1),
        ("2. Règles de change FX", 1),
        ("3. Plafonds de montant", 1),
        ("4. Règles d'annulation", 1),
        ("5. Conditions de remboursement", 1),
        ("6. Règles d'affectation des payeurs", 1),
        ("7. Règles de disponibilité", 1),
        ("8. Gestion des expirations", 1),
        ("9. Règles de commissionnement", 1),
    ])

    h1(doc, "1. Règles de calcul des frais")
    h2(doc, "1.1 Frais plate-forme")
    p(doc, "Frais_plate-forme = max(0,80 €, 0,8 % × montant_envoyé)")
    p(doc, "Exemples :")
    table(doc, ["Montant envoyé", "Frais plate-forme calculé", "Total avant frais agent"], [
        ["50 €", "0,80 € (plancher)", "50,80 €"],
        ["100 €", "0,80 € (plancher)", "100,80 €"],
        ["250 €", "2,00 €", "252,00 €"],
        ["500 €", "4,00 €", "504,00 €"],
        ["1 000 €", "8,00 €", "1 008,00 €"],
        ["5 000 €", "40,00 €", "5 040,00 €"],
    ])
    h2(doc, "1.2 Frais agent (issu de l'enchère)")
    p(doc, "Frais_agent = bid_taux × montant_envoyé / 100")
    p(doc, "Le taux gagnant est compris entre frais_min_corridor et frais_max_corridor.")

    h1(doc, "2. Règles de change FX")
    bullet(doc, [
        "Source du taux interbancaire : fixé via flux ECB / European Central Bank, rafraîchi toutes les 15 minutes.",
        "Spread appliqué : 0,5 % à 1,2 % selon corridor, transparent côté UI.",
        "Conversion : montant_destination = montant_envoyé × taux_interbancaire × (1 + spread).",
        "Verrouillage du taux : pendant l'enchère 30 sec + le délai de complétion (jusqu'à 4h).",
        "Si dépassement du délai de verrouillage, le client est notifié et doit revalider le nouveau taux.",
    ])

    h1(doc, "3. Plafonds de montant")
    h2(doc, "3.1 Par tier KYC")
    table(doc, ["Tier", "Jour", "Mois", "An"], [
        ["Tier 0", "0 €", "0 €", "0 €"],
        ["Tier 1", "500 €", "2 000 €", "12 000 €"],
        ["Tier 2", "5 000 €", "20 000 €", "100 000 €"],
        ["Tier 3", "20 000 €", "100 000 €", "1 000 000 €"],
    ])
    h2(doc, "3.2 Par transaction unitaire")
    bullet(doc, [
        "Minimum : 5 € (sous ce seuil, pas rentable + risque blanchiment fractionné).",
        "Maximum unitaire Tier 2 : 5 000 €.",
        "Maximum unitaire Tier 3 : 20 000 €.",
        "Au-delà : workflow validation manuel par compliance officer.",
    ])

    h1(doc, "4. Règles d'annulation")
    bullet(doc, [
        "Client peut annuler tant que le statut est BIDDING, AGENT_ASSIGNED ou READY_FOR_PICKUP.",
        "Une fois en PROCESSING (agent a scanné le QR), annulation impossible côté client → ouvre DISPUTED.",
        "Annulation pendant BIDDING : aucun frais, refund instantané.",
        "Annulation pendant AGENT_ASSIGNED : frais_plate-forme × 30 % retenu (frais d'opportunité agent).",
        "Annulation pendant READY_FOR_PICKUP : refund de 80 % du montant, 20 % retenu comme compensation agent + frais.",
        "Annulation par agent (refus de remise) : agent pénalisé (note -0,3) + transfert relancé en enchère automatiquement.",
    ])

    h1(doc, "5. Conditions de remboursement")
    table(doc, ["Cas", "Délai refund", "Montant remboursé"], [
        ["Annulation pendant BIDDING", "Instantané (wallet)", "100 %"],
        ["Annulation pendant AGENT_ASSIGNED", "≤ 1h", "100 % - 30 % frais plate-forme"],
        ["Expiration (aucun bid)", "Instantané", "100 %"],
        ["Bénéficiaire absent 48h (cash)", "≤ 24h", "60 % (40 % retenu : 20 % agent + 20 % plate-forme)"],
        ["Litige résolu en faveur client", "≤ 7 jours après décision", "Variable selon arbitrage"],
        ["Erreur technique plate-forme", "≤ 24h", "100 % + geste commercial 5 €"],
    ])

    h1(doc, "6. Règles d'affectation des payeurs")
    p(doc, "Algorithme de matching agent ↔ enchère :")
    numbered(doc, [
        "Filtrer agents avec status=approved ET available=true ET kyc_pro_tier ≥ 2.",
        "Filtrer par corridor (country_from + country_to) qui match l'agent.",
        "Filtrer par ville (city_match) si l'agent a une ville spécifique enregistrée.",
        "Trier par disponibilité (online en priorité), puis par tier (Platinum > Gold > Silver), puis par rating.",
        "Limiter à 50 agents max pour ne pas saturer le broadcast WebSocket.",
        "Envoyer l'événement WebSocket à ces 50 agents.",
        "Recommandation produit côté client : score = bid_fee × 0,6 + (5 - rating) × 0,3 + estimated_delivery_minutes / 60 × 0,1.",
    ])

    h1(doc, "7. Règles de disponibilité")
    bullet(doc, [
        "Un agent est available=true s'il l'a explicitement activé dans son app PAYBID.",
        "L'agent passe automatiquement available=false après 30 min d'inactivité (WebSocket idle).",
        "L'agent passe automatiquement available=false si son float devient insuffisant (alerte seuil).",
        "L'admin peut force-disable un agent (cas de fraude, KYC à renouveler).",
        "Un super-agent peut désactiver temporairement un agent enfant pour audit interne.",
    ])

    h1(doc, "8. Gestion des expirations")
    table(doc, ["Statut", "Délai d'expiration", "Action automatique"], [
        ["BIDDING (round 1)", "30 sec", "Si 0 bid → proposer round 2"],
        ["BIDDING (round 3 sans bid)", "30 sec", "Auto-CANCELLED + refund 100 %"],
        ["Sélection agent (post-enchère)", "60 sec", "Auto-sélection meilleur score"],
        ["AGENT_ASSIGNED (mode cash)", "48h sans pickup", "Auto-EXPIRED, refund 60 %"],
        ["AGENT_ASSIGNED (mode banque)", "72h sans remise", "Auto-EXPIRED, refund 100 % (rare)"],
        ["Token QR retrait", "48h après génération", "QR invalidé, nouveau code à générer"],
        ["Session admin/agent (cookie web)", "12h", "Re-login requis"],
        ["JWT mobile app", "30 jours", "Re-login requis (refresh token disponible)"],
    ])

    h1(doc, "9. Règles de commissionnement")
    h2(doc, "9.1 Pour les agents")
    bullet(doc, [
        "Commission agent = bid_taux × montant_envoyé / 100 (le taux qu'il a proposé).",
        "Crédité sur le float interne dès le statut COMPLETED.",
        "Payable immédiatement (settlement journalier ou hebdo selon préférence agent).",
        "Aucune retenue plate-forme sur la commission agent (transparence totale).",
    ])
    h2(doc, "9.2 Pour les super-agents (override)")
    bullet(doc, [
        "Override = 10 % du volume agent enfant (configurable, max 15 %).",
        "Calculé sur les transferts COMPLETED des agents rattachés.",
        "Crédité mensuellement (5 du mois M+1 pour les transferts du mois M).",
        "Sous condition : ≥ 3 agents actifs dans le réseau + volume mensuel ≥ 50 000 €.",
    ])
    h2(doc, "9.3 Niveaux loyalty agent")
    table(doc, ["Tier", "Critères", "Avantages"], [
        ["Silver", "Par défaut", "Standard"],
        ["Gold", "50+ transferts complétés ET note ≥ 4,5", "Priorité broadcast WebSocket"],
        ["Platinum", "200+ transferts ET note ≥ 4,7 ET région stratégique", "+15 % visibilité, badge UI, support pro"],
    ])
    return save(doc, "02_Metier_CatalogueReglesMetier.docx")


# ============================================================================
# 3.1 — ARCHITECTURE TECHNIQUE
# ============================================================================

def doc_3_1_architecture():
    doc = init_doc()
    add_cover(doc, title="Architecture technique",
              subtitle="SendFloo — Vue d'ensemble du système, composants, sécurité, supervision",
              doc_code="SF-TEC-ARCH-001", version="1.0")
    add_toc(doc, [
        ("1. Vue d'ensemble du système", 1),
        ("2. Composants applicatifs", 1),
        ("3. Flux inter-systèmes", 1),
        ("4. APIs", 1),
        ("5. Bases de données", 1),
        ("6. Intégrations externes", 1),
        ("7. Sécurité", 1),
        ("8. Haute disponibilité", 1),
        ("9. Supervision et observabilité", 1),
        ("10. Journalisation", 1),
    ])

    h1(doc, "1. Vue d'ensemble du système")
    p(doc, "SendFloo est une plate-forme distribuée structurée en couches :")
    bullet(doc, [
        "Couche cliente : 2 applications mobiles natives (Expo / React Native), 1 site web SSR (Jinja2 + FastAPI).",
        "Couche API : un service unique FastAPI exposant REST + WebSocket, derrière Nginx reverse-proxy.",
        "Couche données : MongoDB 8 (transactions, users, agents, audit), Redis (cache + pub/sub auctions, V2).",
        "Couche intégrations : Stripe, PayPal, Mobile Money (MTN, Orange, Wave), Twilio, SendGrid.",
        "Couche infrastructure : VPS LWS Debian 13, Nginx, Let's Encrypt, pm2, ufw, fail2ban.",
    ])
    h2(doc, "1.1 Diagramme logique")
    p(doc, "Internet → Nginx (HTTPS 443) → pm2 / uvicorn (port 8001) → FastAPI → MongoDB (port 27017, localhost).", italic=True)
    p(doc, "WebSocket : Nginx upgrade Connection → FastAPI WS endpoint /api/ws/auctions.", italic=True)

    h1(doc, "2. Composants applicatifs")
    table(doc, ["Composant", "Stack", "Responsabilité"], [
        ["SENDBID app", "Expo SDK 51, React Native, Expo Router", "UI client : auth, wallet, transfer, enchère"],
        ["PAYBID app", "Mêmes briques", "UI agent : float, enchères, remise"],
        ["Web marketing & panels", "FastAPI + Jinja2 (server-side render)", "Marketing public + dashboards admin/agent"],
        ["API REST", "FastAPI 0.115, Pydantic v2", "Endpoints authentifiés + publics"],
        ["WebSocket service", "FastAPI WebSocket + asyncio", "Broadcast enchères temps réel"],
        ["Background tasks", "asyncio tasks + APScheduler", "Cron jobs (reconcile, expire, FX refresh)"],
        ["Email service", "SendGrid API", "Transactionnel + templates"],
        ["SMS service", "Twilio API", "OTP, alertes critiques"],
        ["Push notif", "Expo Push Service + FCM/APN", "Notifications mobile"],
    ])

    h1(doc, "3. Flux inter-systèmes")
    h2(doc, "3.1 Flux transfert simple (séquence)")
    numbered(doc, [
        "App SENDBID → POST /api/transfers/initiate : crée transfert en BIDDING.",
        "FastAPI → WebSocket broadcast vers agents corridor.",
        "App PAYBID → POST /api/transfers/{id}/bid : enregistre bid.",
        "FastAPI → WebSocket push vers le client SENDBID (mise à jour live).",
        "Après 30s ou sélection client : POST /api/transfers/{id}/select.",
        "FastAPI → débite wallet client, génère code retrait, notifie agent.",
        "Agent PAYBID → POST /api/transfers/{id}/verify-pickup : valide remise.",
        "FastAPI → crédit commission agent, statut COMPLETED, notifie tous.",
    ])

    h1(doc, "4. APIs")
    p(doc, "Toutes les API utilisent JSON. Documentation OpenAPI auto-générée à /api/docs (Swagger) et /api/redoc.")
    h2(doc, "4.1 Principaux endpoints")
    table(doc, ["Méthode", "Route", "Description"], [
        ["POST", "/api/auth/signup", "Inscription"],
        ["POST", "/api/auth/login", "Connexion (email/téléphone/profile_id)"],
        ["POST", "/api/auth/verify-otp", "Validation OTP"],
        ["GET", "/api/auth/me", "Profil utilisateur courant"],
        ["GET", "/api/corridors", "Liste pays + corridors"],
        ["POST", "/api/wallet/recharge", "Démarrer recharge (Stripe/PayPal)"],
        ["POST", "/api/transfers/initiate", "Démarrer transfert (enchère)"],
        ["POST", "/api/transfers/{id}/bid", "Soumettre bid (agent)"],
        ["POST", "/api/transfers/{id}/select", "Sélectionner gagnant"],
        ["POST", "/api/transfers/{id}/verify-pickup", "Valider remise (agent)"],
        ["GET", "/api/transfers", "Liste de mes transferts"],
        ["WS", "/api/ws/auctions", "WebSocket enchères temps réel"],
        ["POST", "/api/admin/agents/{id}/approve", "Approuver agent (admin)"],
    ])

    h1(doc, "5. Bases de données")
    h2(doc, "5.1 MongoDB collections principales")
    table(doc, ["Collection", "Volume estimé Y1", "Indexes critiques"], [
        ["users", "50 000", "email (uniq), phone, profile_id"],
        ["wallets", "50 000", "user_id (uniq)"],
        ["wallet_transactions", "1 M", "user_id+date desc"],
        ["agents", "2 500", "user_id (uniq), city, status"],
        ["agent_floats", "10 000", "agent_id+currency (uniq)"],
        ["agent_float_movements", "500 000", "agent_id+date desc"],
        ["transfers", "200 000", "user_id+date desc, agent_id, status"],
        ["bids", "5 M (5-30 par transfert)", "transfer_id, agent_id, created_at"],
        ["beneficiaries", "120 000", "user_id"],
        ["notifications", "2 M", "user_id+date desc"],
        ["audit_logs", "1 M", "actor_id, created_at"],
    ])
    h2(doc, "5.2 Politique d'indexation")
    bullet(doc, [
        "Tous les champs requêtés en filtre sont indexés (indexes composés quand pertinent).",
        "TTL index sur notifications anciennes (> 90 jours) + audit logs (> 365 jours).",
        "Sharding non requis en Y1 (volume gérable single replica).",
    ])

    h1(doc, "6. Intégrations externes")
    table(doc, ["Service", "Protocol", "Auth", "SLA"], [
        ["Stripe", "REST", "Bearer API key", "99,99 %"],
        ["PayPal", "REST", "OAuth2", "99,9 %"],
        ["SendGrid", "REST", "Bearer API key", "99,95 %"],
        ["Twilio", "REST", "Account SID + Auth Token", "99,95 %"],
        ["Expo Push", "REST", "Access Token", "99,9 %"],
        ["MTN Mobile Money", "REST + Callback", "OAuth2 + IP whitelist", "99 %"],
        ["Orange Money", "REST + Callback", "OAuth2", "99 %"],
        ["ECB FX rates", "XML feed", "Public", "Best effort"],
    ])

    h1(doc, "7. Sécurité")
    bullet(doc, [
        "Authentification : JWT (HS256, expire 30 jours, refresh 7 jours, rotation à chaque login).",
        "Mots de passe : bcrypt cost 12.",
        "PIN agent/client : bcrypt + 5 tentatives max → lockout 15 min.",
        "Cookies session web : HttpOnly, SameSite=Lax, Secure, 12h TTL.",
        "Tous les flux HTTPS / TLS 1.2 minimum (Let's Encrypt ECDSA).",
        "Secrets stockés dans .env (chmod 600) + jamais commit en clair.",
        "Rate limiting : 100 req/min par IP (configurable), 5 tentatives login/15min.",
        "Fail2ban actif sur SSH + Nginx (bot detection + bruteforce).",
        "Pas de stockage de données bancaires (tokenisé via Stripe).",
        "Audit log des actions sensibles : changement rôle, refund, override commission.",
    ])

    h1(doc, "8. Haute disponibilité")
    bullet(doc, [
        "VPS unique Y1 (acceptable pour MVP avec SLA 99 %).",
        "Y2 : MongoDB replica set (3 nodes) + load balancer + 2 backends FastAPI.",
        "Backups quotidiens MongoDB + externalisation chiffrée S3 hebdomadaire.",
        "Heartbeat monitoring toutes les 60 sec sur tous les services.",
        "Plan de bascule documenté (RTO 4h, RPO 24h en Y1 ; RTO 30 min, RPO 1h en Y2).",
    ])

    h1(doc, "9. Supervision et observabilité")
    bullet(doc, [
        "pm2 process monitoring + logs aggregation.",
        "Nginx access + error logs avec rotation logrotate.",
        "Sentry (Y1 cible) pour les erreurs applicatives mobile + backend.",
        "Métriques business : Prometheus + Grafana en Y2 (transferts/min, taux de réussite, latence WS).",
        "Alertes Slack #ops-alerts pour : downtime > 1 min, taux d'erreur > 5 %, certificat expirant < 30 jours.",
    ])

    h1(doc, "10. Journalisation")
    bullet(doc, [
        "Logs applicatifs : niveau INFO en prod, DEBUG en staging.",
        "Format JSON structuré (timestamp ISO8601, niveau, requête_id, user_id, message).",
        "Conservation 30 jours en local + 1 an externalisé (compliance AML).",
        "Audit logs spécifiques (collection audit_logs MongoDB) pour les actions sensibles : conservés 5 ans.",
    ])
    return save(doc, "03_Technique_ArchitectureTechnique.docx")


# Run all
if __name__ == "__main__":
    print("=== Génération documents 1.x à 2.4 + 3.1 ===")
    doc_1_1_note_cadrage()
    doc_1_2_business_case()
    doc_1_3_gouvernance()
    doc_2_1_cdcf()
    doc_2_2_specs_fonctionnelles()
    doc_2_3_user_stories()
    doc_2_4_regles_metier()
    doc_3_1_architecture()
    print("✅ Partie 1 terminée.")
