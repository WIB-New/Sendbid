/** Mapping pays → devise locale */
export const COUNTRY_CURRENCY: Record<string, string> = {
  "France": "EUR",
  "Belgique": "EUR",
  "Allemagne": "EUR",
  "Espagne": "EUR",
  "Italie": "EUR",
  "Cameroun": "XAF",
  "Gabon": "XAF",
  "Congo (Brazzaville)": "XAF",
  "Tchad": "XAF",
  "Sénégal": "XOF",
  "Côte d'Ivoire": "XOF",
  "Mali": "XOF",
  "Burkina Faso": "XOF",
  "Togo": "XOF",
  "Bénin": "XOF",
  "Niger": "XOF",
  "Congo (RDC)": "CDF",
  "Guinée": "GNF",
  "Madagascar": "MGA",
  "Maroc": "MAD",
  "Tunisie": "TND",
  "Algérie": "DZD",
  "Royaume-Uni": "GBP",
  "États-Unis": "USD",
  "Canada": "CAD",
  "Suisse": "CHF",
};

/**
 * Retourne la devise locale du pays.
 * Si le pays n'est pas trouvé, retourne la devise du wallet (fallback).
 */
export function getLocalCurrency(country?: string | null, walletCurrency?: string): string {
  if (country && COUNTRY_CURRENCY[country]) {
    return COUNTRY_CURRENCY[country];
  }
  return walletCurrency || "EUR";
}

/** Opérateurs Mobile Money disponibles par pays */
export const COUNTRY_MOMO_OPS: Record<string, string[]> = {
  "Cameroun":           ["MTN MoMo", "Orange Money"],
  "Gabon":              ["Airtel Money", "Moov Money"],
  "Congo (Brazzaville)":["MTN MoMo", "Airtel Money"],
  "Tchad":              ["Airtel Money", "Moov Money"],
  "Sénégal":            ["Wave", "Orange Money", "Free Money"],
  "Côte d'Ivoire":      ["Wave", "Orange Money", "MTN MoMo", "Moov Money"],
  "Mali":               ["Orange Money", "Moov Money"],
  "Burkina Faso":       ["Orange Money", "Moov Money"],
  "Togo":               ["Moov Money", "Tmoney"],
  "Bénin":              ["Moov Money", "MTN MoMo"],
  "Niger":              ["Airtel Money", "Moov Money"],
  "Congo (RDC)":        ["Airtel Money", "Orange Money", "M-Pesa"],
  "Guinée":             ["Orange Money", "MTN MoMo"],
  "Madagascar":         ["Mvola", "Orange Money", "Airtel Money"],
  "Maroc":              ["Orange Money", "Maroc Telecom Money"],
  "Tunisie":            ["Orange Money", "Ooredoo Money"],
  "Algérie":            ["Algérie Poste (CCP)"],
  "France":             ["Lydia", "PayLib"],
  "Belgique":           ["Payconiq"],
  "Royaume-Uni":        ["Monzo", "Revolut"],
  "États-Unis":         ["Venmo", "Zelle", "Cash App"],
  "Canada":             ["Interac e-Transfer"],
  "Suisse":             ["TWINT"],
  "Allemagne":          ["N26", "Klarna"],
  "Espagne":            ["Bizum"],
  "Italie":             ["Satispay"],
};

/** Méthodes de retrait disponibles par pays */
export const COUNTRY_PAYMENT_METHODS: Record<string, ("cash" | "bank" | "momo" | "paypal")[]> = {
  "France":             ["cash", "bank", "paypal"],
  "Belgique":           ["cash", "bank", "paypal"],
  "Allemagne":          ["cash", "bank", "paypal"],
  "Espagne":            ["cash", "bank", "paypal"],
  "Italie":             ["cash", "bank", "paypal"],
  "Suisse":             ["cash", "bank", "paypal"],
  "Royaume-Uni":        ["cash", "bank", "paypal"],
  "États-Unis":         ["cash", "bank", "paypal"],
  "Canada":             ["cash", "bank", "paypal"],
  "Cameroun":           ["cash", "momo", "bank", "paypal"],
  "Gabon":              ["cash", "momo", "bank", "paypal"],
  "Congo (Brazzaville)":["cash", "momo", "paypal"],
  "Tchad":              ["cash", "momo", "paypal"],
  "Sénégal":            ["cash", "momo", "bank", "paypal"],
  "Côte d'Ivoire":      ["cash", "momo", "bank", "paypal"],
  "Mali":               ["cash", "momo", "paypal"],
  "Burkina Faso":       ["cash", "momo", "paypal"],
  "Togo":               ["cash", "momo", "paypal"],
  "Bénin":              ["cash", "momo", "paypal"],
  "Niger":              ["cash", "momo", "paypal"],
  "Congo (RDC)":        ["cash", "momo", "paypal"],
  "Guinée":             ["cash", "momo", "paypal"],
  "Madagascar":         ["cash", "momo", "paypal"],
  "Maroc":              ["cash", "bank", "momo", "paypal"],
  "Tunisie":            ["cash", "bank", "momo", "paypal"],
  "Algérie":            ["cash", "bank", "momo", "paypal"],
};

/** Retourne les opérateurs MoMo disponibles pour un pays (fallback liste générique) */
export function getMomoOps(country?: string | null): string[] {
  if (country && COUNTRY_MOMO_OPS[country]) return COUNTRY_MOMO_OPS[country];
  return ["Wave", "Orange Money", "MTN MoMo", "Moov Money", "Airtel Money"];
}

/** Retourne les méthodes de retrait disponibles pour un pays */
export function getPaymentMethods(country?: string | null): ("cash" | "bank" | "momo" | "paypal")[] {
  if (country && COUNTRY_PAYMENT_METHODS[country]) return COUNTRY_PAYMENT_METHODS[country];
  return ["cash", "bank", "momo", "paypal"];
}

/** Banques locales par pays */
export const COUNTRY_BANKS: Record<string, string[]> = {
  "Cameroun": [
    "Afriland First Bank",
    "BICEC (Banque Internationale du Cameroun pour l'Épargne et le Crédit)",
    "SGC (Société Générale Cameroun)",
    "SCB Cameroun (Société Commerciale de Banque)",
    "CCA Bank (Crédit Communautaire d'Afrique)",
    "UBA Cameroun (United Bank for Africa)",
    "Ecobank Cameroun",
    "BGFI Bank Cameroun",
    "CBC Bank (Commercial Bank of Cameroon)",
    "Citibank Cameroun",
    "NFC Bank (National Financial Credit Bank)",
    "Atlantic Bank Cameroun",
    "BDEAC",
  ],
  "Sénégal": [
    "CBAO Groupe Attijariwafa",
    "SGBS (Société Générale de Banques au Sénégal)",
    "Ecobank Sénégal",
    "BIS (Banque Islamique du Sénégal)",
    "UBA Sénégal",
    "Orabank Sénégal",
    "BHS (Banque de l'Habitat du Sénégal)",
    "BICIS (BNP Paribas)",
  ],
  "Côte d'Ivoire": [
    "SGCI (Société Générale Côte d'Ivoire)",
    "Ecobank Côte d'Ivoire",
    "BICICI (BNP Paribas)",
    "Orabank Côte d'Ivoire",
    "UBA Côte d'Ivoire",
    "BIAO-CI",
    "Versus Bank",
    "NSIA Banque",
  ],
  "Gabon": [
    "BGFI Bank Gabon",
    "Orabank Gabon",
    "UBA Gabon",
    "Ecobank Gabon",
    "BICI Gabon",
  ],
  "Congo (Brazzaville)": [
    "BGFI Bank Congo",
    "LCB Bank",
    "Ecobank Congo",
    "Crédit du Congo",
  ],
  "Congo (RDC)": [
    "Rawbank",
    "Equity BCDC",
    "UBA RDC",
    "Ecobank RDC",
    "TMB (Trust Merchant Bank)",
  ],
  "Maroc": [
    "Attijariwafa Bank",
    "Banque Populaire",
    "BMCE Bank (Bank of Africa)",
    "CIH Bank",
    "Crédit Agricole du Maroc",
    "Société Générale Maroc",
    "BMCI (BNP Paribas Maroc)",
    "Al Barid Bank",
  ],
  "Tunisie": [
    "Banque Nationale Agricole (BNA)",
    "BIAT",
    "Attijari Bank Tunisie",
    "STB (Société Tunisienne de Banque)",
    "BH Bank",
    "Amen Bank",
    "UIB (Union Internationale de Banques)",
  ],
  "Algérie": [
    "BNA (Banque Nationale d'Algérie)",
    "CPA (Crédit Populaire d'Algérie)",
    "BEA (Banque Extérieure d'Algérie)",
    "BADR (Banque de l'Agriculture)",
    "BDL (Banque de Développement Local)",
    "Société Générale Algérie",
    "BNP Paribas El Djazaïr",
  ],
  "France": [
    "BNP Paribas", "Société Générale", "Crédit Agricole", "LCL",
    "Caisse d'Épargne", "Banque Populaire", "Crédit Mutuel",
    "CIC", "La Banque Postale", "Boursorama", "Revolut", "N26",
  ],
  "Belgique": [
    "BNP Paribas Fortis", "ING Belgique", "KBC", "Belfius", "Crelan",
  ],
  "Royaume-Uni": [
    "Barclays", "HSBC UK", "Lloyds Bank", "NatWest", "Santander UK",
    "Monzo", "Starling Bank", "Revolut",
  ],
  "États-Unis": [
    "Chase (JPMorgan)", "Bank of America", "Wells Fargo", "Citibank",
    "U.S. Bank", "Capital One", "TD Bank",
  ],
  "Canada": [
    "RBC (Royal Bank of Canada)", "TD Canada Trust", "Scotiabank",
    "BMO (Banque de Montréal)", "CIBC", "Desjardins",
  ],
  "Suisse": [
    "UBS", "Credit Suisse", "PostFinance", "Raiffeisen", "Zürcher Kantonalbank",
  ],
  "Chine": [
    "ICBC (Industrial and Commercial Bank of China)",
    "CCB (China Construction Bank)",
    "ABC (Agricultural Bank of China)",
    "Bank of China",
    "Postal Savings Bank of China",
    "China Merchants Bank",
    "WeChat Pay (Tencent)",
    "Alipay (Ant Group)",
  ],
  "Inde": [
    "State Bank of India (SBI)",
    "HDFC Bank",
    "ICICI Bank",
    "Axis Bank",
    "Kotak Mahindra Bank",
    "Bank of Baroda",
    "Punjab National Bank",
    "Union Bank of India",
  ],
  "Japon": [
    "Japan Post Bank",
    "MUFG Bank (Mitsubishi UFJ)",
    "SMBC (Sumitomo Mitsui)",
    "Mizuho Bank",
    "Resona Bank",
  ],
  "Brésil": [
    "Banco do Brasil",
    "Caixa Econômica Federal",
    "Bradesco",
    "Itaú Unibanco",
    "Santander Brasil",
    "Nubank",
  ],
  "Mexique": [
    "BBVA México",
    "Citibanamex",
    "Santander México",
    "Banorte",
    "HSBC México",
  ],
  "Émirats arabes unis": [
    "First Abu Dhabi Bank (FAB)",
    "Emirates NBD",
    "Abu Dhabi Commercial Bank (ADCB)",
    "Dubai Islamic Bank",
    "Mashreq Bank",
  ],
  "Arabie saoudite": [
    "Al Rajhi Bank",
    "National Commercial Bank (Alinma)",
    "Saudi National Bank (SNB)",
    "Riyad Bank",
    "Bank AlJazira",
  ],
  "Afrique du Sud": [
    "Standard Bank",
    "Absa Bank",
    "FirstRand (FNB)",
    "Nedbank",
    "Capitec Bank",
  ],
  "Nigeria": [
    "Zenith Bank",
    "Access Bank",
    "GTBank (Guaranty Trust Bank)",
    "UBA Nigeria",
    "First Bank of Nigeria",
    "Fidelity Bank",
    "Stanbic IBTC Bank",
  ],
  "Ghana": [
    "GCB Bank",
    "Ecobank Ghana",
    "Stanbic Bank Ghana",
    "Absa Ghana",
    "Fidelity Bank Ghana",
  ],
  "Kenya": [
    "Equity Bank Kenya",
    "KCB (Kenya Commercial Bank)",
    "Cooperative Bank",
    "Absa Kenya",
    "NCBA Bank",
  ],
  "Éthiopie": [
    "Commercial Bank of Ethiopia",
    "Awash Bank",
    "Dashen Bank",
    "Bank of Abyssinia",
  ],
};

/** Retourne la liste des banques pour un pays */
export function getBanks(country?: string | null): string[] {
  if (country && COUNTRY_BANKS[country]) return COUNTRY_BANKS[country];
  return [];
}
