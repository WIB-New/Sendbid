"""Database seed: admin, demo client, agents. Idempotent."""
import logging
import os
import random
from datetime import timedelta
from pathlib import Path

from core.config import (
    ADMIN_EMAIL, ADMIN_PASSWORD,
    SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD,
    DEMO_CLIENT_EMAIL, DEMO_CLIENT_PASSWORD, DEMO_CLIENT_PIN,
)
from core.db import db, now_utc, iso
from core.security import gen_id, hash_password

logger = logging.getLogger("sendbid.seed")

# En production, ne JAMAIS r\u00e9\u00e9crire les passwords/wallets des comptes existants
# (\u00e9vite de remettre les credentials seed apr\u00e8s chaque restart).
IS_PROD = os.environ.get("ENVIRONMENT", "development").lower() == "production"

# Si true, ne crée pas les comptes de démo (Aïcha Demo, agents fictifs, Mamadou Sow PayBID).
# À utiliser en production quand on veut une base propre sans données de test.
# En production (ENVIRONMENT=production), SKIP_DEMO_DATA est true par défaut.
SKIP_DEMO_DATA = os.environ.get("SKIP_DEMO_DATA", "true" if IS_PROD else "false").lower() in ("true", "1", "yes")


async def seed_demo_data():
    # Indexes — on ignore les erreurs si l'index existe déjà avec des doublons
    try:
        await db.users.create_index("email", unique=True)
    except Exception as e:
        logger.warning(f"[seed] index email skipped: {e}")
    try:
        await db.users.create_index("phone")
    except Exception as e:
        logger.warning(f"[seed] index phone skipped: {e}")
    try:
        await db.users.create_index("profile_id")
    except Exception as e:
        logger.warning(f"[seed] index profile_id skipped: {e}")
    try:
        await db.users.create_index("biometric_token")
    except Exception as e:
        logger.warning(f"[seed] index biometric_token skipped: {e}")
    await db.transfers.create_index([("user_id", 1), ("created_at", -1)])
    await db.bids.create_index([("transfer_id", 1), ("bid_fee_percent", 1)])
    await db.beneficiaries.create_index([("user_id", 1)])
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.wallet_tx.create_index([("user_id", 1), ("created_at", -1)])

    # Admin
    if not await db.users.find_one({"email": ADMIN_EMAIL}):
        try:
            await db.users.insert_one({
                "id": gen_id(), "profile_id": "SBADMIN", "email": ADMIN_EMAIL, "phone": "+33000000000",
                "full_name": "Admin SENDBID", "password_hash": hash_password(ADMIN_PASSWORD),
                "pin_hash": hash_password("123456"), "pin_attempts": 0, "pin_locked_until": None,
                "email_verified": True, "phone_verified": True, "kyc_tier": 2, "kyc_status": "verified",
                "loyalty_level": "Platinum", "loyalty_points": 5000,
                "biometric_enabled": False, "biometric_token": None,
                "avatar_url": None, "language": "fr", "theme": "light",
                "notif_prefs": {"push": True, "email": True, "sms": False},
                "role": "admin", "created_at": iso(now_utc()),
            })
        except Exception as e:
            logger.warning(f"[seed] admin insert skipped: {e}")
    elif os.getenv("RESET_ADMIN_PASSWORD", "").lower() == "true":
        await db.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {"password_hash": hash_password(ADMIN_PASSWORD), "role": "admin", "is_admin": True}},
        )
        logger.info("[seed] admin password reset")

    # Extra admin roles (super_admin, partner_admin, super_agent)
    # Le super-admin est configurable via les variables d'environnement SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD
    extra_admins = [
        {"email": SUPER_ADMIN_EMAIL, "pwd": SUPER_ADMIN_PASSWORD, "role": "super_admin", "name": "Super-Admin SENDBID", "pid": "SBSUPER"},
    ]
    if not SKIP_DEMO_DATA:
        extra_admins.extend([
            {"email": "partner@sendbid.app",    "pwd": "Partner@123!",    "role": "partner_admin", "name": "Partenaire Demo",    "pid": "SBPART"},
            {"email": "superagent@sendbid.app", "pwd": "Super@123!",      "role": "super_agent",   "name": "Super-Agent Demo",   "pid": "SBSAGT"},
        ])
    for a in extra_admins:
        existing = await db.users.find_one({"email": a["email"]})
        if not existing:
            try:
                await db.users.insert_one({
                    "id": gen_id(), "profile_id": a["pid"], "email": a["email"], "phone": "+33000000001",
                    "full_name": a["name"], "password_hash": hash_password(a["pwd"]),
                    "pin_hash": hash_password("123456"), "pin_attempts": 0, "pin_locked_until": None,
                    "email_verified": True, "phone_verified": True, "kyc_tier": 2, "kyc_status": "verified",
                    "loyalty_level": "Platinum", "loyalty_points": 0,
                    "biometric_enabled": False, "biometric_token": None,
                    "avatar_url": None, "language": "fr", "theme": "light",
                    "notif_prefs": {"push": True, "email": True, "sms": False},
                    "role": a["role"], "created_at": iso(now_utc()),
                })
            except Exception as e:
                logger.warning(f"[seed] extra admin {a['email']} insert skipped: {e}")
        else:
            # Force role alignment (always safe). Password ONLY in dev to allow rotation in prod.
            update_set = {"role": a["role"]}
            if not IS_PROD:
                update_set["password_hash"] = hash_password(a["pwd"])
            await db.users.update_one(
                {"email": a["email"]},
                {"$set": update_set},
            )

    # Demo client (désactivable en production via SKIP_DEMO_DATA)
    if not SKIP_DEMO_DATA:
        existing_demo = await db.users.find_one({"email": DEMO_CLIENT_EMAIL})
        if not existing_demo:
            demo_id = gen_id()
            await db.users.insert_one({
                "id": demo_id, "profile_id": "SB100001", "email": DEMO_CLIENT_EMAIL,
                "phone": "+33612345678", "full_name": "Aïcha Demo",
                "password_hash": hash_password(DEMO_CLIENT_PASSWORD),
                "pin_hash": hash_password(DEMO_CLIENT_PIN),
                "pin_attempts": 0, "pin_locked_until": None,
                "email_verified": True, "phone_verified": True,
                "kyc_tier": 1, "kyc_status": "verified",
                "loyalty_level": "Silver", "loyalty_points": 250,
                "biometric_enabled": False, "biometric_token": None,
                "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
                "language": "fr", "theme": "light",
                "notif_prefs": {"push": True, "email": True, "sms": False},
                "created_at": iso(now_utc()),
            })
            await db.wallets.insert_one({"id": gen_id(), "user_id": demo_id, "balance": 1250.50, "currency": "EUR", "created_at": iso(now_utc())})
            await db.wallet_tx.insert_many([
                {"id": gen_id(), "user_id": demo_id, "type": "recharge", "amount": 500.0, "currency": "EUR", "counterparty": "Agent Paris 11", "note": "Recharge agent", "created_at": iso(now_utc() - timedelta(days=3))},
                {"id": gen_id(), "user_id": demo_id, "type": "transfer_escrow", "amount": -200.0, "currency": "EUR", "counterparty": "Mariam Diallo", "note": "Transfert vers Sénégal", "created_at": iso(now_utc() - timedelta(days=2))},
                {"id": gen_id(), "user_id": demo_id, "type": "p2p_in", "amount": 100.0, "currency": "EUR", "counterparty": "Karim B.", "note": "Cadeau", "created_at": iso(now_utc() - timedelta(days=1))},
            ])
            await db.beneficiaries.insert_many([
                {"id": gen_id(), "user_id": demo_id, "full_name": "Mariam Diallo", "phone": "+221770000001", "country": "SN", "currency": "XOF", "relation": "Mère", "bank_name": None, "bank_account": None, "momo_operator": "Wave", "momo_number": "+221770000001", "created_at": iso(now_utc())},
                {"id": gen_id(), "user_id": demo_id, "full_name": "Ibrahim Ouattara", "phone": "+22507000002", "country": "CI", "currency": "XOF", "relation": "Frère", "bank_name": "SGBCI", "bank_account": "CI1234567890", "momo_operator": None, "momo_number": None, "created_at": iso(now_utc())},
                {"id": gen_id(), "user_id": demo_id, "full_name": "Fatou Ndiaye", "phone": "+221770000003", "country": "SN", "currency": "XOF", "relation": "Soeur", "bank_name": None, "bank_account": None, "momo_operator": "Orange Money", "momo_number": "+221770000003", "created_at": iso(now_utc())},
            ])
            await db.payment_methods.insert_many([
                {"id": gen_id(), "user_id": demo_id, "type": "card", "label": "Visa", "last4": "4242", "operator": None, "created_at": iso(now_utc())},
                {"id": gen_id(), "user_id": demo_id, "type": "paypal", "label": "PayPal", "last4": None, "operator": None, "created_at": iso(now_utc())},
            ])
            await db.notifications.insert_many([
                {"id": gen_id(), "user_id": demo_id, "title": "Bienvenue sur SENDBID", "body": "Votre compte est vérifié. Envoyez votre premier transfert !", "type": "info", "read": False, "created_at": iso(now_utc() - timedelta(hours=2))},
                {"id": gen_id(), "user_id": demo_id, "title": "Recharge réussie", "body": "+500 EUR sur votre wallet SendBID", "type": "success", "read": True, "created_at": iso(now_utc() - timedelta(days=3))},
            ])
        else:
            if not IS_PROD:
                await db.users.update_one(
                    {"email": DEMO_CLIENT_EMAIL},
                    {"$set": {
                        "password_hash": hash_password(DEMO_CLIENT_PASSWORD),
                        "pin_hash": hash_password(DEMO_CLIENT_PIN),
                    }},
                )

    # === COMPTES WEB PANELS — Admin / Agent / Superagent ===
    # Comptes seedés pour accéder aux panels web /admin, /agent, /superagent
    # Désactivables en production via SKIP_DEMO_DATA (comptes de démo).
    if not SKIP_DEMO_DATA:
        for cfg in [
            {"email": "admin@sendbid.app", "password": "Admin@SendBID2026!", "role": "super_admin", "name": "Admin SendBID", "profile_id": "ADM-001"},
            {"email": "agent@sendbid.app", "password": "Agent@SendBID2026!", "role": "agent", "name": "Agent SendBID", "profile_id": "AGT-001"},
            {"email": "superagent@sendbid.app", "password": "SuperAgent@SendBID2026!", "role": "super_agent", "name": "Superagent SendBID", "profile_id": "SAG-001"},
        ]:
            if not await db.users.find_one({"email": cfg["email"]}):
                await db.users.insert_one({
                    "id": gen_id(), "profile_id": cfg["profile_id"], "email": cfg["email"],
                    "phone": "+33700000000", "full_name": cfg["name"],
                    "password_hash": hash_password(cfg["password"]),
                    "pin_hash": hash_password("000000"),
                    "pin_attempts": 0, "pin_locked_until": None,
                    "email_verified": True, "phone_verified": True,
                    "kyc_tier": 3, "kyc_status": "verified",
                    "role": cfg["role"], "is_admin": cfg["role"] in ("super_admin", "admin"),
                    "biometric_enabled": False, "biometric_token": None,
                    "country": "FR", "city": "Paris",
                    "default_currency": "EUR", "secondary_currency": "USD",
                    "language": "fr", "theme": "light",
                    "created_at": now_utc(), "updated_at": now_utc(),
                })
                logger.info(f"[seed] Web panel account created: {cfg['email']} ({cfg['role']})")

    # Migration: rename legacy SendFloo branded accounts to SendBID on existing DBs
    async for user in db.users.find({"full_name": {"$regex": "SendFloo", "$options": "i"}}):
        new_name = user["full_name"].replace("SendFloo", "SendBID")
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"full_name": new_name}})
        logger.info(f"[seed] Renamed user {user.get('email')} from {user['full_name']} to {new_name}")

    # Demo PAYBID agent (linked user + agent profile) — désactivable via SKIP_DEMO_DATA
    if not SKIP_DEMO_DATA:
        if not await db.users.find_one({"email": "agent@paybid.app"}):
            agent_user_id = gen_id()
            agent_profile_id = gen_id()
            await db.users.insert_one({
                "id": agent_user_id, "profile_id": "PB100001", "email": "agent@paybid.app",
                "phone": "+221770000099", "full_name": "Mamadou Sow",
                "password_hash": hash_password("Agent@123!"),
                "pin_hash": hash_password("123456"),
                "pin_attempts": 0, "pin_locked_until": None,
                "email_verified": True, "phone_verified": True,
                "kyc_tier": 2, "kyc_status": "verified",
                "loyalty_level": "Gold", "loyalty_points": 1500,
                "biometric_enabled": False, "biometric_token": None,
                "avatar_url": "https://i.pravatar.cc/150?img=12",
                "language": "fr", "theme": "light",
                "notif_prefs": {"push": True, "email": True, "sms": True},
                "role": "agent",
                "agent_id": agent_profile_id,
                "city": "Dakar",
                "created_at": iso(now_utc()),
            })
            # Agent profile
            await db.agents.insert_one({
                "id": agent_profile_id,
                "user_id": agent_user_id,
                "full_name": "Mamadou Sow",
                "city": "Dakar",
                "country_code": "SN",
                "address": "Plateau, 12 Rue Wagane Diouf",
                "lat": 14.6928, "lng": -17.4467,
                "rating": 4.8,
                "transfers_count": 287,
                "avatar_url": "https://i.pravatar.cc/150?img=12",
                "floo_balance": 4250.00,
                "wallet_balance": 4250.00,
                "cash_capacity": 8000.0,
                "negative_claims": 0,
                "gamification_points": 850,
                "days_active": 412,
                "available": True,
                "suspended": False,
                "has_overdue_transfer": False,
                "delivery_modes": ["cash", "bank", "momo"],
                "kyc_tier": 3,
                "phone": "+221770000099",
                "created_at": iso(now_utc()),
            })
            # Wallet for agent earnings (FCFA)
            await db.wallets.insert_one({"id": gen_id(), "user_id": agent_user_id, "balance": 4250.0, "currency": "EUR", "created_at": iso(now_utc())})

    # Seeded agents (with realistic city geocoordinates for Maps integration)
    # Désactivable en production via SKIP_DEMO_DATA.
    if not SKIP_DEMO_DATA:
        if await db.agents.count_documents({}) == 0:
            city_coords = {
                "Dakar": (14.6928, -17.4467), "Abidjan": (5.3600, -4.0083),
                "Bamako": (12.6392, -8.0029), "Yaoundé": (3.8480, 11.5021),
                "Casablanca": (33.5731, -7.5898), "Lagos": (6.5244, 3.3792),
                "Accra": (5.6037, -0.1870), "Ouagadougou": (12.3714, -1.5197),
            }
            cities = list(city_coords.keys())
            names = ["Mamadou Sow", "Awa Traoré", "Yaya Koné", "Sandra Mballa", "Karim El Idrissi", "Chinwe Okafor", "Kwame Asante", "Abdoulaye Ouédraogo", "Aminata Cissé", "Issa Sidibé"]
            agents_to_seed = []
            for i in range(20):
                city = random.choice(cities)
                base_lat, base_lng = city_coords[city]
                # tiny offset so agents aren't all on the same pixel
                lat = base_lat + random.uniform(-0.05, 0.05)
                lng = base_lng + random.uniform(-0.05, 0.05)
                agents_to_seed.append({
                    "id": gen_id(),
                    "full_name": random.choice(names),
                    "city": city,
                    "lat": round(lat, 6),
                    "lng": round(lng, 6),
                    "rating": round(random.uniform(4.0, 5.0), 2),
                    "transfers_count": random.randint(50, 500),
                    "avatar_url": f"https://i.pravatar.cc/150?img={i+1}",
                    "floo_balance": round(random.uniform(500, 5000), 2),
                    "created_at": iso(now_utc()),
                })
            await db.agents.insert_many(agents_to_seed)

        # === Seed dédié agents CM (KYC tier 3, disponibles) — idempotent par profile_id ===
        # Permet de tester la livraison cash réelle sur le corridor Cameroun.
        for a in [
            {
                "id": gen_id(), "full_name": "Patrick Mbarga", "profile_id": "PB100002",
                "country_code": "CM", "country": "CM", "city": "Douala",
                "lat": 4.0511, "lng": 9.7679, "rating": 4.8, "transfers_count": 312,
                "avatar_url": "https://i.pravatar.cc/150?img=21",
                "wallet_balance": 4500.0, "cash_capacity": 2500.0,
                "available": True, "kyc_tier": 3, "kyc_status": "verified",
                "suspended": False, "has_overdue_transfer": False,
                "negative_claims": 0, "gamification_points": 850, "days_active": 420,
                "floo_balance": 3200.0, "phone": "+237699112233",
                "agency_name": "Mbarga Cash Express",
                "agency_address": "Avenue de la Liberté, Akwa, Douala",
                "created_at": iso(now_utc()),
            },
            {
                "id": gen_id(), "full_name": "Esther Ngassa", "profile_id": "PB100003",
                "country_code": "CM", "country": "CM", "city": "Yaoundé",
                "lat": 3.8480, "lng": 11.5021, "rating": 4.9, "transfers_count": 478,
                "avatar_url": "https://i.pravatar.cc/150?img=22",
                "wallet_balance": 6200.0, "cash_capacity": 3500.0,
                "available": True, "kyc_tier": 3, "kyc_status": "verified",
                "suspended": False, "has_overdue_transfer": False,
                "negative_claims": 0, "gamification_points": 1240, "days_active": 580,
                "floo_balance": 4900.0, "phone": "+237688445566",
                "agency_name": "Ngassa Money Hub",
                "agency_address": "Carrefour Bastos, Yaoundé",
                "created_at": iso(now_utc()),
            },
        ]:
            await db.agents.update_one({"profile_id": a["profile_id"]}, {"$set": a}, upsert=True)
        else:
            # Backfill lat/lng on existing agents missing them (idempotent)
            city_coords = {
                "Dakar": (14.6928, -17.4467), "Abidjan": (5.3600, -4.0083),
                "Bamako": (12.6392, -8.0029), "Yaoundé": (3.8480, 11.5021),
                "Casablanca": (33.5731, -7.5898), "Lagos": (6.5244, 3.3792),
                "Accra": (5.6037, -0.1870), "Ouagadougou": (12.3714, -1.5197),
            }
            async for ag in db.agents.find({"$or": [{"lat": None}, {"lat": {"$exists": False}}]}):
                city = ag.get("city")
                if city in city_coords:
                    base_lat, base_lng = city_coords[city]
                    await db.agents.update_one(
                        {"id": ag["id"]},
                        {"$set": {
                            "lat": round(base_lat + random.uniform(-0.05, 0.05), 6),
                            "lng": round(base_lng + random.uniform(-0.05, 0.05), 6),
                        }},
                    )

    # Seed corridors (dynamic destinations) — idempotent
    # Loads ALL 250 ISO 3166-1 countries from data/countries.json (capital + major cities).
    # Per product rule: by default every country is BOTH a sender AND a receiver.
    import json as _json
    from pathlib import Path as _P
    _data_path = _P(__file__).resolve().parent / "data" / "countries.json"
    if _data_path.exists():
        with open(_data_path, "r", encoding="utf-8") as fh:
            all_countries = _json.load(fh)
    else:
        all_countries = []
        logger.warning("[seed] data/countries.json missing — falling back to legacy 8-country seed")

    if all_countries:
        for c in all_countries:
            # Idempotent upsert — preserves any per-country overrides applied by ops
            await db.corridors.update_one(
                {"country_code": c["country_code"]},
                {"$set": {
                    "country_code": c["country_code"],
                    "country_name": c["country_name"],
                    "flag": c.get("flag", ""),
                    "currency": c["currency"],
                    "fx_rate_eur": c.get("fx_rate_eur", 1.0),
                    "fx_fixed": c.get("fx_fixed", False),
                    "fx_margin_percent": c.get("fx_margin_percent", 1.5),
                    "fee_percent_min": c.get("fee_percent_min", 1.0),
                    "fee_percent_max": c.get("fee_percent_max", 5.0),
                    "capital": c.get("capital"),
                    "cities": c.get("cities") or ([c["capital"]] if c.get("capital") else []),
                    # Default: every country is both a sender AND a receiver
                    "active": True,
                    "is_sender": True,
                    "is_receiver": True,
                    # Capabilities default — even without an explicit local agent/partner
                    # the country is enabled as a destination via the global aggregator network.
                    "has_cash_payout": True,
                    "bank_partner": None,
                    "momo_partner": None,
                }, "$setOnInsert": {"agents_count": 0}},
                upsert=True,
            )

    # Backfill agents_count on corridors from real agent docs (city → corridor mapping)
    async for cor in db.corridors.find({}, {"country_code": 1, "country_name": 1}):
        # We seeded agent.city to be African city names; map city → corridor by name
        count = await db.agents.count_documents({"city": {"$regex": cor["country_name"][:5], "$options": "i"}})
        if count == 0:
            # fallback: count agents whose city is in known cities of that country
            city_map = {
                "CI": ["Abidjan"], "SN": ["Dakar"], "ML": ["Bamako"], "BF": ["Ouagadougou"],
                "CM": ["Yaoundé"], "MA": ["Casablanca"], "NG": ["Lagos"], "GH": ["Accra"],
            }
            cities = city_map.get(cor["country_code"], [])
            if cities:
                count = await db.agents.count_documents({"city": {"$in": cities}})
        await db.corridors.update_one({"country_code": cor["country_code"]}, {"$set": {"agents_count": count}})

    # Country selection for senders is now driven by corridors.is_sender (default true everywhere).
    # The legacy `countries_extra` seed is no longer needed but kept as a noop for migrations.
    sender_only_seed = []
    for code, name, flag, currency in sender_only_seed:
        await db.countries_extra.update_one(
            {"country_code": code},
            {"$set": {
                "country_code": code, "country_name": name, "flag": flag, "currency": currency,
                "sender_only": True, "active": True,
            }},
            upsert=True,
        )

    # IDEMPOTENT DEMO RESET — runs every startup so E2E tests are repeatable.
    # Resets the demo client's wallet balance and PIN to known values regardless
    # of what previous test runs may have done.
    # ⚠️ DISABLED IN PRODUCTION — would otherwise reset client@sendbid.app password.
    demo_user = await db.users.find_one({"email": DEMO_CLIENT_EMAIL}, {"id": 1})
    if demo_user and not IS_PROD:
        await db.wallets.update_one(
            {"user_id": demo_user["id"]},
            {"$set": {"balance": 1250.50, "currency": "EUR"}},
        )
        await db.users.update_one(
            {"id": demo_user["id"]},
            {"$set": {
                "pin_hash": hash_password(DEMO_CLIENT_PIN),
                "pin_attempts": 0,
                "pin_locked_until": None,
                "password_hash": hash_password(DEMO_CLIENT_PASSWORD),
            }},
        )
        logger.info(f"[seed] demo wallet reset to 1250.50 EUR + PIN/password restored ({DEMO_CLIENT_EMAIL})")

    # IDEMPOTENT DEMO RESET — agent@paybid.app (mirror the client reset so E2E tests
    # don't drift when a previous test mutates the agent password / PIN).
    demo_agent_user = await db.users.find_one({"email": "agent@paybid.app"}, {"id": 1})
    if demo_agent_user and not IS_PROD:
        await db.users.update_one(
            {"id": demo_agent_user["id"]},
            {"$set": {
                "password_hash": hash_password("Agent@123!"),
                "pin_hash": hash_password("123456"),
                "pin_attempts": 0,
                "pin_locked_until": None,
            }},
        )
        await db.wallets.update_one(
            {"user_id": demo_agent_user["id"]},
            {"$set": {"balance": 4250.0, "currency": "EUR"}},
        )
        logger.info("[seed] demo agent PIN/password restored (agent@paybid.app)")

    # Cleanup demo data in production
    if IS_PROD and SKIP_DEMO_DATA:
        protected = {ADMIN_EMAIL, SUPER_ADMIN_EMAIL}
        demo_emails = [
            "partner@sendbid.app", "superagent@sendbid.app",
            "admin@sendbid.app", "agent@sendbid.app", "agent@paybid.app",
            DEMO_CLIENT_EMAIL,
        ]
        demo_emails = [e for e in demo_emails if e and e not in protected]
        if demo_emails:
            demo_users = await db.users.find({"email": {"$in": demo_emails}}, {"id": 1, "agent_id": 1}).to_list(1000)
            demo_user_ids = [u["id"] for u in demo_users]
            agent_ids_from_users = [u["agent_id"] for u in demo_users if u.get("agent_id")]
            if demo_user_ids:
                await db.users.delete_many({"id": {"$in": demo_user_ids}})
                await db.wallets.delete_many({"user_id": {"$in": demo_user_ids}})
                await db.wallet_tx.delete_many({"user_id": {"$in": demo_user_ids}})
                await db.beneficiaries.delete_many({"user_id": {"$in": demo_user_ids}})
                await db.payment_methods.delete_many({"user_id": {"$in": demo_user_ids}})
                await db.notifications.delete_many({"user_id": {"$in": demo_user_ids}})
                await db.linked_accounts.delete_many({"user_id": {"$in": demo_user_ids}})
                logger.info(f"[seed] removed {len(demo_user_ids)} demo users in production")
            demo_profile_ids = ["PB100001", "PB100002", "PB100003"]
            await db.agents.delete_many({
                "$or": [
                    {"profile_id": {"$in": demo_profile_ids}},
                    {"id": {"$in": agent_ids_from_users}},
                ]
            })
            logger.info("[seed] removed demo agent profiles in production")

    # Test credentials file
    Path("/app/memory").mkdir(parents=True, exist_ok=True)
    creds = f"""# SENDBID — Test Credentials

## Demo Client (use this to test the app)
- Email: `{DEMO_CLIENT_EMAIL}`
- Phone: `+33612345678`
- Password: `{DEMO_CLIENT_PASSWORD}`
- PIN (6 digits): `{DEMO_CLIENT_PIN}`
- Profile ID: `SB100001`
- KYC Tier: 1 (Silver)
- Wallet balance: 1250.50 EUR

## Admin
- Email: `{ADMIN_EMAIL}`
- Password: `{ADMIN_PASSWORD}`
- PIN: `123456`

## Notes
- ENVIRONMENT={{development|production}} controls whether `dev_email_otp`, `dev_phone_otp`, `dev_reset_token` fields are exposed in API responses.
- Withdrawal codes are 10-digit numeric, server-generated.
- QR codes are HMAC-SHA256 signed and valid 48h.
- WebSocket: `ws://<host>/api/ws/auction/{{transfer_id}}?token=<jwt>` (token optional in dev, recommended in prod).
- PIN brute-force lockout: 5 wrong attempts → 15 min lock (HTTP 423).
- Weak PIN rejection on /auth/create-pin: blocks 000000, 123456, sequential, repeated, common PINs.
- Demo PINs (123456) are pre-seeded directly in DB and are NOT subject to weak-PIN check.
"""
    try:
        creds_path = Path(__file__).parent / "test_credentials.md"
        with open(creds_path, "w", encoding="utf-8") as f:
            f.write(creds)
    except Exception as e:
        logger.warning(f"[seed] could not write credentials file: {e}")
    logger.info("SENDBID seed complete")
