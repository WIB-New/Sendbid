import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Alert, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
/**
 * KYC Personnes morales — Wizard 3 niveaux.
 * Niveau 1 : infos de base — Niveau 2 : docs légaux — Niveau 3 : représentant légal.
 */
const ENTITY_TYPES = ["SAS", "SA", "SARL", "EURL", "SASU", "SCI", "Association", "ONG", "Auto-entrepreneur", "Autre"];

export default function KycCorporate() {
  const colors = useThemedColors();
  const router = useRouter();
  const [status, setStatus] = useState<any>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);

  // L1
  const [legalName, setLegalName] = useState("");
  const [entityType, setEntityType] = useState("SAS");
  const [regNum, setRegNum] = useState("");
  const [country, setCountry] = useState("FR");
  const [legalCity, setLegalCity] = useState("");
  const [legalAddress, setLegalAddress] = useState("");
  const [activityCode, setActivityCode] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");

  // L2 — noms de fichiers symboliques (le vrai upload serait vers S3)
  const [kbisUploaded, setKbisUploaded] = useState(false);
  const [statutesUploaded, setStatutesUploaded] = useState(false);
  const [uboName, setUboName] = useState("");

  // L3
  const [repName, setRepName] = useState("");
  const [repDob, setRepDob] = useState("");
  const [repRole, setRepRole] = useState("Président");
  const [idUploaded, setIdUploaded] = useState(false);
  const [selfieUploaded, setSelfieUploaded] = useState(false);

  useEffect(() => {
    api.get("/kyc/corporate").then((r) => {
      setStatus(r.data);
      const lvl = (r.data?.level || 0) + 1;
      setStep(Math.min(3, Math.max(1, lvl)) as any);
    }).catch(() => {});
  }, []);

  const submitL1 = async () => {
    if (!legalName || !regNum || !cEmail || !cPhone) { Alert.alert("Champs requis", "Raison sociale, numéro d'enregistrement, email et téléphone sont obligatoires."); return; }
    setBusy(true);
    try {
      await api.post("/kyc/corporate/level1", {
        legal_name: legalName, entity_type: entityType, registration_number: regNum,
        country: country.toUpperCase().slice(0, 2), legal_city: legalCity, legal_address: legalAddress,
        activity_code: activityCode, contact_email: cEmail, contact_phone: cPhone,
      });
      setStep(2);
    } catch (e: any) { Alert.alert("Erreur", apiError(e)); } finally { setBusy(false); }
  };

  const submitL2 = async () => {
    if (!kbisUploaded || !statutesUploaded) { Alert.alert("Documents requis", "Kbis et statuts sont obligatoires."); return; }
    setBusy(true);
    try {
      await api.post("/kyc/corporate/level2", {
        kbis_url: "demo://kbis.pdf", statutes_url: "demo://statutes.pdf",
        ubos: uboName ? [{ full_name: uboName, ownership_pct: 100 }] : [],
      });
      setStep(3);
    } catch (e: any) { Alert.alert("Erreur", apiError(e)); } finally { setBusy(false); }
  };

  const submitL3 = async () => {
    if (!repName || !repDob || !idUploaded || !selfieUploaded) { Alert.alert("Champs requis", "Nom, date de naissance, ID et selfie sont obligatoires."); return; }
    setBusy(true);
    try {
      await api.post("/kyc/corporate/level3", {
        representative_full_name: repName, representative_dob: repDob,
        representative_nationality: country.toUpperCase().slice(0, 2),
        representative_role: repRole,
        id_front_url: "demo://id-front.jpg", selfie_url: "demo://selfie.jpg",
        address_proof_url: "demo://address.pdf",
      });
      Alert.alert("Vérification soumise", "Votre dossier entreprise est validé. Plafond annuel : 500 000 €", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e: any) { Alert.alert("Erreur", apiError(e)); } finally { setBusy(false); }
  };

  return (
    <Screen title="KYC Entreprise" back hero scroll={false}>
      {/* Stepper */}
      <View style={styles.stepper}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={{ flex: 1, alignItems: "center" }}>
            <View style={[styles.stepDot, step >= n && styles.stepDotActive]}>
              {step > n ? <Ionicons name="checkmark" size={14} color="white" /> : <TText variant="label" weight="bold" color={step >= n ? "white" : colors.neutrals.textSecondary}>{n}</TText>}
            </View>
            <TText variant="label" weight="bold" color={step >= n ? colors.primary.base : colors.neutrals.textSecondary} style={{ marginTop: 4 }}>
              {n === 1 ? "Infos" : n === 2 ? "Documents" : "Dirigeant"}
            </TText>
          </View>
        ))}
      </View>

      {status?.status === "APPROVED" ? (
        <LinearGradient colors={["#D1FAE5", "#A7F3D0"]} style={styles.approvedBox}>
          <Ionicons name="checkmark-circle" size={40} color="#059669" />
          <TText variant="subtitle" weight="extraBold" color="#065F46" style={{ marginTop: 8 }}>Entreprise vérifiée</TText>
          <TText variant="caption" color="#065F46" align="center">Plafond annuel de 500 000 € débloqué.</TText>
        </LinearGradient>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <>
              <TText variant="subtitle" weight="bold" style={{ marginBottom: 4 }}>Niveau 1 — Informations de base</TText>
              <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
                Identité légale de votre structure (SAS, SARL, Association, ONG…).
              </TText>
              <Input testID="kc-legal-name" label="Raison sociale *" value={legalName} onChangeText={setLegalName} icon="business-outline" />
              <TText variant="caption" weight="semiBold" style={{ marginBottom: 6 }}>Forme juridique</TText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {ENTITY_TYPES.map((t) => (
                  <TouchableOpacity key={t} testID={`kc-type-${t}`} onPress={() => setEntityType(t)} style={[styles.chip, entityType === t && styles.chipActive]}>
                    <TText variant="label" weight="bold" color={entityType === t ? "white" : colors.neutrals.textPrimary}>{t}</TText>
                  </TouchableOpacity>
                ))}
              </View>
              <Input testID="kc-reg" label="N° SIRET / RCS / ONG *" value={regNum} onChangeText={setRegNum} icon="card-outline" />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}><Input label="Pays (ISO 2) *" value={country} onChangeText={setCountry} icon="flag-outline" autoCapitalize="characters" /></View>
                <View style={{ flex: 2 }}><Input label="Ville" value={legalCity} onChangeText={setLegalCity} icon="location-outline" /></View>
              </View>
              <Input label="Adresse légale" value={legalAddress} onChangeText={setLegalAddress} icon="home-outline" multiline />
              <Input label="Code d'activité (NAF/NACE)" value={activityCode} onChangeText={setActivityCode} icon="layers-outline" />
              <Input testID="kc-email" label="Email de contact *" value={cEmail} onChangeText={setCEmail} icon="mail-outline" keyboardType="email-address" autoCapitalize="none" />
              <Input testID="kc-phone" label="Téléphone de contact *" value={cPhone} onChangeText={setCPhone} icon="call-outline" keyboardType="phone-pad" />
              <Button testID="kc-l1-submit" title="Continuer" icon="arrow-forward" loading={busy} onPress={submitL1} style={{ marginTop: spacing.lg }} />
            </>
          )}

          {step === 2 && (
            <>
              <TText variant="subtitle" weight="bold" style={{ marginBottom: 4 }}>Niveau 2 — Documents légaux</TText>
              <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
                Kbis récent (&lt; 3 mois), statuts à jour, liste des bénéficiaires effectifs (UBO).
              </TText>
              <DocRow label="Extrait Kbis (&lt; 3 mois)" uploaded={kbisUploaded} onPress={() => setKbisUploaded(true)} />
              <DocRow label="Statuts de la société" uploaded={statutesUploaded} onPress={() => setStatutesUploaded(true)} />
              <Input label="Bénéficiaire effectif (UBO) — Nom complet" value={uboName} onChangeText={setUboName} icon="people-outline" />
              <Button testID="kc-l2-submit" title="Continuer" icon="arrow-forward" loading={busy} onPress={submitL2} style={{ marginTop: spacing.lg }} />
            </>
          )}

          {step === 3 && (
            <>
              <TText variant="subtitle" weight="bold" style={{ marginBottom: 4 }}>Niveau 3 — Représentant légal</TText>
              <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
                Pièce d&apos;identité, selfie, preuve d&apos;adresse du dirigeant.
              </TText>
              <Input label="Nom complet du représentant *" value={repName} onChangeText={setRepName} icon="person-outline" />
              <Input label="Date de naissance (JJ/MM/AAAA) *" value={repDob} onChangeText={setRepDob} icon="calendar-outline" />
              <TText variant="caption" weight="semiBold" style={{ marginBottom: 6, marginTop: 8 }}>Rôle</TText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {["Président", "Gérant", "Directeur", "Trésorier"].map((r) => (
                  <TouchableOpacity key={r} onPress={() => setRepRole(r)} style={[styles.chip, repRole === r && styles.chipActive]}>
                    <TText variant="label" weight="bold" color={repRole === r ? "white" : colors.neutrals.textPrimary}>{r}</TText>
                  </TouchableOpacity>
                ))}
              </View>
              <DocRow label="Pièce d'identité (recto)" uploaded={idUploaded} onPress={() => setIdUploaded(true)} />
              <DocRow label="Selfie avec pièce d'identité" uploaded={selfieUploaded} onPress={() => setSelfieUploaded(true)} />
              <Button testID="kc-l3-submit" title="Soumettre & valider" icon="shield-checkmark" loading={busy} onPress={submitL3} style={{ marginTop: spacing.lg }} />
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function DocRow({ label, uploaded, onPress }: { label: string; uploaded: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.docRow, uploaded && styles.docRowDone]}>
      <Ionicons name={uploaded ? "checkmark-circle" : "cloud-upload-outline"} size={24} color={uploaded ? "#10B981" : colors.primary.base} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <TText variant="body" weight="semiBold">{label}</TText>
        <TText variant="caption" color={uploaded ? "#065F46" : colors.neutrals.textSecondary}>
          {uploaded ? "Document téléversé" : "Appuyer pour téléverser (PDF/JPG max 5 MB)"}
        </TText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: "row", justifyContent: "space-around", paddingVertical: spacing.md, marginBottom: spacing.md, backgroundColor: colors.overlays.primarySoft, borderRadius: radii.lg },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.neutrals.border, alignItems: "center", justifyContent: "center" },
  stepDotActive: { backgroundColor: colors.primary.base },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full, backgroundColor: colors.neutrals.surface, borderWidth: 1, borderColor: colors.neutrals.border },
  chipActive: { backgroundColor: colors.primary.base, borderColor: colors.primary.base },
  docRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.neutrals.border, backgroundColor: colors.neutrals.surface, marginBottom: 10 },
  docRowDone: { borderColor: "#10B981", backgroundColor: "rgba(16,185,129,0.08)" },
  approvedBox: { alignItems: "center", padding: spacing.xl, borderRadius: radii.xl, marginTop: spacing.md },
});
