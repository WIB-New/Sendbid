import React, { useEffect, useState } from "react";
import { View, StyleSheet, Alert, Platform, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { api } from "../../src/api";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
export default function BeneficiaryDetail() {
  const colors = useThemedColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [b, setB] = useState<any>(null);
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [full_name, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [relation, setRelation] = useState("");

  useEffect(() => {
    api.get(`/beneficiaries/${id}`)
      .then((r) => {
        setB(r.data);
        setFullName(r.data?.full_name || "");
        setPhone(r.data?.phone || "");
        setEmail(r.data?.email || "");
        setCity(r.data?.city || "");
        setRelation(r.data?.relation || "");
      })
      .catch(() => Alert.alert("Erreur", "Impossible de charger le bénéficiaire"));
  }, [id]);

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/beneficiaries/${id}`, { full_name, phone, email, city, relation });
      const r = await api.get(`/beneficiaries/${id}`);
      setB(r.data);
      setEdit(false);
    } catch (e: any) {
      Alert.alert("Erreur", e?.response?.data?.detail || "Échec de la mise à jour");
    } finally { setBusy(false); }
  };

  const remove = () => {
    const exec = async () => {
      try {
        await api.delete(`/beneficiaries/${id}`);
        router.back();
      } catch (e: any) {
        Alert.alert("Erreur", e?.response?.data?.detail || "Échec de la suppression");
      }
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && (window as any).confirm("Supprimer ce bénéficiaire définitivement ?")) exec();
      return;
    }
    Alert.alert("Supprimer", "Supprimer ce bénéficiaire ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: exec },
    ]);
  };

  if (!b) return <Screen title="Bénéficiaire" back><TText>Chargement…</TText></Screen>;

  return (
    <Screen title={b.full_name} back>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <View style={styles.heroCard}>
          <View style={styles.avatar}>
            <TText variant="title" weight="extraBold" color="white">{(b.full_name || "?").charAt(0).toUpperCase()}</TText>
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <TText variant="subtitle" weight="extraBold">{b.full_name}</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary}>
              {b.country}{b.city ? ` · ${b.city}` : ""}{b.relation ? ` · ${b.relation}` : ""}
            </TText>
            <TText variant="label" color={colors.neutrals.textTertiary} style={{ marginTop: 2 }}>
              Mode par défaut : {String(b.default_delivery_mode || "cash").toUpperCase()}
            </TText>
          </View>
        </View>

        <View style={styles.card}>
          <TText variant="caption" weight="extraBold" color={colors.neutrals.textSecondary} style={{ letterSpacing: 0.8, marginBottom: 8 }}>
            COORDONNÉES
          </TText>
          {edit ? (
            <>
              <Input value={full_name} onChangeText={setFullName} placeholder="Nom complet" icon="person-outline" />
              <Input value={phone} onChangeText={setPhone} placeholder="Téléphone" icon="call-outline" keyboardType="phone-pad" />
              <Input value={email} onChangeText={setEmail} placeholder="Email" icon="mail-outline" keyboardType="email-address" autoCapitalize="none" />
              <Input value={city} onChangeText={setCity} placeholder="Ville" icon="location-outline" />
              <Input value={relation} onChangeText={setRelation} placeholder="Relation (famille, ami…)" icon="people-outline" />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                <Button title="Annuler" variant="outline" onPress={() => setEdit(false)} style={{ flex: 1 }} />
                <Button title={busy ? "…" : "Enregistrer"} icon="checkmark" onPress={save} disabled={busy} style={{ flex: 1 }} />
              </View>
            </>
          ) : (
            <>
              <DetailRow icon="call-outline" label="Téléphone" value={b.phone || "—"} />
              <DetailRow icon="mail-outline" label="Email" value={b.email || "—"} />
              <DetailRow icon="location-outline" label="Ville" value={b.city || "—"} />
              <DetailRow icon="people-outline" label="Relation" value={b.relation || "—"} last />
            </>
          )}
        </View>

        {!edit ? (
          <View style={{ gap: 8, marginTop: spacing.lg }}>
            <Button title="Modifier" icon="create-outline" variant="outline" onPress={() => setEdit(true)} />
            <Button title="Envoyer de l'argent" icon="paper-plane" onPress={() => router.push({ pathname: "/transfer/new", params: { beneficiary_id: b.id } } as any)} />
            <Button title="Supprimer" icon="trash-outline" variant="danger" onPress={remove} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function DetailRow({ icon, label, value, last }: { icon: any; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Ionicons name={icon} size={18} color={colors.primary.base} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <TText variant="label" color={colors.neutrals.textSecondary}>{label}</TText>
        <TText variant="body" weight="semiBold">{value}</TText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.overlays.primarySoft, borderRadius: radii.xl, padding: spacing.md, marginBottom: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: "white", borderRadius: radii.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.neutrals.border },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
});
