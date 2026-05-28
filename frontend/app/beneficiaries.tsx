import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../src/components/TText";
import { Button } from "../src/components/Button";
import { api } from "../src/api";
import { colors, spacing, radii } from "../src/theme";

// Bénéficiaires v4.0 — "25 Bénéficiaires" : header navy + search + filtres pays + favoris en haut + liste cartes
export default function Beneficiaries() {
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/beneficiaries");
      setList(r.data || []);
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const countries = Array.from(new Set(list.map((b) => b.country))).filter(Boolean).sort();
  const filtered = list.filter((b) =>
    (!query || b.full_name.toLowerCase().includes(query.toLowerCase())) &&
    (!country || b.country === country)
  );
  const favs = filtered.filter((b) => b.favorite);
  const others = filtered.filter((b) => !b.favorite);

  const toggleFav = async (b: any) => {
    try {
      await api.post(`/beneficiaries/${b.id}/toggle-favorite`);
      load();
    } catch (e: any) { Alert.alert("Erreur", e?.message || ""); }
  };
  const remove = (b: any) => {
    Alert.alert(b.full_name, "Supprimer ce bénéficiaire ?", [
      { text: "Annuler" },
      { text: "Supprimer", style: "destructive", onPress: async () => { await api.delete(`/beneficiaries/${b.id}`); load(); } },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0F1B40" }}>
      <LinearGradient colors={["#0F1B40", "#1B2A5B"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </TouchableOpacity>
            <TText variant="body" weight="extraBold" color="white">Bénéficiaires</TText>
            <TouchableOpacity testID="ben-add" onPress={() => router.push("/beneficiaries/add" as any)} style={styles.iconBtn}>
              <Ionicons name="add" size={20} color="white" />
            </TouchableOpacity>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.6)" />
            <TextInput placeholder="Rechercher un bénéficiaire…" placeholderTextColor="rgba(255,255,255,0.5)" value={query} onChangeText={setQuery} style={styles.searchInput} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.card} contentContainerStyle={styles.cardInner} showsVerticalScrollIndicator={false}>
        {/* Country filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
          <TouchableOpacity onPress={() => setCountry(null)} style={[styles.chip, !country && styles.chipActive]}>
            <TText variant="caption" weight="extraBold" color={!country ? "white" : colors.neutrals.textPrimary}>Tous</TText>
          </TouchableOpacity>
          {countries.map((c) => (
            <TouchableOpacity key={c} onPress={() => setCountry(c)} style={[styles.chip, country === c && styles.chipActive]}>
              <TText variant="caption" weight="extraBold" color={country === c ? "white" : colors.neutrals.textPrimary}>{c}</TText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {favs.length > 0 ? (
          <>
            <TText variant="label" weight="extraBold" color="#F59E0B" style={styles.secTitle}>★  FAVORIS</TText>
            <View style={styles.listBox}>
              {favs.map((b, i) => (
                <BenRow key={b.id} b={b} last={i === favs.length - 1} onSend={() => router.push({ pathname: "/transfer/new", params: { beneficiary_id: b.id } } as any)} onFav={() => toggleFav(b)} onDelete={() => remove(b)} />
              ))}
            </View>
          </>
        ) : null}

        <TText variant="label" weight="extraBold" color={colors.neutrals.textSecondary} style={styles.secTitle}>
          TOUS ({others.length})
        </TText>
        <View style={styles.listBox}>
          {others.length === 0 ? (
            <View style={{ padding: spacing.xl, alignItems: "center" }}>
              <Ionicons name="people-outline" size={32} color={colors.neutrals.textTertiary} />
              <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 6 }}>Aucun bénéficiaire</TText>
              <Button title="Ajouter un bénéficiaire" icon="add" variant="outline" onPress={() => router.push("/beneficiaries/add" as any)} style={{ marginTop: 12 }} />
            </View>
          ) : others.map((b, i) => (
            <BenRow key={b.id} b={b} last={i === others.length - 1} onSend={() => router.push({ pathname: "/transfer/new", params: { beneficiary_id: b.id } } as any)} onFav={() => toggleFav(b)} onDelete={() => remove(b)} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function BenRow({ b, last, onSend, onFav, onDelete }: any) {
  const router = useRouter();
  const modeIcon: any = { cash: "cash", bank: "business", momo: "phone-portrait", wallet: "wallet", card: "card" }[b.default_delivery_mode || "cash"] || "cash";
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: "/beneficiaries/[id]" as any, params: { id: b.id } })}
      style={[styles.brow, !last && { borderBottomWidth: 1, borderBottomColor: colors.neutrals.border }]}
    >
      <View style={styles.avatar}>
        <TText variant="body" weight="extraBold" color="white">{(b.full_name || "?").charAt(0).toUpperCase()}</TText>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <TText variant="body" weight="extraBold">{b.full_name}</TText>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
          <TText variant="label" color={colors.neutrals.textSecondary}>{b.country}</TText>
          <TText variant="label" color={colors.neutrals.textTertiary}> · </TText>
          <Ionicons name={modeIcon} size={11} color={colors.neutrals.textSecondary} />
          <TText variant="label" color={colors.neutrals.textSecondary} style={{ marginLeft: 3 }}>{String(b.default_delivery_mode || "cash").toUpperCase()}</TText>
        </View>
      </View>
      <TouchableOpacity onPress={onFav} style={styles.roundBtn}>
        <Ionicons name={b.favorite ? "star" : "star-outline"} size={18} color={b.favorite ? "#F59E0B" : colors.neutrals.textTertiary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onSend} style={[styles.roundBtn, { backgroundColor: colors.primary.base }]}>
        <Ionicons name="paper-plane" size={16} color="white" />
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} style={styles.roundBtn}>
        <Ionicons name="trash-outline" size={16} color="#EF4444" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: radii.full, paddingHorizontal: 14, paddingVertical: 10, marginTop: spacing.md, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  searchInput: { flex: 1, color: "white", marginLeft: 8, fontSize: 14, outlineStyle: "none" } as any,
  card: { flex: 1, backgroundColor: colors.neutrals.background, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, marginTop: -spacing.lg },
  cardInner: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.full, backgroundColor: colors.neutrals.surface, borderWidth: 1, borderColor: colors.neutrals.border, marginRight: 8 },
  chipActive: { backgroundColor: colors.primary.base, borderColor: colors.primary.base },
  secTitle: { letterSpacing: 1, marginTop: spacing.lg, marginBottom: 8, marginLeft: 4 },
  listBox: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border },
  brow: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: 6 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center" },
  roundBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.neutrals.background, borderWidth: 1, borderColor: colors.neutrals.border },
});
