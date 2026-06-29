import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Modal, FlatList } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { PhoneFieldSplit } from "../../src/components/PhoneFieldSplit";
import { api, apiError } from "../../src/api";
import { flagEmoji } from "../../src/utils/dialCodes";
import { useThemedPaybidColors } from "../../src/themeContext";
import { spacing, radii } from "../../src/theme";

/** PAYBID agent signup — Lot 5 :
 *  - Sélecteur de TYPE d'agent (Agent propre · Super-Agent · Sub-Agent rattaché)
 *  - Champ "Société" (legal_name) si Super-Agent / Sub-Agent
 *  - Sélecteur de Super-Agent parent (si Sub-Agent)
 *  - PhoneFieldSplit (indicatif + numéro)
 */
type AgentType = "own" | "super_agent" | "partner";
type SuperAgent = { id: string; label: string; city?: string; country?: string };

const AGENT_TYPES: { value: AgentType; label: string; desc: string; icon: string }[] = [
  { value: "own", label: "Agent indépendant", desc: "Vous opérez seul (personne physique)", icon: "person-outline" },
  { value: "super_agent", label: "Super-Agent (société)", desc: "Vous dirigez une société qui supervise plusieurs agents", icon: "business-outline" },
  { value: "partner", label: "Sub-Agent partenaire", desc: "Vous opérez sous un Super-Agent existant", icon: "git-network-outline" },
];

export default function PaybidSignup() {
  const paybidColors = useThemedPaybidColors();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+221");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("SN");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Lot 5 — Nouveaux champs
  const [agentType, setAgentType] = useState<AgentType>("own");
  const [legalName, setLegalName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [parentAgentId, setParentAgentId] = useState<string | null>(null);
  const [parentAgentLabel, setParentAgentLabel] = useState<string>("");
  const [superAgents, setSuperAgents] = useState<SuperAgent[]>([]);
  const [parentModalOpen, setParentModalOpen] = useState(false);

  // Charger la liste des Super-Agents quand le type passe à "partner"
  useEffect(() => {
    if (agentType !== "partner") return;
    api.get(`/agent/super-agents/public?country=${country}`)
      .then((r) => setSuperAgents(r.data || []))
      .catch(() => setSuperAgents([]));
  }, [agentType, country]);

  const needsCompany = agentType === "super_agent" || agentType === "partner";
  const needsParent = agentType === "partner";

  const submit = async () => {
    setErr(null);
    if (needsCompany && !legalName.trim()) { setErr("Le nom de la société est requis."); return; }
    if (needsParent && !parentAgentId) { setErr("Veuillez sélectionner votre Super-Agent parent."); return; }
    setLoading(true);
    try {
      await api.post("/agent/signup", {
        full_name: fullName, email, phone, city, country, password,
        agent_type: agentType,
        legal_name: needsCompany ? legalName.trim() : null,
        registration_number: needsCompany ? registrationNumber.trim() || null : null,
        parent_agent_id: needsParent ? parentAgentId : null,
      });
      router.replace("/paybid/login" as any);
    } catch (e: any) {
      setErr(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const disabled = !fullName || !email || !phone || !city || !password
    || (needsCompany && !legalName)
    || (needsParent && !parentAgentId);

  return (
    <View style={{ flex: 1, backgroundColor: paybidColors.primary.dark }}>
      <LinearGradient colors={[paybidColors.primary.dark, paybidColors.primary.base]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </TouchableOpacity>
            <TText variant="body" weight="extraBold" color="white">PAYBID · Inscription</TText>
            <View style={{ width: 36 }} />
          </View>
          <View style={styles.heroBody}>
            <View style={styles.logoChip}>
              <Ionicons name="briefcase" size={36} color="white" />
            </View>
            <TText variant="title" weight="extraBold" color="white" align="center" style={{ marginTop: 12 }}>
              Devenir agent PAYBID
            </TText>
            <TText variant="caption" color="rgba(255,255,255,0.85)" align="center">
              Rejoignez le réseau de payeurs vérifiés
            </TText>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView style={[styles.card, { backgroundColor: paybidColors.neutrals.background }]} contentContainerStyle={styles.cardInner} keyboardShouldPersistTaps="handled">

          {/* Sélecteur type d'agent — premier choix structurant */}
          <TText variant="label" weight="extraBold" color={paybidColors.neutrals.textSecondary} style={styles.sectionTitle}>
            TYPE DE COMPTE
          </TText>
          <View style={{ gap: 10, marginBottom: spacing.lg }}>
            {AGENT_TYPES.map((opt) => {
              const active = agentType === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  testID={`paybid-type-${opt.value}`}
                  onPress={() => setAgentType(opt.value)}
                  activeOpacity={0.8}
                  style={[
                    styles.typeCard,
                    {
                      borderColor: active ? paybidColors.primary.base : paybidColors.neutrals.border,
                      backgroundColor: active ? paybidColors.overlays.primarySoft : paybidColors.neutrals.surface,
                    },
                  ]}
                >
                  <View style={[styles.typeIcon, { backgroundColor: active ? paybidColors.primary.base : paybidColors.neutrals.surface, borderColor: active ? paybidColors.primary.base : paybidColors.neutrals.border }]}>
                    <Ionicons name={opt.icon as any} size={20} color={active ? "white" : paybidColors.primary.base} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <TText weight="extraBold" color={paybidColors.neutrals.textPrimary}>{opt.label}</TText>
                    <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginTop: 2 }}>{opt.desc}</TText>
                  </View>
                  {active ? <Ionicons name="checkmark-circle" size={22} color={paybidColors.primary.base} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Informations personnelles */}
          <TText variant="label" weight="extraBold" color={paybidColors.neutrals.textSecondary} style={styles.sectionTitle}>
            INFORMATIONS PERSONNELLES
          </TText>
          <Input label="Nom complet" value={fullName} onChangeText={setFullName} icon="person-outline" />
          <Input label="Email" value={email} onChangeText={setEmail} icon="mail-outline" autoCapitalize="none" keyboardType="email-address" />

          {/* PhoneFieldSplit — indicatif + numéro */}
          <PhoneFieldSplit
            value={phone}
            onChange={setPhone}
            countryHint={country}
            onCountryAutoFilled={(iso) => setCountry(iso)}
            label="Numéro de téléphone"
            testID="paybid-signup-phone"
          />

          <Input label="Ville d'activité" value={city} onChangeText={setCity} icon="location-outline" />
          <Input
            label={`Pays ${country ? flagEmoji(country) : ""}`}
            value={country}
            onChangeText={(v) => setCountry(v.toUpperCase())}
            icon="flag-outline"
            autoCapitalize="characters"
            maxLength={2}
            placeholder="Code ISO2 (FR, SN, CM…)"
          />

          {/* Informations société (si applicable) */}
          {needsCompany ? (
            <>
              <TText variant="label" weight="extraBold" color={paybidColors.neutrals.textSecondary} style={styles.sectionTitle}>
                SOCIÉTÉ
              </TText>
              <Input
                label="Nom de la société"
                value={legalName}
                onChangeText={setLegalName}
                icon="business-outline"
                placeholder="Ex: PAYBID Cameroun SARL"
              />
              <Input
                label="Numéro d'enregistrement (RCS/SIRET) — optionnel"
                value={registrationNumber}
                onChangeText={setRegistrationNumber}
                icon="document-text-outline"
                autoCapitalize="characters"
                placeholder="Ex: RC/DLA/2024/B/12345"
              />
            </>
          ) : null}

          {/* Sélecteur Super-Agent parent (si Sub-Agent) */}
          {needsParent ? (
            <>
              <TText variant="label" weight="extraBold" color={paybidColors.neutrals.textSecondary} style={styles.sectionTitle}>
                RATTACHEMENT
              </TText>
              <TouchableOpacity
                testID="paybid-parent-picker"
                onPress={() => setParentModalOpen(true)}
                style={[styles.parentPicker, { borderColor: paybidColors.neutrals.border, backgroundColor: paybidColors.neutrals.surface }]}
                activeOpacity={0.7}
              >
                <Ionicons name="git-network-outline" size={18} color={paybidColors.primary.base} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <TText variant="label" color={paybidColors.neutrals.textSecondary}>Super-Agent parent</TText>
                  <TText weight={parentAgentLabel ? "extraBold" : "regular"} color={parentAgentLabel ? paybidColors.neutrals.textPrimary : paybidColors.neutrals.textTertiary} numberOfLines={1}>
                    {parentAgentLabel || "— Sélectionner votre Super-Agent —"}
                  </TText>
                </View>
                <Ionicons name="chevron-down" size={18} color={paybidColors.neutrals.textTertiary} />
              </TouchableOpacity>
              {superAgents.length === 0 ? (
                <TText variant="label" color={paybidColors.neutrals.textTertiary} style={{ marginTop: 6 }}>
                  Aucun Super-Agent disponible dans {country}. Essayez un autre pays ou contactez le support.
                </TText>
              ) : null}
            </>
          ) : null}

          {/* Mot de passe */}
          <TText variant="label" weight="extraBold" color={paybidColors.neutrals.textSecondary} style={styles.sectionTitle}>
            SÉCURITÉ
          </TText>
          <Input label="Mot de passe (8+ caractères)" value={password} onChangeText={setPassword} icon="lock-closed-outline" passwordToggle secureTextEntry />

          {err ? <TText variant="caption" color="#EF4444" style={{ marginVertical: 8 }}>{err}</TText> : null}

          <Button
            testID="paybid-signup-submit"
            title="Créer mon compte agent"
            icon="arrow-forward"
            onPress={submit}
            loading={loading}
            disabled={disabled}
            style={{ backgroundColor: paybidColors.primary.base }}
          />

          <View style={styles.loginRow}>
            <TText variant="caption">Déjà un compte ?  </TText>
            <TouchableOpacity testID="paybid-go-login" onPress={() => router.replace("/paybid/login" as any)}>
              <TText variant="caption" weight="extraBold" color={paybidColors.primary.base}>Se connecter</TText>
            </TouchableOpacity>
          </View>

          <View style={[styles.termsBox, { backgroundColor: paybidColors.overlays.primarySoft }]}>
            <Ionicons name="shield-checkmark-outline" size={14} color={paybidColors.primary.base} />
            <TText variant="label" color={paybidColors.neutrals.textSecondary} style={{ marginLeft: 6, flex: 1 }}>
              Votre compte sera vérifié sous 24h. KYC agent requis avant la première offre.
            </TText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de sélection du Super-Agent parent */}
      <Modal visible={parentModalOpen} animationType="slide" onRequestClose={() => setParentModalOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: paybidColors.neutrals.border }}>
            <TouchableOpacity onPress={() => setParentModalOpen(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={26} color={paybidColors.neutrals.textPrimary} />
            </TouchableOpacity>
            <TText weight="extraBold" style={{ marginLeft: 8 }} color={paybidColors.neutrals.textPrimary}>
              Sélectionner un Super-Agent
            </TText>
          </View>
          {superAgents.length === 0 ? (
            <View style={{ padding: 32, alignItems: "center" }}>
              <Ionicons name="cloud-offline-outline" size={48} color={paybidColors.neutrals.textTertiary} />
              <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginTop: 12, textAlign: "center" }}>
                Aucun Super-Agent enregistré dans {country}.
              </TText>
            </View>
          ) : (
            <FlatList
              data={superAgents}
              keyExtractor={(it) => it.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => { setParentAgentId(item.id); setParentAgentLabel(item.label); setParentModalOpen(false); }}
                  style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: paybidColors.neutrals.border }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: paybidColors.overlays.primarySoft, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="business" size={20} color={paybidColors.primary.base} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <TText weight="extraBold" color={paybidColors.neutrals.textPrimary}>{item.label}</TText>
                    <TText variant="label" color={paybidColors.neutrals.textTertiary}>
                      {item.city || "—"}{item.country ? `, ${item.country}` : ""}
                    </TText>
                  </View>
                  {item.id === parentAgentId ? <Ionicons name="checkmark-circle" size={22} color={paybidColors.primary.base} /> : null}
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  heroBody: { alignItems: "center", marginTop: spacing.md },
  logoChip: { width: 64, height: 64, borderRadius: radii.xl, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  card: { flex: 1, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, marginTop: -spacing.lg },
  cardInner: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  sectionTitle: { letterSpacing: 1, marginTop: spacing.md, marginBottom: 8 },
  typeCard: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: radii.xl, borderWidth: 1.5 },
  typeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  parentPicker: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: radii.lg, borderWidth: 1, marginBottom: 4 },
  loginRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
  termsBox: { flexDirection: "row", alignItems: "flex-start", marginTop: spacing.lg, padding: spacing.md, borderRadius: radii.lg },
});
