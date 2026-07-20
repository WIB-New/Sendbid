# Audit fonctionnel — Projet SendBID / PayBID

> Date : 20 juillet 2026  
> Périmètre : frontend Expo (sendbid) + backend FastAPI  
> Objectif : récapituler ce qui est implémenté et fonctionnel, séparément pour SendBID (client) et PayBID (agent).

---

## 1. Vue d'ensemble

L'application est une **super-app financière** avec deux variantes (même codebase Expo) :

- **`sendbid`** : application client (envoi d'argent, recharge, retrait, transferts, enchères, profil).
- **`paybid`** : application agent (cash-in, cash-out, scan QR, gestion de la caisse/flottante).

Le backend est en **FastAPI**, avec une base **MongoDB** (via `core.db`).

---

## 2. SendBID — Application client

### 2.1 Authentification & onboarding

| Fonctionnalité | État | Détails |
| --- | --- | --- |
| Inscription email + téléphone + pays | ✅ | `sendbid/app/(auth)/signup.tsx` + `backend/routers/auth/core.py::register` |
| Validation OTP email + téléphone | ✅ | Codes générés côté backend, envoyés par Twilio (SMS) / SendGrid (email) ; codes visibles en dev |
| Login email / téléphone / profile_id | ✅ | `backend/routers/auth/core.py::login` |
| Création de PIN à 6 chiffres | ✅ | Obligatoire après inscription, gating via `_layout.tsx` |
| Authentification biométrique | ⚠️ Partiel | Champ présent côté backend (`biometric_enabled`), activation UI non auditée |
| Rôles et variante `sendbid` | ✅ | `EXPO_PUBLIC_APP_VARIANT=sendbid` |

### 2.2 Portefeuille (Wallet)

| Fonctionnalité | État | Détails |
| --- | --- | --- |
| Affichage du solde + devise locale | ✅ | Basé sur `user.country` et `wallet.currency` |
| Historique des transactions | ✅ | Onglet wallet |
| Sessions actives | ✅ | Backend `routers/sessions.py` |

### 2.3 Recharge

| Méthode | État | Détails |
| --- | --- | --- |
| **Carte bancaire (Stripe)** | ⚠️ Connecté mais clé API requise | `backend/services/payments.py` utilise `STRIPE_API_KEY`. Sans clé : erreur "non configuré". |
| **PayPal** | ⚠️ Connecté mais clés requises | `backend/routers/paypal.py` utilise `PAYPAL_CLIENT_ID` + `PAYPAL_SECRET`. Sans clés : erreur "PayPal non configuré". |
| **Portefeuille mobile (MoMo)** | ✅ Lié | Forçage de la sélection d'un compte lié dans `sendbid/app/wallet/recharge.tsx` |
| **Espèces** | ✅ | Génération de QR code côté agent PayBID |

**Améliorations récentes :**
- Le rechargement par **Mobile Money** et **PayPal** force désormais la sélection d'un compte lié.
- Le libellé "Mobile Money" a été renommé en **"Portefeuille mobile"**.
- Si aucun compte n'est lié, l'utilisateur est invité à aller dans **Profil → Comptes liés**.

### 2.4 Retrait

| Méthode | État | Détails |
| --- | --- | --- |
| **Espèces (QR chez un agent)** | ✅ | `backend/routers/wallet/withdraw.py` génère un QR code, validé par un agent PayBID |
| **Virement bancaire** | ✅ | Nécessite un compte bancaire lié |
| **Portefeuille mobile** | ✅ | Nécessite un compte MoMo lié |
| **PayPal** | ✅ | Nécessite un compte PayPal lié |

**Améliorations récentes :**
- Sélection obligatoire d'un compte lié pour **banque**, **MoMo**, **PayPal**.
- Pré-sélection automatique du premier compte actif correspondant.
- Suppression de la saisie manuelle.
- Renommage de "Mobile" en **"Portefeuille mobile"**.
- Tous les pays disposent désormais des 4 méthodes de retrait (après modification de `sendbid/src/currency.ts`).

### 2.5 Comptes liés

| Fonctionnalité | État | Fichiers |
| --- | --- | --- |
| CRUD comptes bancaires / MoMo / PayPal | ✅ | `sendbid/app/wallet/linked-accounts.tsx` |
| API backend dédiée | ✅ | `backend/routers/wallet/linked_accounts.py` |
| Validation automatique (format IBAN, email, téléphone) | ✅ | Endpoint `/linked-accounts/{id}/verify` |
| Liste de banques par pays | ✅ | `sendbid/src/currency.ts` |
| Liste d'opérateurs MoMo par pays | ✅ | `sendbid/src/currency.ts` |
| Évitement des doublons actifs | ✅ | Vérifié côté backend |

### 2.6 Transferts et bénéficiaires

| Fonctionnalité | État | Détails |
| --- | --- | --- |
| Envoi à un autre utilisateur SendBID | ✅ | `sendbid/app/transfer/new.tsx` |
| Liste de bénéficiaires | ✅ | `sendbid/app/beneficiaries.tsx` |
| Envoi à un agent (cash-out) | ✅ | Via retrait espèces |

### 2.7 Profil & paramètres

| Fonctionnalité | État | Détails |
| --- | --- | --- |
| Modification des informations personnelles | ✅ | `sendbid/app/personal-info.tsx` |
| Changement de langue | ✅ | i18n : FR, EN, ES, DE, IT, PT, AR |
| Gestion des comptes liés | ✅ | `sendbid/app/wallet/linked-accounts.tsx` |
| Notifications push | ⚠️ Présent | Gestion dans `_layout.tsx` |

### 2.8 Gestion des erreurs API

- Fonction `apiError()` améliorée dans `sendbid/src/api.ts` et `sendbid/src/src/api.ts`.
- Priorité donnée au message exact du backend.
- Fallbacks par code HTTP (400, 401, 403, 404, 422, 429, 500, 503).
- L'erreur "Email ou mot de passe incorrect" a été corrigée : le backend retourne maintenant un message explicite pour un PIN incorrect ou une session invalide.

---

## 3. PayBID — Application agent

### 3.1 Authentification

| Fonctionnalité | État | Détails |
| --- | --- | --- |
| Login agent | ✅ | `sendbid/app/paybid/login.tsx` |
| Signup agent | ✅ | `sendbid/app/paybid/signup.tsx` |
| PIN agent | ✅ | Même mécanisme que le client |
| Variante `paybid` | ✅ | `EXPO_PUBLIC_APP_VARIANT=paybid` |

### 3.2 Tableau de bord agent

| Fonctionnalité | État | Détails |
| --- | --- | --- |
| Solde de caisse (float) | ✅ | Onglet `Float` |
| Historique des mouvements | ✅ | `sendbid/app/paybid/movements.tsx` |
| Statistiques | ✅ | Onglet `account.tsx` |

### 3.3 Opérations de caisse

| Fonctionnalité | État | Détails |
| --- | --- | --- |
| **Cash-in** (dépôt espèces → wallet client) | ✅ | `sendbid/app/paybid/cash-recharge.tsx` |
| **Cash-out** (retrait espèces depuis wallet client) | ✅ | Scan du QR de retrait généré par le client |
| **Scan QR** | ✅ | `sendbid/app/paybid/scan.tsx` |
| Gestion de la caisse (float) | ✅ | `sendbid/app/paybid/float.tsx` |
| Opérations d'agence | ✅ | `sendbid/app/paybid/agency-ops.tsx` |

### 3.4 Transferts inter-agents

| Fonctionnalité | État | Détails |
| --- | --- | --- |
| Transferts entre agents | ✅ | `sendbid/app/paybid/transfer/` |

---

## 4. Backend FastAPI

### 4.1 Authentification

| Module | État | Détails |
| --- | --- | --- |
| Register / Login / Me / UpdateMe | ✅ | `backend/routers/auth/core.py` |
| PIN hash + vérification (`require_pin`) | ✅ | `backend/core/security.py` + brute-force lockout |
| JWT Bearer token | ✅ | `backend/core/deps.py` |
| OTP email/téléphone | ✅ | `backend/routers/auth/otp.py` + `services/notify.py` |
| Sessions actives | ✅ | `backend/routers/sessions.py` |

### 4.2 Wallet

| Module | État | Détails |
| --- | --- | --- |
| Solde et transactions | ✅ | `backend/routers/wallet/` |
| Retrait QR (cash-out agent) | ✅ | `backend/routers/wallet/withdraw.py` |
| Recharge espèces | ✅ | `backend/routers/wallet/recharge.py` |
| Comptes liés | ✅ | `backend/routers/wallet/linked_accounts.py` |

### 4.3 Paiements externes

| Module | État | Détails |
| --- | --- | --- |
| **Stripe** | ⚠️ Intégré, clé requise | `backend/services/payments.py` — checkout + webhook |
| **PayPal** | ⚠️ Intégré, clés requises | `backend/routers/paypal.py` — order + capture |
| Conversion de devises | ✅ | Packages convertis dans la devise locale du pays |

### 4.4 Admin / Monitoring

| Module | État | Détails |
| --- | --- | --- |
| Panel web admin | ✅ | `backend/routers/web_panels/admin.py` + `backend/templates/panels/admin.html` |
| Transactions, utilisateurs, KYC | ✅ | Lecture depuis MongoDB |

---

## 5. Internationalisation

- Langues supportées : **FR, EN, ES, DE, IT, PT, AR**.
- Fichiers de traduction dans `sendbid/src/i18n/`.
- Les nouvelles clés liées aux erreurs API, comptes liés et retrait/recharge ont été ajoutées.

---

## 6. Devises et pays

| Pays | Devise | MoMo | Banque | PayPal | Cash |
| --- | --- | --- | --- | --- | --- |
| Cameroun | XAF | ✅ | ✅ | ✅ | ✅ |
| Sénégal | XOF | ✅ | ✅ | ✅ | ✅ |
| Côte d'Ivoire | XOF | ✅ | ✅ | ✅ | ✅ |
| France | EUR | ✅ (Lydia/PayLib) | ✅ | ✅ | ✅ |
| Belgique | EUR | ✅ (Payconiq) | ✅ | ✅ | ✅ |
| Allemagne | EUR | ✅ (N26/Klarna) | ✅ | ✅ | ✅ |
| Espagne | EUR | ✅ (Bizum) | ✅ | ✅ | ✅ |
| Italie | EUR | ✅ (Satispay) | ✅ | ✅ | ✅ |
| Suisse | CHF | ✅ (TWINT) | ✅ | ✅ | ✅ |
| Royaume-Uni | GBP | ✅ (Monzo/Revolut) | ✅ | ✅ | ✅ |
| États-Unis | USD | ✅ (Venmo/Zelle/Cash App) | ✅ | ✅ | ✅ |
| Canada | CAD | ✅ (Interac e-Transfer) | ✅ | ✅ | ✅ |
| Maroc | MAD | ✅ | ✅ | ✅ | ✅ |
| Tunisie | TND | ✅ | ✅ | ✅ | ✅ |
| Algérie | DZD | ✅ | ✅ | ✅ | ✅ |
| Congo, Gabon, Tchad, Mali, Burkina Faso, Togo, Bénin, Niger, RDC, Guinée, Madagascar | — | ✅ | ✅ | ✅ | ✅ |

---

## 7. Fichiers créés ou modifiés récemment

### Créés
- `sendbid/app/wallet/linked-accounts.tsx` — gestion des comptes liés (client).
- `backend/routers/wallet/linked_accounts.py` — API backend des comptes liés.
- `sendbid/services/` — services auxiliaires.

### Modifiés
- `sendbid/src/api.ts` + `sendbid/src/src/api.ts` — meilleure gestion des erreurs API.
- `sendbid/app/wallet/recharge.tsx` — forçage compte lié pour MoMo/PayPal.
- `sendbid/app/wallet/withdraw.tsx` — forçage compte lié pour banque/MoMo/PayPal.
- `sendbid/src/currency.ts` — activation de toutes les méthodes pour tous les pays.
- `backend/routers/auth/core.py` — registration OTP, `has_pin`, normalisation pays.
- `sendbid/src/i18n/*.ts` — nouvelles traductions.
- `sendbid/app/beneficiaries.tsx`, `sendbid/app/transfer/new.tsx`, `sendbid/app/personal-info.tsx` — corrections mineures.
- `backend/routers/payments.py`, `backend/routers/wallet/__init__.py` — intégration des packages et comptes liés.
- `backend/routers/web_panels/admin.py` + `backend/templates/panels/admin.html` — panel admin.

---

## 8. APIs externes — État de connexion

| API | Intégration | Configuration requise | État sans clé |
| --- | --- | --- | --- |
| **Stripe** | Checkout + PaymentSheet | `STRIPE_API_KEY` | "STRIPE_API_KEY is not configured" |
| **PayPal** | Orders v2 + Payouts | `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_MODE` | "PayPal non configuré" |
| **Twilio** | Validation téléphone + SMS OTP | Clés Twilio dans l'environnement | Lookup/SMS désactivé en fallback |
| **SendGrid** | Email OTP | Clé SendGrid | Email OTP simulé en dev |

> **Conclusion APIs** : les routes et la logique sont connectées, mais elles nécessitent des **clés d'API valides** dans les variables d'environnement du backend pour fonctionner en production ou en test.

---

## 9. Points de vigilance / À tester

1. **Vérifier les clés API** Stripe / PayPal / Twilio / SendGrid dans le `.env` backend.
2. **Tester un retrait avec PIN correct** (`demo@sendbid.com` / PIN `123456`) pour valider le nouveau message d'erreur.
3. **Tester un retrait avec un compte lié** pour chaque méthode (bank, momo, paypal).
4. **Vérifier l'affichage des opérateurs MoMo** en France / Canada / USA.
5. **Compiler TypeScript** : `tsc --noEmit` passe actuellement.
6. **Tester l'ajout d'un compte lié** et sa vérification automatique.
7. **Panel admin** : s'assurer que l'URL `/admin` est accessible et protégée.

---

## 10. Résumé exécutif

- **SendBID client** : recharge/retrait par comptes liés fonctionnel, internationalisation OK, gestion d'erreurs améliorée.
- **PayBID agent** : cash-in/cash-out/scan/float fonctionnels.
- **Backend** : auth, wallet, comptes liés, Stripe, PayPal, admin — tous implémentés.
- **Bloquant actuel** : les paiements Stripe/PayPal nécessitent des clés API ; sans elles, seuls les paiements en espèces et par comptes liés backend fonctionnent.
