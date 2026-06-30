# SENDBID — Test Credentials

## Demo Client (use this to test the app)
- Email: `demo@sendbid.com`
- Phone: `+33612345678`
- Password: `Demo@2026!`
- PIN (6 digits): `1234`
- Profile ID: `SB100001`
- KYC Tier: 1 (Silver)
- Wallet balance: 1250.50 EUR

## Admin
- Email: `admin@sendbid.com`
- Password: `Admin@2026!`
- PIN: `123456`

## Notes
- ENVIRONMENT={development|production} controls whether `dev_email_otp`, `dev_phone_otp`, `dev_reset_token` fields are exposed in API responses.
- Withdrawal codes are 10-digit numeric, server-generated.
- QR codes are HMAC-SHA256 signed and valid 48h.
- WebSocket: `ws://<host>/api/ws/auction/{transfer_id}?token=<jwt>` (token optional in dev, recommended in prod).
- PIN brute-force lockout: 5 wrong attempts → 15 min lock (HTTP 423).
- Weak PIN rejection on /auth/create-pin: blocks 000000, 123456, sequential, repeated, common PINs.
- Demo PINs (123456) are pre-seeded directly in DB and are NOT subject to weak-PIN check.
