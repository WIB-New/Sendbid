# SENDBID — App Mobile Client (PRD)

## Vision
Application mobile React Native Expo pour les transferts d'argent internationaux SENDBID, mettant en relation les clients (expéditeurs) avec un réseau d'agents (payeurs) via un système d'enchères temps réel.

## Stack
- **Frontend**: React Native Expo SDK 54, Expo Router (file-based routing), Zustand, Plus Jakarta Sans, react-native-qrcode-svg, expo-linear-gradient, expo-local-authentication, expo-secure-store
- **Backend**: FastAPI **modulaire** (10 routers + core/) + MongoDB + WebSocket (uvicorn)
- **Sécurité**: JWT, bcrypt password+PIN, HMAC-SHA256 QR signing, brute force PIN lockout, weak PIN rejection, P2P atomique, WebSocket auth, CORS strict en prod via `ALLOWED_ORIGINS`

## Architecture backend (refactorée)
```
/app/backend/
├── server.py         # entry point (assemblage app + middlewares + routers)
├── seed.py           # admin/demo/agents idempotents
├── core/
│   ├── config.py     # env + IS_PROD + ALLOWED_ORIGINS
│   ├── db.py         # Mongo client + helpers (now_utc, iso, clean_doc)
│   ├── security.py   # password, PIN (incl. is_weak_pin), JWT, QR HMAC
│   ├── deps.py       # get_current_user, get_user_from_token (WS), require_pin
│   └── manager.py    # WebSocket ConnectionManager singleton
└── routers/
    ├── auth.py            # register, OTP, login, biometric, PIN, forgot/reset
    ├── wallet.py          # balance, recharge QR, withdraw QR, P2P atomique
    ├── transfers.py       # 4 étapes + auction WebSocket + reçu PDF
    ├── chat.py            # 3-party chat (sender/agent/beneficiary)
    ├── beneficiaries.py   # CRUD max 100
    ├── payment_methods.py # card/Apple/Google Pay/PayPal/MoMo
    ├── kyc.py             # tier 1 form + tier 2 Didit mock
    ├── notifications.py
    ├── profile.py         # PATCH preferences + change-password
    └── misc.py            # referral, loyalty, scheduled, disputes, documents, support, countries
```

## Écrans frontend (50)
1. **Onboarding & Auth (10)** : Splash, 4 onboarding, Welcome, Login (biométrie verte), SignUp, OTP 3min, Create PIN (rejet faibles), Forgot/Reset 10min
2. **Tabs (4)** : Home Dashboard, Transfers list, Wallet, Profile
3. **Transfer Flow (8)** : new → details → recap (PIN) → success (code 10 chiffres + QR HMAC) → auction WebSocket 90s → agent assigned → map multi-modes → chat 3 parties → [id] détails + reçu PDF
4. **Wallet (3)** : Recharge QR, Withdraw QR (PIN), P2P (PIN)
5. **Profile (1)** + **Settings** + **Beneficiaries (max 100)** + **Payment Methods**
6. **KYC (3)** : Tier 1 form, Tier 2 Didit WebView mock, Status badges
7. **Modules (7)** : Notifications, Referral, Support+FAQ, Loyalty, Scheduled, Disputes, Documents

## Règles critiques implémentées (toutes validées par tests)
- ✅ Code retrait 10 chiffres généré côté serveur
- ✅ QR signé HMAC-SHA256, validité 48h
- ✅ Chat room ouverte AGENT_ASSIGNED, fermée COMPLETED
- ✅ Recharge/retrait espèces uniquement via QR chez l'agent
- ✅ PIN 6 chiffres requis : transfert, retrait, P2P
- ✅ Bouton biométrique vert sous "Se connecter"
- ✅ Compteur 3 minutes OTP (email+SMS)
- ✅ Lien email forgot-password 10 minutes

## Sécurité ajoutée (Phase 2)
- ✅ `dev_email_otp` / `dev_phone_otp` / `dev_reset_token` gatés par `ENVIRONMENT=development`
- ✅ Rejet PIN faibles : tous identiques (000000), séquentiels (123456, 654321), patterns communs (112233, 121212, 123123, 789456…)
- ✅ Password length ≥ 8 sur register, reset-password, change-password
- ✅ P2P atomique via `find_one_and_update` conditionnel (`balance >= amount`)
- ✅ WebSocket `?token=<jwt>` optionnel : token invalide → close 4401, transfer non-owné → close 4403
- ✅ CORS configurable via `ALLOWED_ORIGINS` (dev=`*`, prod=liste explicite)
- ✅ Brute force PIN : 5 essais → lockout 15 min (HTTP 423)

## Tests
- Phase 1 (initial backend): **37/37 PASS**
- Phase 2 (refactor + sécurité): **50/50 PASS** (37 régressions + 13 sécurité)
- Phase 3 (frontend E2E): **~93%** initial, puis **100%** sur le bug HIGH critique (success → auction) après application du pattern `hadDraftRef` sentinel + suppression de `clearDraft` du goNext

## Comptes démo (`/app/memory/test_credentials.md`)
- Client : `client@sendbid.app` / `Client@123!` / PIN `123456` / Solde 1250.50€
- Admin : `admin@sendbid.app` / `Admin@123!`

## Mocks (à brancher en prod)
OTP email/SMS (DEV only), reset password (DEV only), Didit KYC, Apple/Google Pay/PayPal/MoMo (UI), Stripe, Google Maps, FCM push, agents seedés.

## Innovation business
**Système d'enchères inversé** unique : agents se concurrencent en temps réel sur les frais (1-5%), réduit les coûts client + accélère la remise. Combiné avec parrainage (+5€/filleul) et fidélité multi-tier (Bronze→Platinum).
