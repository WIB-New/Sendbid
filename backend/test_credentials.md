# SENDBID — Test Credentials

> Les valeurs ci-dessous sont des exemples. Les credentials réels du compte demo proviennent des variables d'environnement `DEMO_CLIENT_EMAIL`, `DEMO_CLIENT_PASSWORD`, `DEMO_CLIENT_PIN` (voir `.env`). En l'absence de surcharge, les comptes seedés utilisent les valeurs ci-dessous.

## Demo Client
- Email: `client@sendbid.app`
- Phone: `+33612345678`
- Password: `Client@123!`
- PIN (6 digits): `123456`
- Profile ID: `SB100001`
- KYC Tier: 1 (Silver)
- Wallet balance: 1250.50 EUR

## Admin / Super-Admin (web panel)
- Email: `superadmin@sendbid.app`
- Password: `SuperAdmin@123!`
- PIN: `123456`
- Rôle: super_admin

> Le compte défini par `ADMIN_EMAIL` / `ADMIN_PASSWORD` dans le `.env` est créé au premier démarrage. S'il correspond à `SUPER_ADMIN_EMAIL`, il aura le rôle `super_admin`.

## Autres comptes de démonstration seedés
| Rôle | Email | Mot de passe | PIN |
|------|-------|--------------|-----|
| Admin panel | `admin@sendbid.app` | `Admin@SendBID2026!` | `000000` |
| Agent SendBID | `agent@sendbid.app` | `Agent@SendBID2026!` | `000000` |
| Partenaire | `partner@sendbid.app` | `Partner@123!` | `000000` |
| Super-Agent | `superagent@sendbid.app` | `Super@123!` | `000000` |
| Agent PayBID | `agent@paybid.app` | `Agent@123!` | `123456` |

## Notes
- `ENVIRONMENT={development|production}` contrôle l'affichage des champs `dev_email_otp`, `dev_phone_otp`, `dev_reset_token` dans les réponses API.
- Les codes de retrait sont numériques à 10 chiffres, générés par le serveur, valables 48h.
- Les QR codes sont signés HMAC-SHA256 et valables 48h.
- WebSocket: `ws://<host>/api/ws/auction/{transfer_id}?token=<jwt>` (token optionnel en dev, recommandé en prod).
- Verrouillage PIN : 5 tentatives erronées → 15 min de blocage (HTTP 423).
- `/auth/create-pin` refuse les PIN faibles (`000000`, `123456`, séquentiels, répétés, communs).
- Les PIN de démonstration seedés (`123456`) ne sont pas soumis à la vérification de robustesse.
