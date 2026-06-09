# Lot 4 & Lot 5 — Migration progressive

## Lot 4 — Téléphone splitté & sync pays↔indicatif

### ✅ Livré
- **Composant réutilisable `<PhoneFieldSplit/>`** créé dans `/app/frontend/src/components/PhoneFieldSplit.tsx`
  - 2 sous-champs : sélecteur indicatif (avec drapeau emoji) + numéro local
  - Sync bidirectionnel : prop `countryHint` (ISO2) → indicatif auto-rempli, callback `onCountryAutoFilled` quand user change indicatif
  - Modal de sélection avec recherche (par ISO2 ou +XX)
  - Sortie : `onChange(fullPhone)` = `+<dial><local>` (E.164)
  - Helper `dialToCountry` / `countryToDial` réutilisés depuis `/src/utils/countries`

### ⏳ Migration restante (à faire dans une future itération)
Le composant est prêt mais doit être branché dans chaque écran. Pattern d'intégration :

```tsx
import { PhoneFieldSplit } from "../../src/components/PhoneFieldSplit";

<PhoneFieldSplit
  value={phone}
  onChange={setPhone}
  countryHint={country?.country_code}  // ISO2 du country picker
  onCountryAutoFilled={(iso) => {
    const c = countries.find(x => x.country_code === iso);
    if (c) setCountry(c);
  }}
/>
```

### Écrans à migrer (priorité décroissante)
1. `/app/(auth)/signup.tsx` — champ phone client
2. `/app/paybid/signup.tsx` — champ phone agent
3. `/app/personal-info.tsx` — édition phone profil
4. `/app/beneficiaries/add.tsx` — phone bénéficiaire
5. `/app/payment-methods.tsx` — momo phone (modal MoMo)
6. `/app/transfer/new.tsx` — phone destinataire si applicable

---

## Lot 5 — Paybid refonte

### ✅ Livré
- **Bouclier de vérification rouge sombre #B91C1C** dans `VerificationShieldFloating.tsx` (au lieu de l'orange #F59E0B)
- **Paybid Login redesign** : 
  - Texte "Connexion agent" en marron du thème PAYBID
  - Inputs avec fond blanc + texte noir + labels bleu sombre #022a6b

### ⏳ Restant à faire (Paybid Signup refonte complète)
1. `/app/paybid/signup.tsx` — appliquer même design que login
2. Ajouter champ **"Informations de la société"** (raison sociale, registre commerce)
3. Ajouter champ **"Super agent rattaché"** = dropdown alimenté par `GET /api/agent/super-agents` (à créer côté backend)
4. Côté backend : endpoint `GET /api/agent/super-agents` listant les utilisateurs role=super_agent
5. Côté backend : impact sur le super-agent (table `agent_assignments`, notif Slack/email, validation pending)
6. Splitter le champ Téléphone avec `<PhoneFieldSplit/>`
7. Supprimer les mentions "E.164" et "ISO2" visibles
8. **PIN obligatoire** post-signup (bloquant) — appel `POST /api/auth/setup-pin` 
9. Procédure de vérification email + téléphone (envoi OTP)

### Effort estimé
~2-3h pour finaliser le signup Paybid complet + backend super_agent.
