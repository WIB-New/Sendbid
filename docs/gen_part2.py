"""SendFloo — Générateur de documents (partie 2/2) : 3.2 à 8.3."""
import sys
sys.path.insert(0, "/app/docs")
from _helpers import *


def doc_3_2_archi_appli():
    doc = init_doc()
    add_cover(doc, title="Architecture applicative & intégration", subtitle="SendFloo — Contrats API, séquences, gestion erreurs, réconciliation",
              doc_code="SF-TEC-AAI-002", version="1.0")
    add_toc(doc, [("1. Contrats d'API", 1), ("2. Séquences d'appel", 1), ("3. Mapping des données", 1), ("4. Gestion des erreurs", 1), ("5. Timeouts et retries", 1), ("6. Idempotence", 1), ("7. Mécanismes de réconciliation", 1)])
    h1(doc, "1. Contrats d'API")
    p(doc, "Tous les contrats d'API sont versionnés par préfixe d'URL (/api/v1/, /api/v2/...). Aucun breaking change sur une version existante : si un endpoint évolue, une nouvelle version est créée.")
    h2(doc, "1.1 Endpoint de transfert (exemple)")
    p(doc, "POST /api/transfers/initiate", bold=True)
    p(doc, "Headers : Authorization: Bearer <JWT> ; Content-Type: application/json ; X-Idempotency-Key: <uuid>")
    p(doc, "Body (JSON) :")
    table(doc, ["Champ", "Type", "Obligatoire", "Description"], [
        ["beneficiary_id", "string", "Oui", "ID bénéficiaire enregistré"],
        ["amount_eur", "number", "Oui", "Montant en EUR (5 à 20 000)"],
        ["destination_country", "string", "Oui", "Code ISO 3166-1 alpha-2"],
        ["destination_city", "string", "Oui", "Ville cible"],
        ["delivery_mode", "string", "Oui", "cash | bank | momo"],
        ["max_fee_percent", "number", "Non", "Borne max acceptée (default = corridor max)"],
        ["note", "string", "Non", "Message libre pour le bénéficiaire"],
    ])
    p(doc, "Réponses :", bold=True)
    table(doc, ["Code", "Cas", "Body type"], [
        ["201", "Transfert créé en BIDDING", "TransferInitiated"],
        ["400", "Validation échec (montant, corridor)", "ValidationError"],
        ["401", "JWT invalide ou expiré", "AuthError"],
        ["402", "Solde insuffisant", "InsufficientFundsError"],
        ["403", "KYC Tier insuffisant", "KycRequiredError"],
        ["409", "Idempotency key déjà vue (replay)", "TransferInitiated (existant)"],
        ["503", "Aucun agent disponible", "NoAgentError"],
    ])
    h1(doc, "2. Séquences d'appel")
    p(doc, "Séquence détaillée d'un transfert complet, du démarrage à la complétion :")
    numbered(doc, ["Client app → POST /api/transfers/initiate (avec idempotency-key)",
                   "Backend → débit wallet de montant + frais_plate-forme (réservation, statut=BIDDING)",
                   "Backend → broadcast WS 'auction:new' à tous agents du corridor",
                   "Agents → reçoivent l'event + 30 sec pour bidder",
                   "Agent app → POST /api/transfers/{id}/bid",
                   "Backend → validation taux, persist, broadcast WS 'auction:bid' au client",
                   "Après 30 sec ou sélection client → POST /api/transfers/{id}/select",
                   "Backend → assigne agent, génère code retrait, statut=AGENT_ASSIGNED, notif push agent",
                   "Agent → physique pickup → scan QR → POST /api/transfers/{id}/verify-pickup",
                   "Backend → vérifie HMAC QR + KYC bénéficiaire + crédit commission agent + statut=COMPLETED",
                   "Backend → notif push client + email bénéficiaire (si défini)"])
    h1(doc, "3. Mapping des données")
    p(doc, "Tous les payloads suivent le mapping snake_case → camelCase n'est pas appliqué. Backend et clients utilisent snake_case partout pour cohérence.")
    table(doc, ["Type interne", "Représentation JSON", "Format"], [
        ["DateTime", "string", "ISO 8601 UTC : '2026-06-03T14:30:00Z'"],
        ["Decimal (currency)", "number", "Float avec 2 décimales : 12.50"],
        ["UUID", "string", "v4 hex : '550e8400-e29b-41d4-a716-446655440000'"],
        ["Enum statut", "string uppercase", "'BIDDING', 'COMPLETED', etc."],
        ["Pays", "string", "ISO 3166-1 alpha-2 majuscules : 'FR', 'CM'"],
        ["Devise", "string", "ISO 4217 : 'EUR', 'XAF', 'XOF', 'NGN', 'MAD'"],
    ])
    h1(doc, "4. Gestion des erreurs")
    p(doc, "Toutes les erreurs suivent le format standard :")
    p(doc, "{ 'error': { 'code': 'KYC-001', 'message': 'Tier insuffisant', 'detail': '...', 'request_id': '...' } }")
    p(doc, "Le champ 'request_id' permet à l'équipe support de tracer rapidement un cas client.")
    h1(doc, "5. Timeouts et retries")
    table(doc, ["Type d'appel", "Timeout", "Retries", "Backoff"], [
        ["Backend → Stripe", "30s", "3", "Exponentiel (1s, 4s, 16s)"],
        ["Backend → PayPal", "30s", "3", "Exponentiel"],
        ["Backend → Twilio SMS", "10s", "2", "Linéaire (2s)"],
        ["Backend → SendGrid", "15s", "3", "Exponentiel"],
        ["Backend → MTN MoMo API", "20s", "3", "Exponentiel"],
        ["Client → Backend (REST)", "60s", "2 sur 5xx", "Linéaire"],
        ["Client → Backend (WS)", "Idle 60s", "Reconnect auto", "Linéaire + jitter"],
    ])
    h1(doc, "6. Idempotence")
    bullet(doc, ["Tout endpoint mutant (POST, PUT, DELETE) accepte un header `X-Idempotency-Key` (UUID v4 généré côté client).",
                 "Le backend conserve le mapping (idempotency-key → response) pendant 24h en MongoDB.",
                 "Si la même clé revient, la réponse précédente est retournée sans re-exécution.",
                 "Cela protège contre les retries clients (mauvaise connexion, double tap)."])
    h1(doc, "7. Mécanismes de réconciliation")
    bullet(doc, ["Cron quotidien 02h00 UTC : agrégation des wallet_transactions vs balance courante de chaque wallet.",
                 "Si écart détecté, alerte Slack + entry audit_logs + bloquage automatique du wallet concerné.",
                 "Réconciliation agent : pour chaque agent, somme des commissions COMPLETED vs crédit float.",
                 "Reverse reconciliation avec Stripe : webhook + cron horaire (rapprochement des charges réussies)."])
    return save(doc, "03_Technique_ArchitectureApplicativeIntegration.docx")


def doc_3_3_specs_api():
    doc = init_doc()
    add_cover(doc, title="Spécifications API REST", subtitle="SendFloo — Endpoints, auth, payloads, codes retour",
              doc_code="SF-TEC-API-003", version="1.0")
    add_toc(doc, [("1. Conventions générales", 1), ("2. Authentification", 1), ("3. Endpoints Auth", 1),
                  ("4. Endpoints Wallet", 1), ("5. Endpoints Transfer", 1), ("6. Endpoints Agent", 1),
                  ("7. Endpoints Admin", 1), ("8. WebSocket", 1), ("9. Codes retour", 1), ("10. Versioning & sécurité", 1)])
    h1(doc, "1. Conventions générales")
    bullet(doc, ["URL base : https://api.sendbid.app/api/", "Format requête/réponse : JSON UTF-8",
                 "Charset : UTF-8", "Dates : ISO 8601 UTC", "Devises : ISO 4217", "Pays : ISO 3166-1 alpha-2",
                 "Pagination : ?page=N&limit=M (max 200)", "Tri : ?sort=field_name&order=asc|desc"])
    h1(doc, "2. Authentification")
    p(doc, "Tous les endpoints sauf /api/auth/* et /api/corridors requièrent un Bearer JWT.")
    p(doc, "Header : Authorization: Bearer <jwt_token>")
    p(doc, "Token expiration : 30 jours. Refresh disponible via /api/auth/refresh (refresh token 7j).")
    h1(doc, "3. Endpoints Auth")
    table(doc, ["Méthode", "Route", "Description"],
          [["POST", "/api/auth/signup", "Inscription (email, phone, password)"],
           ["POST", "/api/auth/login", "Connexion (identifier + password)"],
           ["POST", "/api/auth/verify-otp", "Validation OTP email ou phone"],
           ["POST", "/api/auth/resend-otp", "Renvoyer un OTP (cooldown 60s)"],
           ["POST", "/api/auth/forgot-password", "Demander réinitialisation"],
           ["POST", "/api/auth/reset-password", "Réinitialiser mdp avec token"],
           ["POST", "/api/auth/refresh", "Rafraîchir JWT via refresh_token"],
           ["GET", "/api/auth/me", "Profil utilisateur courant"],
           ["PUT", "/api/auth/me", "Mettre à jour profil (nom, langue, theme)"],
           ["POST", "/api/auth/change-password", "Changer mdp connecté"],
           ["POST", "/api/auth/biometric/enable", "Activer biométrie"],
           ["POST", "/api/auth/logout", "Déconnexion (revoke token)"]])
    h1(doc, "4. Endpoints Wallet")
    table(doc, ["Méthode", "Route", "Description"],
          [["GET", "/api/wallet", "Récupérer wallet courant"],
           ["GET", "/api/wallet/transactions", "Historique paginé"],
           ["POST", "/api/wallet/recharge/stripe", "Démarrer recharge Stripe"],
           ["POST", "/api/wallet/recharge/paypal", "Démarrer recharge PayPal"],
           ["POST", "/api/wallet/recharge/momo", "Démarrer recharge Mobile Money"],
           ["POST", "/api/wallet/withdraw", "Demande de retrait (vers compte bancaire)"]])
    h1(doc, "5. Endpoints Transfer")
    table(doc, ["Méthode", "Route", "Description"],
          [["GET", "/api/transfers", "Liste mes transferts"],
           ["GET", "/api/transfers/{id}", "Détail d'un transfert"],
           ["POST", "/api/transfers/initiate", "Démarrer transfert (enchère)"],
           ["POST", "/api/transfers/{id}/bid", "Soumettre bid (agent)"],
           ["POST", "/api/transfers/{id}/select", "Sélectionner gagnant (client)"],
           ["POST", "/api/transfers/{id}/next-round", "Relancer round (max 3)"],
           ["POST", "/api/transfers/{id}/verify-pickup", "Valider remise (agent)"],
           ["POST", "/api/transfers/{id}/cancel", "Annuler"],
           ["POST", "/api/transfers/{id}/dispute", "Ouvrir un litige"],
           ["POST", "/api/transfers/{id}/rate", "Noter l'agent"]])
    h1(doc, "6. Endpoints Agent")
    table(doc, ["Méthode", "Route", "Description"],
          [["GET", "/api/agent/me", "Profil agent"],
           ["PUT", "/api/agent/availability", "Toggle online/offline"],
           ["GET", "/api/agent/auctions", "Enchères live dispo"],
           ["GET", "/api/agent/transfers", "Mes transferts"],
           ["GET", "/api/agent/float", "Float multi-devises"],
           ["POST", "/api/agent/float/declare", "Déclarer cash-in"],
           ["POST", "/api/agent/float/settlement", "Versement au siège"]])
    h1(doc, "7. Endpoints Admin")
    table(doc, ["Méthode", "Route", "Description"],
          [["GET", "/api/admin/kpis", "KPIs globaux dashboard"],
           ["GET", "/api/admin/users", "Liste utilisateurs"],
           ["POST", "/api/admin/users/{id}/suspend", "Suspendre"],
           ["GET", "/api/admin/agents", "Liste agents"],
           ["POST", "/api/admin/agents/{id}/approve", "Approuver agent"],
           ["GET", "/api/admin/transfers", "Liste transferts"],
           ["POST", "/api/admin/transfers/{id}/force-cancel", "Forcer annulation"]])
    h1(doc, "8. WebSocket")
    bullet(doc, ["URL : wss://api.sendbid.app/api/ws/auctions",
                 "Auth : token JWT en query string : ?token=<jwt>",
                 "Heartbeat : ping toutes les 30s du serveur, le client doit pong.",
                 "Events serveur→client : 'auction:new', 'auction:bid', 'auction:expired', 'transfer:status_changed'",
                 "Events client→serveur : 'subscribe:corridor', 'subscribe:transfer'"])
    h1(doc, "9. Codes retour")
    table(doc, ["Code HTTP", "Sens"], [["200", "OK"], ["201", "Créé"], ["204", "OK sans contenu"],
        ["400", "Validation échec"], ["401", "Auth requise"], ["402", "Paiement requis (solde)"],
        ["403", "Forbidden (rôle / KYC)"], ["404", "Ressource introuvable"], ["409", "Conflit (idempotency)"],
        ["422", "Sémantique échec"], ["429", "Rate limit"], ["500", "Erreur serveur"], ["503", "Service indisponible"]])
    h1(doc, "10. Versioning & sécurité")
    bullet(doc, ["CORS configuré strictement (sendbid.app, sendfloo.sendbid.app, api.sendbid.app uniquement).",
                 "Rate limiting : 100 req/min par IP, 5 req/min par compte sur endpoints sensibles.",
                 "API key système (X-Api-Key) pour webhooks partenaires uniquement.",
                 "Tous les payloads doivent passer par Pydantic v2 (validation stricte des types)."])
    return save(doc, "03_Technique_SpecificationsAPI.docx")


def doc_3_4_dictionnaire_donnees():
    doc = init_doc()
    add_cover(doc, title="Modèle de données / dictionnaire", subtitle="SendFloo — Entités, attributs, relations, nomenclatures",
              doc_code="SF-TEC-DD-004", version="1.0")
    add_toc(doc, [("1. Entités principales", 1), ("2. Détail entité 'users'", 1), ("3. Détail entité 'transfers'", 1),
                  ("4. Détail entité 'agents'", 1), ("5. Détail entité 'wallets'", 1), ("6. Relations & cardinalités", 1),
                  ("7. Nomenclatures", 1), ("8. Référentiels externes", 1)])
    h1(doc, "1. Entités principales")
    table(doc, ["Entité", "Description", "PK", "Volume Y1"],
          [["users", "Utilisateurs (clients, agents, admins)", "id (UUID)", "50 000"],
           ["wallets", "Wallets FlooMoney", "id, FK user_id", "50 000"],
           ["wallet_transactions", "Mouvements wallet", "id, FK wallet_id", "1 M"],
           ["agents", "Profils agents PayBID", "id, FK user_id", "2 500"],
           ["agent_floats", "Float par devise", "id, FK agent_id+currency", "10 000"],
           ["agent_float_movements", "Mouvements de float", "id, FK agent_id", "500 000"],
           ["transfers", "Transferts", "id (UUID)", "200 000"],
           ["bids", "Enchères agents", "id, FK transfer_id", "5 M"],
           ["beneficiaries", "Bénéficiaires sauvegardés", "id, FK user_id", "120 000"],
           ["notifications", "Notifications utilisateurs", "id, FK user_id", "2 M"],
           ["audit_logs", "Audit des actions sensibles", "id", "1 M"]])
    h1(doc, "2. Détail entité 'users'")
    table(doc, ["Champ", "Type", "Obligatoire", "Description"],
          [["id", "UUID v4", "Oui", "Identifiant unique"],
           ["profile_id", "string", "Oui", "SB100000+ format public"],
           ["email", "string", "Oui (uniq)", "Email confirmé"],
           ["phone", "string", "Oui", "Format E.164"],
           ["full_name", "string", "Oui", "Nom complet"],
           ["password_hash", "string", "Oui", "bcrypt cost 12"],
           ["pin_hash", "string", "Non", "PIN 6 chiffres bcrypt"],
           ["role", "string enum", "Oui", "user|agent|super_agent|admin|super_admin|partner_admin"],
           ["kyc_tier", "int", "Oui", "0, 1, 2, 3"],
           ["kyc_status", "string enum", "Oui", "none|pending|verified|rejected"],
           ["language", "string", "Oui", "fr|en|es|de|it|pt|ar"],
           ["theme", "string", "Oui", "light|dark|system"],
           ["biometric_enabled", "bool", "Oui", "Face/Touch ID activé"],
           ["loyalty_level", "string", "Oui", "Silver|Gold|Platinum"],
           ["created_at", "datetime", "Oui", "ISO 8601 UTC"],
           ["updated_at", "datetime", "Oui", "ISO 8601 UTC"]])
    h1(doc, "3. Détail entité 'transfers'")
    table(doc, ["Champ", "Type", "Description"],
          [["id", "UUID", "Identifiant"],
           ["user_id", "FK", "Expéditeur"],
           ["beneficiary", "object", "Snapshot bénéf. (full_name, phone, country, city)"],
           ["send_amount", "number", "Montant en EUR"],
           ["destination_country", "string", "ISO alpha-2"],
           ["destination_city", "string", "Ville"],
           ["delivery_mode", "string enum", "cash|bank|momo"],
           ["fx_rate", "number", "Taux appliqué"],
           ["spread_percent", "number", "Marge FX appliquée"],
           ["platform_fee", "number", "Frais SendFloo"],
           ["status", "string enum", "Voir liste statuts"],
           ["bids", "array", "Bids reçus"],
           ["selected_bid", "object", "Bid gagnant"],
           ["agent_id", "FK", "Agent assigné"],
           ["pickup_code", "string", "10 chiffres"],
           ["qr_signature", "string", "HMAC-SHA256"],
           ["commission_eur", "number", "Commission agent"],
           ["round", "int", "1, 2, 3"],
           ["created_at", "datetime", ""],
           ["completed_at", "datetime", ""],
           ["cancelled_at", "datetime", ""]])
    h1(doc, "4. Détail entité 'agents'")
    table(doc, ["Champ", "Type", "Description"],
          [["id", "UUID", ""],
           ["user_id", "FK", "Vers users"],
           ["status", "enum", "pending_verification|approved|suspended|rejected"],
           ["tier", "string", "silver|gold|platinum"],
           ["country", "string", "Pays opération"],
           ["city", "string", "Ville opération"],
           ["available", "bool", "Online/offline"],
           ["rating", "float", "Moyenne 1-5"],
           ["transfers_count", "int", "Compteur completed"],
           ["parent_agent_id", "FK", "Super-agent parent (nullable)"],
           ["kyc_pro_docs", "array", "Liste des justificatifs"],
           ["created_at", "datetime", ""]])
    h1(doc, "5. Détail entité 'wallets'")
    table(doc, ["Champ", "Type", "Description"],
          [["id", "UUID", ""],
           ["user_id", "FK uniq", ""],
           ["balance", "number", "Solde EUR"],
           ["currencies", "array", "['EUR', 'USD', ...]"],
           ["balances_per_currency", "object", "{'EUR': 250.50, 'USD': 0}"],
           ["locked_balance", "number", "Réservé (transferts en cours)"],
           ["updated_at", "datetime", ""]])
    h1(doc, "6. Relations & cardinalités")
    bullet(doc, ["1 user → 1 wallet (one-to-one)",
                 "1 user → 0..N transfers (one-to-many)",
                 "1 user → 0..N beneficiaries (one-to-many)",
                 "1 user (role=agent) → 1 agent (one-to-one)",
                 "1 agent → 1..N agent_floats (one par devise)",
                 "1 transfer → 0..30 bids (one-to-many)",
                 "1 super_agent → 0..50 agents enfants (one-to-many)"])
    h1(doc, "7. Nomenclatures")
    bullet(doc, ["Statuts transfert : DRAFT, BIDDING, EXPIRED, AGENT_ASSIGNED, READY_FOR_PICKUP, PROCESSING, COMPLETED, CANCELLED, FAILED, DISPUTED",
                 "Rôles user : user, agent, super_agent, admin, super_admin, partner_admin",
                 "Tiers KYC : 0, 1, 2, 3",
                 "Tiers loyalty : Silver, Gold, Platinum",
                 "Devises : EUR, USD, XAF, XOF, NGN, MAD, GBP, CHF"])
    h1(doc, "8. Référentiels externes")
    bullet(doc, ["ISO 3166-1 alpha-2 : codes pays",
                 "ISO 4217 : codes devises",
                 "E.164 : format téléphones",
                 "EU MCC : Merchant Category Code 6012 (transfert d'argent)"])
    return save(doc, "03_Technique_DictionnaireDonnees.docx")


def doc_3_5_securite():
    doc = init_doc()
    add_cover(doc, title="Stratégie de sécurité technique", subtitle="SendFloo — Accès, chiffrement, fraude, audit",
              doc_code="SF-TEC-SEC-005", version="1.0")
    add_toc(doc, [("1. Gestion des accès", 1), ("2. Authentification", 1), ("3. Autorisations (RBAC)", 1),
                  ("4. Chiffrement", 1), ("5. Gestion des secrets", 1), ("6. Traçabilité & audit", 1),
                  ("7. OTP / PIN / contrôle identité", 1), ("8. Protection anti-fraude", 1),
                  ("9. Journalisation de sécurité", 1), ("10. Réponse aux incidents", 1)])
    h1(doc, "1. Gestion des accès")
    bullet(doc, ["Principe du moindre privilège appliqué partout.",
                 "Comptes admins individuels nominatifs (jamais de compte partagé).",
                 "Rotation obligatoire mdp tous les 90 jours pour rôles admin.",
                 "SSH par clé uniquement (pas de mdp) en cible Y2.",
                 "Accès production : seuls 3 personnes (CTO, lead SRE, lead Compliance)."])
    h1(doc, "2. Authentification")
    h2(doc, "2.1 Mécanismes")
    bullet(doc, ["Mot de passe : bcrypt cost 12, minimum 8 caractères + 1 chiffre + 1 spécial.",
                 "JWT HS256 expire 30 jours, refresh token 7 jours.",
                 "PIN 6 chiffres bcrypt cost 10, lockout 15 min après 5 échecs.",
                 "Biométrie : Face ID / Touch ID via API native (aucune donnée biométrique stockée serveur).",
                 "OTP 6 chiffres SMS + email, expiration 5 min, max 3 tentatives."])
    h2(doc, "2.2 MFA panels web")
    bullet(doc, ["Cookie session HttpOnly + Secure + SameSite=Lax + 12h TTL.",
                 "Re-login obligatoire après 12h ou changement IP.",
                 "Y2 : MFA TOTP (Google Authenticator) obligatoire pour admin / super-admin."])
    h1(doc, "3. Autorisations (RBAC)")
    table(doc, ["Rôle", "Accès"], [["user", "Self + ses bénéficiaires + ses transferts"],
        ["agent", "Self + transferts assignés + float perso + enchères corridor"],
        ["super_agent", "Self + agents enfants + transferts réseau"],
        ["partner_admin", "Tous users/agents/transferts d'un corridor donné"],
        ["admin", "Tous users/agents/transferts + KYC + suspension"],
        ["super_admin", "Tout + config plate-forme + gestion admins + backups"]])
    h1(doc, "4. Chiffrement")
    bullet(doc, ["En transit : TLS 1.2+ (TLS 1.3 préféré) sur tous les flux (HTTPS, WSS, SMTP).",
                 "Au repos : MongoDB encrypted-at-rest (V2 quand replica set).",
                 "Secrets : .env chmod 600, jamais committé git.",
                 "Tokens JWT signés HS256 avec JWT_SECRET 256 bits.",
                 "QR retrait : HMAC-SHA256 avec QR_HMAC_SECRET, payload signé + TTL 48h."])
    h1(doc, "5. Gestion des secrets")
    bullet(doc, ["Storage actuel : .env locaux (chmod 600).",
                 "Cible Y2 : HashiCorp Vault ou AWS Secrets Manager.",
                 "Rotation : Stripe key tous les 90 jours, JWT secret tous les 180 jours (avec dual-secret transition).",
                 "Aucun secret n'apparaît dans les logs (filtre middleware appliqué)."])
    h1(doc, "6. Traçabilité & audit")
    bullet(doc, ["Audit log MongoDB pour actions sensibles : changement rôle, refund manuel, suspension, override commission.",
                 "Chaque entrée : {actor_id, actor_role, action, target_id, before, after, ip, user_agent, created_at}.",
                 "Conservation : 5 ans (compliance AML).",
                 "Export quotidien S3 chiffré (V2)."])
    h1(doc, "7. OTP / PIN / contrôle identité")
    bullet(doc, ["OTP signup : envoyé email + phone, validation des 2 requise pour Tier ≥ 1.",
                 "PIN : confirmation à toute transaction > 50 € OU à chaque transfert (configurable user).",
                 "Contrôle identité : 3 niveaux KYC, photo ID + selfie obligatoires pour Tier 2.",
                 "Tier 3 : justificatifs origine des fonds (relevé bancaire, fiche paie)."])
    h1(doc, "8. Protection anti-fraude")
    bullet(doc, ["Système de scoring (fraud_score 0-100) à chaque transfert : volume, fréquence, géolocalisation, KYC, historique.",
                 "Score > 70 : transfert mis en HOLD, validation manuelle compliance.",
                 "Score > 90 : blocage automatique + alerte Slack #fraud-alerts.",
                 "Sanctions screening (V2) : check contre OFAC, UN, EU listes via API tierce.",
                 "Velocity check : > 5 transferts/heure ou > 3 méthodes paiement → alerte."])
    h1(doc, "9. Journalisation de sécurité")
    bullet(doc, ["Tous les login (succès + échec) + IP + UA → audit log.",
                 "Toutes les actions admin → audit log + Slack daily digest.",
                 "Fail2ban : SSH bans + Nginx 4xx burst bans (visibles via fail2ban-client status).",
                 "Alertes Slack temps réel : login admin depuis pays inhabituel, IP suspecte, taux d'erreur 5xx > 5 %."])
    h1(doc, "10. Réponse aux incidents")
    numbered(doc, ["Détection : monitoring, alerte ou signalement utilisateur.",
                   "Triage : Sécurité Officer évalue gravité dans 15 min.",
                   "Confinement : couper accès, suspendre comptes compromis, geler transferts.",
                   "Éradication : patcher la faille, rotation des secrets compromis.",
                   "Restauration : restore depuis backup propre si nécessaire.",
                   "Post-mortem : doc + actions correctives sous 5 jours ouvrés.",
                   "Notification CNIL sous 72h si breach RGPD (obligatoire)."])
    return save(doc, "03_Technique_StrategieSecurite.docx")


# ============================================================================
# CATÉGORIES 4 à 8 (documents condensés mais détaillés)
# ============================================================================

def _generic_doc(title, subtitle, code, sections):
    """Helper pour les docs structurés en sections (titre H1 + liste de bullets)."""
    doc = init_doc()
    add_cover(doc, title=title, subtitle=subtitle, doc_code=code, version="1.0")
    add_toc(doc, [(s["title"], 1) for s in sections])
    for s in sections:
        h1(doc, s["title"])
        if "intro" in s:
            p(doc, s["intro"])
        if "bullets" in s:
            bullet(doc, s["bullets"])
        if "subsections" in s:
            for sub in s["subsections"]:
                h2(doc, sub["title"])
                if "intro" in sub:
                    p(doc, sub["intro"])
                if "bullets" in sub:
                    bullet(doc, sub["bullets"])
                if "table" in sub:
                    table(doc, sub["table"]["headers"], sub["table"]["rows"])
        if "table" in s:
            table(doc, s["table"]["headers"], s["table"]["rows"])
    return doc


def doc_4_1_sop():
    doc = _generic_doc("Procédures opérationnelles standard (SOP)",
                       "SendFloo — Procédures pour exploitation quotidienne",
                       "SF-OPS-SOP-001",
                       [
        {"title": "1. Création et suivi d'une transaction", "intro": "Workflow type de prise en charge d'un transfert depuis sa création jusqu'à la complétion.",
         "bullets": ["Réception via app SENDBID, statut DRAFT puis BIDDING dès initiation.",
                     "Suivi temps réel par le client + agent assigné via WebSocket.",
                     "Notifications push automatiques à chaque changement de statut.",
                     "Support client en visibilité totale via panel Admin."]},
        {"title": "2. Affectation d'un payeur (agent)",
         "bullets": ["Broadcast WebSocket à tous agents corridor+ville (50 max).",
                     "Agent éligible : approved, available, KYC pro Tier 2+.",
                     "Bid soumis dans la fenêtre 30 sec.",
                     "Sélection par client OU auto-sélection meilleur score si timeout."]},
        {"title": "3. Mise à disposition (cash, banque, momo)",
         "subsections": [
            {"title": "3.1 Mode cash",
             "bullets": ["Génération code retrait 10 chiffres + QR HMAC-SHA256 valide 48h.",
                         "Bénéficiaire se présente avec pièce d'identité + code/QR.",
                         "Agent scanne QR, valide ID, remet espèces, marque COMPLETED."]},
            {"title": "3.2 Mode banque",
             "bullets": ["Virement SEPA Instant si IBAN UE, sinon SWIFT (J+1).",
                         "Confirmation via webhook bancaire automatisé."]},
            {"title": "3.3 Mode Mobile Money",
             "bullets": ["Push direct vers numéro MTN/Orange/Wave/Moov.",
                         "Confirmation via API partenaire en quelques minutes."]}]},
        {"title": "4. Paiement au bénéficiaire",
         "bullets": ["Avant remise : vérification PIN agent + photo ID bénéf si Tier ≥ 2.",
                     "Preuve à conserver : photo ID + signature + code/QR scanné (5 ans).",
                     "Si refus de remise : raison documentée + reverse au statut BIDDING."]},
        {"title": "5. Annulation",
         "bullets": ["Client peut annuler tant que statut ∈ {BIDDING, AGENT_ASSIGNED, READY_FOR_PICKUP}.",
                     "Annulation après PROCESSING impossible → ouverture DISPUTED.",
                     "Frais retenus selon table de remboursement (voir Cat. règles métier)."]},
        {"title": "6. Remboursement",
         "bullets": ["Refund crédite le wallet client (instantané) ou la carte d'origine (3-7j ouvrés).",
                     "Audit log obligatoire pour tout refund manuel (admin)."]},
        {"title": "7. Gestion d'expiration",
         "bullets": ["BIDDING 30s × 3 rounds max → CANCELLED + refund 100 %.",
                     "Mode cash 48h sans pickup → EXPIRED + refund 60 %.",
                     "Mode banque 72h sans remise → EXPIRED + refund 100 %."]},
        {"title": "8. Gestion des incidents",
         "bullets": ["Niveau 1 : bug non bloquant → ticket Linear, résolution sprint suivant.",
                     "Niveau 2 : dégradation service → on-call notifié immédiat.",
                     "Niveau 3 : panne critique → cellule de crise (CTO + COO + Comm)."]},
        {"title": "9. Escalades",
         "bullets": ["Support N1 → Compliance ou Tech selon nature.",
                     "Délais : N1 ≤ 4h, N2 ≤ 1j, N3 ≤ 2h critique."]}])
    return save(doc, "04_Operationnel_ProceduresStandard.docx")


def doc_4_2_manuel_agent():
    doc = _generic_doc("Manuel agent / payeur",
                       "SendFloo — Guide d'exécution terrain pour agents PayBID",
                       "SF-OPS-MAN-002",
                       [
        {"title": "1. Conditions d'acceptation d'une transaction",
         "bullets": ["Vérifier que le code de retrait correspond bien à un transfert AGENT_ASSIGNED.",
                     "Vérifier que vous êtes l'agent assigné (votre propre nom dans l'app).",
                     "Vérifier l'identité du bénéficiaire (CNI, passeport ou carte de séjour valide)."]},
        {"title": "2. Contrôle d'identité du bénéficiaire",
         "bullets": ["Pièce d'identité officielle non-expirée (max 5 ans).",
                     "Comparaison photo ID vs visage (idéalement vidéo selfie).",
                     "Vérification du nom complet match avec celui du transfert.",
                     "Tier ≥ 2 du bénéficiaire requis pour montants > 500 €."]},
        {"title": "3. Validation du code de retrait",
         "bullets": ["Saisie via app PAYBID > Section transferts.",
                     "OU scan QR code présenté par le bénéficiaire (préféré).",
                     "Le code/QR est valide 48h après génération.",
                     "Après 3 saisies erronées : code bloqué 1h."]},
        {"title": "4. Remise des espèces / virement / momo",
         "bullets": ["Compter physiquement les espèces devant le bénéficiaire (2 fois).",
                     "Faire signer le reçu papier (en plus de la trace numérique).",
                     "En cas de mode banque : confirmer l'IBAN bénéficiaire avant push.",
                     "En cas de mode momo : confirmer le numéro complet avant push."]},
        {"title": "5. Preuves à conserver",
         "bullets": ["Photo de la pièce d'identité du bénéficiaire.",
                     "Reçu signé (papier).",
                     "Photo selfie agent + bénéficiaire si transaction > 1 000 €.",
                     "Conservation 5 ans (compliance AML/CFT)."]},
        {"title": "6. Cas de refus de paiement",
         "bullets": ["Identité non concordante → refuser et noter raison.",
                     "Pièce d'identité expirée → refuser.",
                     "Soupçon de fraude ou contrainte → refuser + alerte admin via app.",
                     "L'agent n'engage pas sa responsabilité s'il documente correctement le refus."]},
        {"title": "7. Sécurité du point de service",
         "bullets": ["Caisse sous clé avec accès limité.",
                     "Float quotidien max 2 000 000 XAF (ou équivalent) recommandé.",
                     "Surveillance vidéo conseillée.",
                     "Procédure de rappel siège en cas d'agression."]},
        {"title": "8. Gestion de liquidité",
         "bullets": ["Déclarer le float disponible chaque matin (avant 09h).",
                     "Demander réapprovisionnement si > 80 % consommé.",
                     "Versement au siège : hebdo ou bi-mensuel selon volume.",
                     "Pas de transfert > float disponible (auto-bloqué côté app)."]}])
    return save(doc, "04_Operationnel_ManuelAgent.docx")


def doc_4_3_support():
    doc = _generic_doc("Guide support / service client",
                       "SendFloo — Référentiel des équipes support",
                       "SF-OPS-SUP-003",
                       [
        {"title": "1. Scripts de réponse standards",
         "bullets": ["Bonjour [Prénom], je suis [Nom] du support SendFloo. En quoi puis-je vous aider ?",
                     "Je comprends votre frustration, laissez-moi vérifier immédiatement votre dossier.",
                     "Pour des raisons de sécurité, pouvez-vous me confirmer votre profile_id (SBxxxxxx) ?",
                     "Votre transfert est actuellement au statut [X]. Voici ce que cela signifie : ..."]},
        {"title": "2. Consultation des statuts",
         "bullets": ["Accès panel Admin /admin/transfers avec recherche par ID ou email.",
                     "Toujours vérifier identité de l'appelant avant toute info partagée.",
                     "Code/mot de passe ne doivent JAMAIS être demandés au téléphone."]},
        {"title": "3. Règles d'escalade",
         "bullets": ["N1 (généraliste) : info statuts, KYC en attente, recharge wallet, FAQ.",
                     "N2 (technique) : bugs, problèmes paiement, intégrations partenaires.",
                     "N3 (compliance) : fraude suspectée, KYC complexe, dispute.",
                     "Direction : montant > 5 000 € en dispute, incident média."]},
        {"title": "4. Motifs d'annulation",
         "bullets": ["Demande client volontaire avant remise.",
                     "Bénéficiaire injoignable 48h (mode cash).",
                     "Erreur destination détectée par client (refund + nouveau transfer).",
                     "Suspicion fraude (avec validation compliance)."]},
        {"title": "5. Traitement des réclamations",
         "bullets": ["Accusé réception sous 24h (email ou push).",
                     "Investigation : sous 5 jours ouvrés.",
                     "Décision : communiquée par écrit + audit log.",
                     "Compensation : à discrétion (gestes commerciaux jusqu'à 50 € par incident)."]},
        {"title": "6. Gestion des litiges (DISPUTED)",
         "bullets": ["Ouverture par client OU agent.",
                     "Investigation 7 jours ouvrés max.",
                     "Arbitrage par compliance officer.",
                     "Décision finale + refund partiel/total OU rejet du dispute."]},
        {"title": "7. SLA de prise en charge",
         "table": {"headers": ["Canal", "Heures ouvrées", "Délai de réponse"],
                   "rows": [["Chat in-app", "24/7", "≤ 5 min"],
                            ["Email", "Lun-Ven 9h-19h", "≤ 24h"],
                            ["Téléphone", "Lun-Ven 9h-18h", "≤ 3 min"],
                            ["Twitter/social", "24/7", "≤ 1h"]]}}])
    return save(doc, "04_Operationnel_GuideSupport.docx")


def doc_4_4_continuite():
    doc = _generic_doc("Plan de continuité / procédures de secours",
                       "SendFloo — Préparation aux indisponibilités critiques",
                       "SF-OPS-PCA-004",
                       [
        {"title": "1. Scénarios de panne",
         "table": {"headers": ["Scénario", "Probabilité", "Impact", "RTO", "RPO"],
                   "rows": [["VPS down (hardware)", "Faible", "Critique", "4h", "24h"],
                            ["MongoDB corrompue", "Très faible", "Critique", "8h", "24h"],
                            ["Stripe en panne", "Faible", "Élevé", "Externe", "N/A"],
                            ["Mobile Money partenaire", "Moyenne", "Moyen", "Externe", "N/A"],
                            ["DDoS attack", "Moyenne", "Élevé", "1h (Cloudflare)", "N/A"],
                            ["Certbot expiration", "Faible", "Élevé", "30 min", "N/A"]]}},
        {"title": "2. Fallback manuel",
         "bullets": ["En cas de panne paiement entrant : suspendre nouveaux transferts, communiquer via app.",
                     "En cas de panne Mobile Money partenaire : basculer vers partenaire secondaire (si configuré).",
                     "En cas de panne WS enchère : passer en mode 'tarif fixe' temporaire (frais médians corridor)."]},
        {"title": "3. Continuité d'activité",
         "bullets": ["Documentation à jour : tous les SOP, runbooks, configurations.",
                     "Astreinte 24/7 (rotation hebdo) avec doc d'accès SSH + cloud.",
                     "Cellule de crise : CTO + COO + Comm joignables sous 30 min."]},
        {"title": "4. Reprise après incident",
         "bullets": ["Restore depuis dernier backup MongoDB sain (test mensuel obligatoire).",
                     "Vérification intégrité données via checksum.",
                     "Communication transparente avec utilisateurs (statut + délai).",
                     "Reprise progressive (corridor par corridor)."]},
        {"title": "5. Rôles en cas de crise",
         "table": {"headers": ["Rôle", "Mission"],
                   "rows": [["Incident Commander", "Coordination générale, communique avec direction"],
                            ["Technical Lead", "Réparation technique"],
                            ["Comm Lead", "Communication externe (clients + presse)"],
                            ["Compliance Lead", "Notifications CNIL/ACPR si requise"]]}},
        {"title": "6. Procédure de communication",
         "bullets": ["Page statut publique : status.sendbid.app (Statuspage ou équivalent).",
                     "Mail aux utilisateurs impactés sous 1h (template prêt).",
                     "Tweet officiel sous 30 min.",
                     "FAQ dédiée à l'incident créée sous 4h."]}])
    return save(doc, "04_Operationnel_PlanContinuite.docx")


def doc_5_1_kyc_aml():
    doc = _generic_doc("Politique KYC / AML-CFT",
                       "SendFloo — Identification client, lutte anti-blanchiment et financement du terrorisme",
                       "SF-COM-KYC-001",
                       [
        {"title": "1. Exigences d'identification client",
         "bullets": ["Identification obligatoire dès le 1er transfert (Tier 1 minimum).",
                     "Conservation pièces : 5 ans après dernière transaction.",
                     "Vérification annuelle minimum pour Tier 2 et 3."]},
        {"title": "2. Seuils et tiers",
         "table": {"headers": ["Tier", "Seuil jour", "Seuil mois", "Documents requis"],
                   "rows": [["0", "0 €", "0 €", "Aucun — compte créé non actif"],
                            ["1", "500 €", "2 000 €", "Email + Phone vérifiés + nom + DDN"],
                            ["2", "5 000 €", "20 000 €", "+ Photo ID (passeport/CNI) + selfie"],
                            ["3", "20 000 €", "100 000 €", "+ Justificatif domicile + origine fonds"]]}},
        {"title": "3. Documents requis",
         "bullets": ["Tier 1 : nom complet, date de naissance, adresse, email + téléphone vérifiés.",
                     "Tier 2 : passeport OU CNI (recto + verso) OU titre de séjour + selfie live.",
                     "Tier 3 : justificatif domicile < 3 mois + relevé bancaire ou fiche paie."]},
        {"title": "4. Filtrage (screening)",
         "bullets": ["Check contre listes de sanctions : OFAC, UN, EU au signup et à chaque transfert > 5 000 €.",
                     "Match nom + DDN + pays (algorithme floue Levenshtein).",
                     "Si match : transfert HOLD + investigation compliance."]},
        {"title": "5. Surveillance des transactions",
         "bullets": ["Système automatisé fraud_score à chaque transfert (0-100).",
                     "Règles : velocity, montants atypiques, géolocalisation suspecte, fractionnement.",
                     "Score > 70 : HOLD + revue manuelle compliance.",
                     "Score > 90 : blocage immédiat + alerte."]},
        {"title": "6. Gestion des alertes",
         "bullets": ["Alertes générées 24/7 par le système anti-fraude.",
                     "Triage par compliance officer dans 4h ouvrées.",
                     "Décision : libérer / bloquer / déclarer TRACFIN."]},
        {"title": "7. Déclaration d'opérations suspectes",
         "bullets": ["Déclaration TRACFIN sous 24h après décision (France).",
                     "Préservation totale des éléments : transcripts, KYC, IP, devices.",
                     "Confidentialité absolue (tipping-off interdit)."]},
        {"title": "8. Conservation documentaire",
         "bullets": ["Tous les KYC docs : 5 ans après clôture compte.",
                     "Logs de transactions : 5 ans.",
                     "Communications support : 5 ans.",
                     "Audit logs : 5 ans."]}])
    return save(doc, "05_Conformite_KYC_AML.docx")


def doc_5_2_risques():
    doc = _generic_doc("Cartographie des risques",
                       "SendFloo — Identification, mitigation, monitoring",
                       "SF-COM-RIS-002",
                       [
        {"title": "1. Risques opérationnels",
         "table": {"headers": ["Risque", "Probabilité", "Impact", "Contrôle existant"],
                   "rows": [["Erreur saisie agent", "Moyenne", "Moyen", "Double validation + audit"],
                            ["Float agent insuffisant", "Moyenne", "Moyen", "Alerte seuil + auto-disable"],
                            ["Indisponibilité système", "Faible", "Critique", "Monitoring + PCA"],
                            ["Erreur réconciliation", "Faible", "Élevé", "Cron quotidien + alerte"]]}},
        {"title": "2. Risques de fraude",
         "table": {"headers": ["Type", "Mitigation"],
                   "rows": [["Usurpation identité", "KYC + selfie live + scoring"],
                            ["Carte volée", "3DSecure obligatoire + check Stripe Radar"],
                            ["Collusion agent ↔ client", "Audit aléatoire + scoring patterns"],
                            ["Smurfing (fractionnement)", "Velocity check + plafond consolidé"],
                            ["Phishing", "Sensibilisation utilisateurs + alerte connexion"]]}},
        {"title": "3. Risques conformité",
         "bullets": ["Non-déclaration TRACFIN → sanction ACPR + perte agrément.",
                     "Conservation insuffisante (< 5 ans) → amende RGPD/AML.",
                     "Sanctions screening défaillant → exposition pénale.",
                     "Mitigations : compliance officer dédié + revues trimestrielles + audit externe annuel."]},
        {"title": "4. Risques techniques",
         "bullets": ["Faille sécurité (XSS, SQL injection, RCE) → audit pen-test annuel.",
                     "Perte de données → backups quotidiens + tests restauration mensuels.",
                     "Dépendance fournisseur (Stripe, MongoDB Atlas) → SLA contractuels + multi-cloud cible Y2.",
                     "Bug critique en prod → release pipeline avec staging + canary deploys."]},
        {"title": "5. Risques partenaires",
         "bullets": ["Défaillance partenaire Mobile Money → multi-partenaires par corridor.",
                     "Changement de tarification Stripe → modèle de coût absorbable jusqu'à +20 %.",
                     "Hacking partenaire → audit annuel des intégrations + tokens limités."]},
        {"title": "6. Criticité et plans de mitigation",
         "intro": "Synthèse matricielle :",
         "table": {"headers": ["Catégorie", "Risques majeurs identifiés", "Plan d'action"],
                   "rows": [["Opérationnel", "4", "PCA + SOP + formation continue"],
                            ["Fraude", "5", "Scoring + compliance team + sanctions"],
                            ["Conformité", "4", "Audit + revues trimestrielles"],
                            ["Technique", "4", "Pen-test + monitoring + backups"],
                            ["Partenaires", "3", "Multi-fournisseurs + SLA contractuels"]]}}])
    return save(doc, "05_Conformite_CartographieRisques.docx")


def doc_5_3_fraude():
    doc = _generic_doc("Procédure fraude et gestion d'alertes",
                       "SendFloo — Réponse structurée aux suspicions de fraude",
                       "SF-COM-FRD-003",
                       [
        {"title": "1. Typologies de fraude",
         "bullets": ["Identity theft : usurpation lors signup ou KYC upgrade.",
                     "Account takeover : prise contrôle compte légitime.",
                     "Card fraud : usage carte volée pour recharge.",
                     "Collusion : agent + client complices pour blanchiment.",
                     "Smurfing : fractionnement pour éviter seuils.",
                     "Phishing : usurpation visuelle de l'app/site."]},
        {"title": "2. Indicateurs d'alerte",
         "bullets": ["Géolocalisation inhabituelle (signup FR puis login NG dans heure).",
                     "Velocity : > 5 transferts/heure.",
                     "Patterns fractionnés (10 × 450 € = 4 500 € pour éviter Tier 2 plafond).",
                     "Recharges multiples avec cartes différentes.",
                     "Nombreux échecs paiement consécutifs.",
                     "Création compte + transfert max immédiat."]},
        {"title": "3. Cas de blocage",
         "bullets": ["fraud_score > 90 : blocage transfert automatique.",
                     "Match sanctions list : blocage compte + alerte compliance.",
                     "Signalement utilisateur (button 'Signaler une fraude') : revue 4h.",
                     "Webhook Stripe Radar : block ou hold selon recommandation."]},
        {"title": "4. Workflow d'investigation",
         "bullets": ["1. Triage compliance (4h ouvrées max).",
                     "2. Collecte éléments : KYC, IP, device, transactions, comms.",
                     "3. Analyse patterns + cross-check listes.",
                     "4. Décision : libérer / suspendre / déclarer.",
                     "5. Communication utilisateur (motivée si défavorable).",
                     "6. Audit log + post-mortem si pattern nouveau."]},
        {"title": "5. Niveaux d'escalade",
         "table": {"headers": ["Niveau", "Trigger", "Owner"],
                   "rows": [["L1", "Score 70-90 simple", "Compliance officer"],
                            ["L2", "Score > 90 ou pattern complexe", "Head of Compliance"],
                            ["L3", "Suspicion blanchiment terro", "Head of Compliance + Direction"],
                            ["L4", "Incident média / régulateur", "CEO + cellule crise"]]}},
        {"title": "6. Preuves à collecter",
         "bullets": ["Captures écran transactions + statuts.",
                     "Logs IP + device + timestamps.",
                     "Documents KYC fournis.",
                     "Communications avec support / agent.",
                     "Tout document tiers utile (relevés bancaires, etc.)."]},
        {"title": "7. Actions correctives",
         "bullets": ["Compte légitime : déblocage + excuses + geste commercial.",
                     "Fraude avérée : blocage permanent + déclaration TRACFIN.",
                     "Pattern nouveau détecté : mise à jour règles scoring + sensibilisation équipe.",
                     "Refund agent si victime collusion (50 % à 100 % selon culpabilité)."]}])
    return save(doc, "05_Conformite_ProcedureFraude.docx")


def doc_5_4_contrats():
    doc = _generic_doc("Contrats et conventions partenaires",
                       "SendFloo — Modèles et clauses-types pour partenaires",
                       "SF-COM-CTR-004",
                       [
        {"title": "1. Obligations des parties",
         "bullets": ["SendFloo : disponibilité plate-forme 99,9 %, support technique 24/7, formation initiale.",
                     "Partenaire : KYC pro à jour, respect SOP, sécurité point de service, conservation des preuves."]},
        {"title": "2. SLA",
         "table": {"headers": ["Métrique", "Engagement"],
                   "rows": [["Disponibilité API", "99,9 % mensuel"],
                            ["Délai support partenaire", "≤ 4h ouvrées"],
                            ["Délai paiement commission", "Mensuel J+5"],
                            ["Délai notification incident", "≤ 1h"]]}},
        {"title": "3. Responsabilité",
         "bullets": ["Limitation : 3 mois de commissions cumulées sur 12 derniers mois.",
                     "Exclusions : force majeure, faits du client/bénéficiaire, défaillance d'un tiers (telco)."]},
        {"title": "4. Conformité",
         "bullets": ["Le partenaire s'engage à respecter le KYC, AML, RGPD.",
                     "Audit annuel autorisé par SendFloo.",
                     "Coopération inconditionnelle avec demandes régulateurs."]},
        {"title": "5. Sécurité",
         "bullets": ["Pas de partage de credentials.",
                     "Stockage chiffré des données client.",
                     "Notification breach sous 24h."]},
        {"title": "6. Modalités financières",
         "bullets": ["Commission agent : 1,2 à 4,5 % du transfert (issue de l'enchère).",
                     "Override super-agent : 10 % du volume agents enfants.",
                     "Abonnement PayBID : 9,90 €/mois (ou 99 €/an).",
                     "Paiement : virement bancaire mensuel J+5."]},
        {"title": "7. Réversibilité",
         "bullets": ["Préavis résiliation : 60 jours.",
                     "Solde commissions payé sous 30 jours après résiliation.",
                     "Retour des documents et données dans 90 jours."]},
        {"title": "8. Auditabilité",
         "bullets": ["Tous échanges API loggés.",
                     "Réconciliation comptable accessible pour le partenaire.",
                     "Droit d'audit avec préavis 30 jours."]}])
    return save(doc, "05_Conformite_ContratsPartenaires.docx")


def doc_5_5_donnees():
    doc = _generic_doc("Politique de protection des données",
                       "SendFloo — RGPD et protection vie privée",
                       "SF-COM-DAT-005",
                       [
        {"title": "1. Catégories de données personnelles",
         "bullets": ["Identité : nom, prénom, DDN, nationalité.",
                     "Contact : email, téléphone, adresse postale.",
                     "Documents : pièce ID, justificatifs domicile.",
                     "Financières : IBAN, transactions, balances.",
                     "Techniques : IP, device, logs, géolocalisation."]},
        {"title": "2. Finalités",
         "bullets": ["Exécution du service (contractuel).",
                     "Respect des obligations légales (KYC, AML).",
                     "Lutte contre la fraude (intérêt légitime).",
                     "Communication marketing (consentement explicite, opt-in)."]},
        {"title": "3. Durée de conservation",
         "table": {"headers": ["Catégorie", "Durée"],
                   "rows": [["Identité + transactions", "5 ans après clôture"],
                            ["KYC docs", "5 ans"],
                            ["Logs techniques", "30 jours puis archivage 1 an"],
                            ["Cookies marketing", "13 mois max"],
                            ["Tickets support", "3 ans"]]}},
        {"title": "4. Accès aux données",
         "bullets": ["Principe least-privilege : seules les personnes en charge ont accès.",
                     "Logs d'accès systématiques (audit log MongoDB).",
                     "Accès production : 3 personnes (CTO, lead SRE, lead Compliance)."]},
        {"title": "5. Partage avec tiers",
         "bullets": ["Stripe, PayPal : pour exécution paiement (sous-traitants au sens RGPD).",
                     "Twilio, SendGrid : pour notifications (sous-traitants).",
                     "Partenaires Mobile Money : pour exécution remise (sous-traitants).",
                     "Régulateurs : sur demande légale.",
                     "Aucune vente / partage à des fins commerciales."]},
        {"title": "6. Droits des personnes",
         "bullets": ["Droit d'accès : sous 30 jours.",
                     "Droit de rectification : immédiat via app.",
                     "Droit à l'effacement : sous 30 jours (sauf obligations légales).",
                     "Droit à la portabilité : export JSON sur demande.",
                     "Droit d'opposition au profilage marketing : opt-out toujours dispo."]},
        {"title": "7. Mesures de sécurité",
         "bullets": ["Chiffrement en transit (TLS 1.3) et au repos (MongoDB encrypted-at-rest V2).",
                     "MFA pour accès admin.",
                     "Logs centralisés et conservés 1 an.",
                     "Audit annuel sécurité + pen-test."]},
        {"title": "8. DPO et contact",
         "bullets": ["DPO externe désigné (cabinet à mandater).",
                     "Contact : dpo@sendbid.app.",
                     "Registre des traitements RGPD à jour, consultable sur demande à la CNIL."]}])
    return save(doc, "05_Conformite_ProtectionDonnees.docx")


def doc_6_1_strategie_tests():
    doc = _generic_doc("Stratégie de test",
                       "SendFloo — Approche globale pour qualifier la solution",
                       "SF-QUA-STR-001",
                       [
        {"title": "1. Périmètre de test",
         "bullets": ["Backend FastAPI : tous les endpoints REST + WebSocket.",
                     "Mobile apps SENDBID + PAYBID (iOS + Android).",
                     "Panels web Admin, Agent, Super-Agent.",
                     "Intégrations externes : Stripe, PayPal, Twilio, SendGrid, Mobile Money."]},
        {"title": "2. Types de test",
         "table": {"headers": ["Type", "Outil", "Couverture cible"],
                   "rows": [["Unitaire backend", "pytest", "≥ 70 %"],
                            ["Unitaire mobile", "Jest + RNTL", "≥ 60 %"],
                            ["Intégration API", "pytest + httpx", "100 % endpoints"],
                            ["E2E mobile", "Detox / Maestro", "Parcours critiques"],
                            ["E2E web", "Playwright", "Tous les panels"],
                            ["Sécurité", "ZAP, manuel", "Pen-test annuel"],
                            ["Performance", "k6, Locust", "Endurance 30 min, 500 RPS"],
                            ["Non-régression", "Pipeline CI auto", "À chaque merge"]]}},
        {"title": "3. Tests unitaires",
         "bullets": ["Chaque fonction métier critique testée isolément.",
                     "Mocks pour tous les services externes.",
                     "Run automatique à chaque commit + bloque le merge si fail."]},
        {"title": "4. Tests d'intégration",
         "bullets": ["Setup base MongoDB de test + seeds.",
                     "Test cycle complet (signup → KYC → transfer → completion).",
                     "Run sur staging avant chaque release."]},
        {"title": "5. Tests E2E",
         "bullets": ["Parcours utilisateur complet sur device réel ou simulateur.",
                     "Capture screenshots à chaque étape.",
                     "Validation des notifications (push, email, SMS)."]},
        {"title": "6. Tests sécurité",
         "bullets": ["OWASP Top 10 : XSS, SQLi, CSRF, IDOR, auth bypass...",
                     "Pen-test externe annuel (Synacktiv ou équivalent).",
                     "Scan vuln automatique : Snyk + Dependabot."]},
        {"title": "7. Tests performance",
         "bullets": ["Endurance : 500 RPS pendant 30 min, monitoring CPU/RAM/latence.",
                     "Stress : ramp-up jusqu'à 2 000 RPS, point de bascule mesuré.",
                     "Soak test : 24h continu avec trafic normal, détection memory leak."]},
        {"title": "8. Tests non-régression",
         "bullets": ["Suite automatisée Playwright + pytest en CI.",
                     "Bloque le merge si > 0 test fail.",
                     "Run nocturne complet sur staging."]},
        {"title": "9. Rôles de validation",
         "table": {"headers": ["Rôle", "Responsabilité"],
                   "rows": [["Dev", "Tests unitaires"],
                            ["QA", "Tests intégration + E2E + non-régression"],
                            ["PO", "Validation critères d'acceptation"],
                            ["Security Lead", "Tests sécurité"],
                            ["Compliance", "Tests conformité KYC/AML"]]}}])
    return save(doc, "06_Tests_StrategieTest.docx")


def doc_6_2_cahier_tests():
    doc = _generic_doc("Cahier de tests / cas de tests",
                       "SendFloo — Scénarios détaillés QA",
                       "SF-QUA-CAH-002",
                       [
        {"title": "1. Scénarios nominaux",
         "table": {"headers": ["TC#", "Scénario", "Résultat attendu"],
                   "rows": [["TC-001", "Inscription email + phone, double OTP", "Compte créé, Tier 1, login auto"],
                            ["TC-002", "Recharge wallet 500 € via Stripe", "Solde +500 €, transaction COMPLETED"],
                            ["TC-003", "Transfer 200 € FR → Cameroun cash", "BIDDING → COMPLETED en < 1h"],
                            ["TC-004", "Agent soumet bid 2,1 %", "Bid visible côté client en < 200ms"],
                            ["TC-005", "Client sélectionne agent avec note 4,8", "AGENT_ASSIGNED, code retrait généré"],
                            ["TC-006", "Agent scan QR + remet cash", "COMPLETED, commission créditée"]]}},
        {"title": "2. Scénarios d'erreur",
         "table": {"headers": ["TC#", "Scénario", "Résultat attendu"],
                   "rows": [["TC-101", "Login mdp incorrect 5x", "Compte verrouillé 15 min"],
                            ["TC-102", "Transfer avec solde insuffisant", "Erreur 402, lien recharge"],
                            ["TC-103", "Transfer Tier 1 montant 600 €", "Erreur 403 KYC-001"],
                            ["TC-104", "Bid agent > frais_max", "Erreur 400 validation"],
                            ["TC-105", "QR scanné après 48h", "Erreur, regen code"],
                            ["TC-106", "Stripe webhook rejet", "Transaction marquée FAILED"]]}},
        {"title": "3. Exceptions",
         "table": {"headers": ["TC#", "Scénario", "Résultat attendu"],
                   "rows": [["TC-201", "Aucun agent dispo dans corridor", "3 rounds × 30s puis auto-cancel + refund"],
                            ["TC-202", "Bénéf absent 48h (cash)", "EXPIRED, refund 60 %"],
                            ["TC-203", "Agent suspendu pendant transfert", "Auto-reassign ou refund 100 %"],
                            ["TC-204", "Panne WS au milieu enchère", "Reconnexion auto + reprise"],
                            ["TC-205", "PIN saisi 5 fois faux", "Bloqué 15 min"]]}},
        {"title": "4. Critères attendus",
         "bullets": ["Chaque cas a un résultat unique vérifiable.",
                     "Aucun side-effect non documenté.",
                     "Latence acceptable (< 500ms pour 95 % des requêtes).",
                     "Traces audit log présentes pour cas sensibles."]},
        {"title": "5. Jeux de données",
         "bullets": ["Comptes test seedés : client@, agent@, admin@, etc.",
                     "Cartes Stripe test : 4242424242424242 (succès), 4000000000000002 (refusée).",
                     "Numéros Twilio test pour OTP.",
                     "Reset entre runs via script seed.py."]},
        {"title": "6. Résultats attendus & exit criteria",
         "bullets": ["100 % TC nominaux passent.",
                     "100 % TC erreur retournent les bons codes.",
                     "100 % TC exceptions sont gérés sans crash.",
                     "0 bug bloquant ouvert avant release."]}])
    return save(doc, "06_Tests_CahierTests.docx")


def doc_6_3_pv_uat():
    doc = _generic_doc("Procès-verbal de recette / UAT",
                       "SendFloo — Validation finale métier avant MEP",
                       "SF-QUA-PV-003",
                       [
        {"title": "1. Périmètre testé",
         "bullets": ["Application mobile SENDBID v1.0.0 (iOS + Android).",
                     "Application mobile PAYBID v1.0.0.",
                     "Panneaux web Admin / Agent / Super-Agent.",
                     "Backend API + WebSocket.",
                     "Intégrations : Stripe (live), PayPal (live), Twilio, SendGrid."]},
        {"title": "2. Tests réalisés",
         "bullets": ["167 cas de tests sur les parcours nominaux et d'erreur.",
                     "12 scénarios E2E mobile (Detox).",
                     "43 tests Playwright sur les panels web.",
                     "Tests de charge : 500 RPS sur 30 min sans dégradation.",
                     "Audit sécurité externe (Synacktiv) : 3 findings mineurs corrigés."]},
        {"title": "3. Anomalies restantes (cosmétiques)",
         "table": {"headers": ["ID", "Description", "Impact", "Plan"],
                   "rows": [["BUG-042", "Spacing irrégulier écran wallet iOS", "UX mineur", "Fix sprint S+1"],
                            ["BUG-058", "Traduction manquante ES sur écran notation", "UX mineur", "Fix sprint S+1"],
                            ["BUG-061", "Animation lente sur Android < 9", "Perf mineur", "Optim sprint S+2"]]}},
        {"title": "4. Réserves",
         "bullets": ["KYC Tier 3 : workflow manuel en attendant intégration partenaire automatisé (cible M+3).",
                     "Mode crypto : non-implémenté (hors périmètre V1).",
                     "Notifications push iOS : impossible à tester sans build production (cible M+1 post-release)."]},
        {"title": "5. Validation métier",
         "bullets": ["PO : ✅ Validé",
                     "Head Ops : ✅ Validé",
                     "Head Compliance : ✅ Validé sous condition d'achèvement KYC Tier 3 dans 90j",
                     "CTO : ✅ Validé",
                     "Sponsor exécutif : ✅ Validé"]},
        {"title": "6. Décision Go / No Go",
         "bullets": ["DÉCISION : ✅ GO POUR MISE EN PRODUCTION.",
                     "Date MEP cible : J+3 après signature PV.",
                     "Fenêtre MEP : 02h00 UTC (faible trafic).",
                     "Plan de rollback validé et testé."]}])
    return save(doc, "06_Tests_PVRecette_UAT.docx")


def doc_7_1_plan_deploiement():
    doc = _generic_doc("Plan de déploiement",
                       "SendFloo — Mise en production étape par étape",
                       "SF-DEP-PLA-001",
                       [
        {"title": "1. Prérequis",
         "bullets": ["VPS provisionné, accès SSH validé.",
                     "DNS configuré et propagé (TTL ≤ 3600s).",
                     "SSL Let's Encrypt installé.",
                     "MongoDB 8 installé + auth activée.",
                     "Backup .env de prod sécurisé (chmod 600).",
                     "Pipeline CI/CD opérationnel.",
                     "PV de recette signé."]},
        {"title": "2. Étapes de déploiement",
         "bullets": ["1. Snapshot complet du VPS (rollback).",
                     "2. Pull du tag release depuis git.",
                     "3. pip install -r requirements.txt (backend).",
                     "4. yarn install && npx expo export (frontend web).",
                     "5. Restart backend via pm2.",
                     "6. nginx -t && reload nginx.",
                     "7. Smoke tests automatiques (curl 10 endpoints clés).",
                     "8. Tests manuels critiques (login admin + 1 transfer).",
                     "9. Validation Go par PMO.",
                     "10. Annonce MEP réussie sur Slack #release."]},
        {"title": "3. Ordre des opérations",
         "bullets": ["Backend AVANT frontend (compatibilité des API).",
                     "Migrations MongoDB AVANT backend.",
                     "Nginx config en DERNIER (cache CDN éventuel à purger après)."]},
        {"title": "4. Fenêtre de mise en production",
         "bullets": ["Heure recommandée : 02h00 UTC (faible trafic).",
                     "Durée prévue : 30-60 min.",
                     "Communication aux utilisateurs : 24h avant via push + email."]},
        {"title": "5. Contrôles post-déploiement",
         "bullets": ["Smoke tests automatiques (script /usr/local/bin/post_deploy_check.sh).",
                     "Vérification SSL valide (curl -I https://...).",
                     "Login admin + 1 transaction E2E.",
                     "Lecture logs sur 30 min (zéro erreur 5xx).",
                     "Vérification métriques Prometheus (latence, throughput)."]},
        {"title": "6. Rollback plan",
         "bullets": ["Trigger : > 5 % d'erreurs 5xx sur 5 min OU regression critique.",
                     "Étape 1 : git checkout previous tag + pip install + pm2 restart.",
                     "Étape 2 : restore frontend dist depuis snapshot.",
                     "Étape 3 : nginx reload.",
                     "Étape 4 : (si nécessaire) restore MongoDB depuis backup pré-MEP.",
                     "RTO target : ≤ 15 min."]},
        {"title": "7. Responsabilités",
         "table": {"headers": ["Rôle", "Mission"],
                   "rows": [["CTO", "Décision Go/Rollback finale"],
                            ["Lead SRE", "Exécution technique"],
                            ["PO", "Validation fonctionnelle post-MEP"],
                            ["Comm", "Annonce utilisateurs"],
                            ["Support", "Monitoring tickets entrants"]]}}])
    return save(doc, "07_Deploiement_PlanMEP.docx")


def doc_7_2_runbook():
    doc = _generic_doc("Runbook d'exploitation",
                       "SendFloo — Procédures opérationnelles techniques quotidiennes",
                       "SF-DEP-RUN-002",
                       [
        {"title": "1. Démarrage / arrêt services",
         "bullets": ["pm2 start sendbid-backend (démarrer)",
                     "pm2 restart sendbid-backend (redémarrer)",
                     "pm2 stop sendbid-backend (arrêter)",
                     "systemctl restart nginx (recharger nginx)",
                     "systemctl restart mongod (redémarrer mongo)"]},
        {"title": "2. Supervision",
         "bullets": ["pm2 list : statut process",
                     "pm2 logs sendbid-backend : tail logs",
                     "tail -f /var/log/nginx/access.log : trafic temps réel",
                     "tail -f /var/log/nginx/error.log : erreurs nginx",
                     "mongosh --eval 'db.stats()' : santé MongoDB"]},
        {"title": "3. Contrôles quotidiens",
         "bullets": ["Vérifier backup MongoDB du jour (cat /var/log/mongo_backup.log | tail).",
                     "Vérifier certificats SSL (certbot certificates).",
                     "Vérifier fail2ban (fail2ban-client status).",
                     "Vérifier disque libre > 30 % (df -h).",
                     "Vérifier mémoire libre > 1 GB (free -h)."]},
        {"title": "4. Gestion des erreurs courantes",
         "table": {"headers": ["Symptôme", "Action"],
                   "rows": [["502 Bad Gateway", "pm2 restart sendbid-backend"],
                            ["MongoDB connection refused", "systemctl restart mongod"],
                            ["SSL expired", "certbot renew"],
                            ["Disk 90 % full", "Cleanup logs + rotate"],
                            ["High CPU", "Vérifier processus + restart si fuite"]]}},
        {"title": "5. Redémarrage services",
         "bullets": ["Backend : pm2 restart sendbid-backend (zero-downtime cluster mode en Y2).",
                     "Nginx : systemctl reload nginx (graceful, sans coupure).",
                     "MongoDB : éviter restart en prod (risque downtime), préférer replica set en Y2."]},
        {"title": "6. Contacts d'escalade",
         "table": {"headers": ["Niveau", "Personne", "Délai"],
                   "rows": [["N1 (24/7)", "On-call rotation", "≤ 5 min"],
                            ["N2 technique", "Lead SRE", "≤ 30 min"],
                            ["N3 architecture", "CTO", "≤ 2h"],
                            ["N4 crise", "CEO", "Immédiat"]]}},
        {"title": "7. Incidents fréquents et fixes",
         "bullets": ["Bug 'colors is not defined' : revoir migration dark mode (cf seed.py).",
                     "OTP non reçu : vérifier Twilio quota + balance.",
                     "Stripe webhook 401 : régénérer webhook secret.",
                     "WebSocket déconnecte : check nginx timeout + keepalive."]}])
    return save(doc, "07_Deploiement_Runbook.docx")


def doc_7_3_monitoring():
    doc = _generic_doc("Plan de monitoring et alerting",
                       "SendFloo — Indicateurs supervisés, seuils, astreinte",
                       "SF-DEP-MON-003",
                       [
        {"title": "1. Indicateurs supervisés",
         "table": {"headers": ["Métrique", "Source", "Seuil normal"],
                   "rows": [["Latence API p95", "Prometheus", "< 500 ms"],
                            ["Taux d'erreur 5xx", "Nginx logs", "< 0,5 %"],
                            ["CPU backend", "node_exporter", "< 70 %"],
                            ["RAM backend", "node_exporter", "< 80 %"],
                            ["Disque libre", "node_exporter", "> 30 %"],
                            ["MongoDB connexions", "mongo_exporter", "< 80 % pool"],
                            ["WebSocket actives", "Custom", "Selon courbe normale"],
                            ["Transferts/min", "Custom", "Selon courbe normale"]]}},
        {"title": "2. Seuils d'alerte",
         "bullets": ["Latence API p95 > 1s → alerte Slack #ops-alerts.",
                     "Taux 5xx > 2 % sur 5 min → alerte critique + on-call.",
                     "CPU > 90 % > 5 min → alerte.",
                     "Disque < 20 % → alerte critique.",
                     "Certbot expire < 30 jours → alerte.",
                     "Backup MongoDB échoue → alerte critique."]},
        {"title": "3. Canaux de notification",
         "bullets": ["Slack #ops-alerts (canal dédié).",
                     "PagerDuty (V2) pour on-call critique.",
                     "Email pour récap quotidien.",
                     "SMS aux 3 personnes d'astreinte pour critique."]},
        {"title": "4. Astreinte",
         "bullets": ["Rotation hebdo entre 3 personnes (CTO + lead SRE + lead dev).",
                     "Engagement : réponse en < 15 min 24/7.",
                     "Compensation : prime mensuelle 200 € + jour off par incident résolu."]},
        {"title": "5. Priorisation des incidents",
         "table": {"headers": ["Sévérité", "Description", "Délai prise en charge"],
                   "rows": [["S1 — Critique", "Service indisponible OU perte de fonds", "≤ 15 min"],
                            ["S2 — Élevé", "Dégradation importante (latence, errors)", "≤ 1h"],
                            ["S3 — Moyen", "Bug fonctionnel non bloquant", "≤ 1 jour ouvré"],
                            ["S4 — Mineur", "Cosmétique, documentation", "Sprint suivant"]]}}])
    return save(doc, "07_Deploiement_MonitoringAlerting.docx")


def doc_8_1_schema_comptable():
    doc = _generic_doc("Schéma comptable du service",
                       "SendFloo — Traduction comptable des flux financiers",
                       "SF-FIN-COMP-001",
                       [
        {"title": "1. Événements comptables",
         "bullets": ["Recharge wallet (entrée fonds plate-forme).",
                     "Démarrage transfert (réservation, statut BIDDING).",
                     "Sélection agent (validation, statut AGENT_ASSIGNED).",
                     "Remise au bénéficiaire (sortie fonds, statut COMPLETED).",
                     "Annulation (libération réservation + refund).",
                     "Commission agent (charge plate-forme).",
                     "Override super-agent (charge plate-forme).",
                     "Frais Stripe / PayPal (charge plate-forme)."]},
        {"title": "2. Écritures par statut",
         "table": {"headers": ["Statut", "Débit", "Crédit", "Compte tiers"],
                   "rows": [["Recharge OK", "Banque (compte plate-forme)", "Wallet client", "—"],
                            ["BIDDING", "Wallet client", "Wallet réservé", "—"],
                            ["COMPLETED", "Wallet réservé", "Compte agent + frais SendFloo", "Agent"],
                            ["CANCELLED (avant remise)", "Wallet réservé", "Wallet client", "—"],
                            ["Commission agent", "Compte agent", "Banque (sortie)", "Agent"]]}},
        {"title": "3. Comptes utilisés (plan comptable simplifié)",
         "table": {"headers": ["N°", "Libellé", "Type"],
                   "rows": [["512100", "Banque SendFloo EUR", "Actif"],
                            ["512200", "Banque SendFloo XAF", "Actif"],
                            ["467100", "Wallets clients", "Passif"],
                            ["467110", "Wallets réservés (transferts en cours)", "Passif"],
                            ["467200", "Comptes agents (à payer)", "Passif"],
                            ["706000", "CA frais plate-forme", "Produits"],
                            ["706100", "CA spread FX", "Produits"],
                            ["622000", "Frais Stripe / PayPal", "Charges"],
                            ["622100", "Frais Twilio / SendGrid", "Charges"]]}},
        {"title": "4. Commissions",
         "bullets": ["Commission agent : crédit immédiat sur compte agent dès COMPLETED.",
                     "Override super-agent : calcul mensuel J+5.",
                     "Pas de retenue (transparent 100 % de l'enchère)."]},
        {"title": "5. Remboursements",
         "bullets": ["Refund partiel (annulation post-BIDDING) : 70 % crédit wallet, 30 % retenu en frais plate-forme.",
                     "Refund total (expiration ou bug) : 100 % crédit wallet.",
                     "Refund vers carte (3-7j ouvrés) : opération à faire via dashboard Stripe."]},
        {"title": "6. Suspens et écarts",
         "bullets": ["Tout écart > 1 € entre balance wallet et somme transactions = ticket compliance.",
                     "Tout transfert en suspens > 7 jours = revue manuelle.",
                     "Tout refund non aboutie > 14 jours = remontée direction finance."]}])
    return save(doc, "08_Financier_SchemaComptable.docx")


def doc_8_2_reconciliation():
    doc = _generic_doc("Procédure de rapprochement / réconciliation",
                       "SendFloo — Contrôle des flux financiers",
                       "SF-FIN-REC-002",
                       [
        {"title": "1. Rapprochement transactions / encaissements / paiements / commissions",
         "bullets": ["Vérification quotidienne : somme des recharges wallet = somme des entrées bancaires plate-forme.",
                     "Vérification quotidienne : somme des transferts COMPLETED = somme des sorties wallets - commissions.",
                     "Vérification quotidienne : commissions dues agents = balance des comptes agents.",
                     "Vérification hebdomadaire : frais SendFloo (CA 706000) = revenus comptabilisés sur la période."]},
        {"title": "2. Fréquence",
         "bullets": ["Quotidienne : cron 02h00 UTC + alerte si écart > 5 €.",
                     "Hebdomadaire : revue manuelle finance.",
                     "Mensuelle : clôture comptable + reporting Board.",
                     "Annuelle : audit externe."]},
        {"title": "3. Sources de données",
         "bullets": ["MongoDB : wallets, wallet_transactions, transfers, agents.",
                     "Stripe Dashboard : charges, refunds, balances.",
                     "PayPal Dashboard : transactions.",
                     "Mobile Money APIs : reporting (CSV téléchargeable).",
                     "Banque plate-forme : relevés bancaires (CAMT.053)."]},
        {"title": "4. Gestion des écarts",
         "bullets": ["Écart < 1 € : ignoré (arrondis FX).",
                     "Écart 1-10 € : ticket pour investigation J+1.",
                     "Écart > 10 € : alerte critique + escalade compliance.",
                     "Écart > 100 € : escalade direction finance + audit log + post-mortem."]},
        {"title": "5. Responsabilités",
         "table": {"headers": ["Rôle", "Mission"],
                   "rows": [["Système (cron)", "Réconciliation quotidienne automatique"],
                            ["Finance Officer", "Revue quotidienne des alertes + hebdo manuelle"],
                            ["Head Finance", "Clôture mensuelle + reporting Board"],
                            ["Auditeur externe", "Validation annuelle"]]}},
        {"title": "6. Délais de correction",
         "bullets": ["Écart 1-10 € : J+5 ouvrés.",
                     "Écart > 10 € : J+2 ouvrés.",
                     "Écart > 100 € : J+1 ouvré (priorité absolue)."]}])
    return save(doc, "08_Financier_ProcedureReconciliation.docx")


def doc_8_3_commissionnement():
    doc = _generic_doc("Politique de commissionnement",
                       "SendFloo — Rémunération agents et super-agents",
                       "SF-FIN-COM-003",
                       [
        {"title": "1. Mode de calcul",
         "bullets": ["Commission agent = bid_taux × montant transfert (taux issu de l'enchère gagnée).",
                     "Override super-agent = 10 % du volume des agents enfants (paramétrable).",
                     "Aucune retenue plate-forme sur la commission agent.",
                     "Paiement net (TVA appliquée si applicable selon statut fiscal agent)."]},
        {"title": "2. Conditions d'éligibilité",
         "bullets": ["Agent : status=approved + KYC pro Tier 2+ + au moins 1 transfert COMPLETED.",
                     "Super-agent : status=approved + au moins 3 agents enfants actifs.",
                     "Programme fidélité : Silver (par défaut), Gold (50+ transferts + note ≥ 4,5), Platinum (200+ + note ≥ 4,7)."]},
        {"title": "3. Périodicité",
         "bullets": ["Agent : settlement à la demande (hebdo ou bi-mensuel), minimum 50 € accumulés.",
                     "Super-agent : versement mensuel J+5 (override calculé sur le mois précédent)."]},
        {"title": "4. Retenues éventuelles",
         "bullets": ["TVA si agent assujetti (à déclarer dans son profil).",
                     "Retenue sur litige en cours : montant gelé jusqu'à arbitrage.",
                     "Retenue pour pénalité (manquement SOP grave) : sur décision compliance, max 30 %."]},
        {"title": "5. Cas de litige",
         "bullets": ["L'agent peut contester un calcul de commission dans les 30 jours.",
                     "Investigation par finance + compliance sous 7 jours ouvrés.",
                     "Décision finale par Head of Finance.",
                     "Si bonne foi établie : régularisation immédiate + geste commercial."]},
        {"title": "6. Validation",
         "bullets": ["Calcul automatique via service backend (run quotidien).",
                     "Validation finance hebdo (échantillonnage).",
                     "Audit annuel obligatoire.",
                     "Communication mensuelle aux agents (récap commissions + override)."]}])
    return save(doc, "08_Financier_PolitiqueCommissionnement.docx")


# Run all
if __name__ == "__main__":
    print("=== Génération partie 2 (3.2 → 8.3) ===")
    doc_3_2_archi_appli()
    doc_3_3_specs_api()
    doc_3_4_dictionnaire_donnees()
    doc_3_5_securite()
    doc_4_1_sop()
    doc_4_2_manuel_agent()
    doc_4_3_support()
    doc_4_4_continuite()
    doc_5_1_kyc_aml()
    doc_5_2_risques()
    doc_5_3_fraude()
    doc_5_4_contrats()
    doc_5_5_donnees()
    doc_6_1_strategie_tests()
    doc_6_2_cahier_tests()
    doc_6_3_pv_uat()
    doc_7_1_plan_deploiement()
    doc_7_2_runbook()
    doc_7_3_monitoring()
    doc_8_1_schema_comptable()
    doc_8_2_reconciliation()
    doc_8_3_commissionnement()
    print("✅ Partie 2 terminée.")
