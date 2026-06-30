import React, { useState, useCallback } from "react";
import { useTranslation } from "../../../src/i18n";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { TText } from "../../../src/components/TText";
import { Button } from "../../../src/components/Button";
import { api, apiError } from "../../../src/api";
import { useAuth } from "../../../src/store";
import { paybidColors, paybidFontFamily } from "../../../src/paybidTheme";
import { spacing, radii, shadows } from "../../../src/theme";
import { useTranslation } from "../../../src/i18n";

interface FinancialSummary {
  gains: number;
  capital: number;
  toPayHQ: number;
  encours: number;
  balance: number;
  monthlyEarnings: number;
}

interface EncoursItem {
  id: string;
  amount: number;
  reason: string;
  dueDate: string;
  status: "active" | "settled";
  createdAt: string;
}

export default function AccountPage() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const [summary, setSummary] = useState<FinancialSummary>({
    gains: 0,
    capital: 0,
    toPayHQ: 0,
    encours: 0,
    balance: 0,
    monthlyEarnings: 0,
  });
  const [encoursList, setEncoursList] = useState<EncoursItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<"encours" | "withdraw" | "deposit" | "payhq" | null>(null);
  
  // Form encours
  const [encoursAmount, setEncoursAmount] = useState("");
  const [encoursReason, setEncoursReason] = useState("");
  const [encoursDueDate, setEncoursDueDate] = useState("");
  const [encoursPin, setEncoursPin] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadFinancialData();
    }, [])
  );

  const loadFinancialData = async () => {
    try {
      // Simulation - en production: appel API réel
      // const { data } = await api.get("/agent/financial-summary");
      setSummary({
        gains: 1250000,
        capital: 5000000,
        toPayHQ: 450000,
        encours: 300000,
        balance: 875000,
        monthlyEarnings: 320000,
      });
      
      setEncoursList([
        { id: "ENC_001", amount: 150000, reason: "Avance matériel", dueDate: "2026-07-15", status: "active", createdAt: "2026-06-01" },
        { id: "ENC_002", amount: 150000, reason: "Prêt opérationnel", dueDate: "2026-08-01", status: "active", createdAt: "2026-06-10" },
      ]);
    } catch (e) {
      console.error("Failed to load financial data", e);
    }
  };

  const openModal = (type: typeof modalType) => {
    setModalType(type);
    setModalVisible(true);
    setEncoursAmount("");
    setEncoursReason("");
    setEncoursDueDate("");
    setEncoursPin("");
  };

  const closeModal = () => {
    setModalVisible(false);
    setModalType(null);
  };

  const getAlertColor = (amount: number) => {
    if (amount < 50000) return "#4CAF50"; // Vert
    if (amount < 100000) return "#FF9800"; // Orange
    return "#F44336"; // Rouge
  };

  const renderIndicatorCard = (
    title: string,
    value: number,
    icon: string,
    color: string,
    subtitle: string,
    onPress?: () => void
  ) => (
    <TouchableOpacity
      style={[styles.indicatorCard, { borderLeftColor: color, borderLeftWidth: 4 }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.indicatorHeader}>
        <View style={[styles.indicatorIcon, { backgroundColor: color + "20" }]}>
          <Ionicons name={icon as any} size={24} color={color} />
        </View>
        <TText style={styles.indicatorTitle}>{title}</TText>
      </View>
      <TText style={[styles.indicatorValue, { color }]}>
        {value.toLocaleString()} XAF
      </TText>
      <TText style={styles.indicatorSubtitle}>{subtitle}</TText>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TText style={styles.headerTitle}>Mon Compte</TText>
        <TText style={styles.headerSubtitle}>Gestion financière</TText>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Solde principal */}
        <LinearGradient
          colors={[paybidColors.primary.base, paybidColors.primary.dark]}
          style={styles.balanceCard}
        >
          <TText style={styles.balanceLabel}>Solde disponible</TText>
          <TText style={styles.balanceValue}>{summary.balance.toLocaleString()} XAF</TText>
          <TText style={styles.balanceEur}>
            ≈ {(summary.balance / 655.957).toFixed(2)} EUR
          </TText>
          <TText style={styles.monthlyEarnings}>
            +{summary.monthlyEarnings.toLocaleString()} XAF ce mois
          </TText>
        </LinearGradient>

        {/* Boutons rapides */}
        <View style={styles.quickActions}>
          <Button
            title="Retirer"
            onPress={() => openModal("withdraw")}
            variant="outline"
            style={[styles.quickButton, styles.withdrawButton]}
            icon="arrow-down"
          />
          <Button
            title="Recharger"
            onPress={() => openModal("deposit")}
            variant="outline"
            style={[styles.quickButton, styles.depositButton]}
            icon="arrow-up"
          />
          <Button
            title="Verser siège"
            onPress={() => openModal("payhq")}
            variant="outline"
            style={[styles.quickButton, styles.payhqButton]}
            icon="business"
          />
        </View>

        {/* 4 Indicateurs */}
        <TText style={styles.sectionTitle}>Indicateurs financiers</TText>
        
        <View style={styles.indicatorsGrid}>
          {renderIndicatorCard(
            "GAINS",
            summary.gains,
            "trending-up",
            "#4CAF50",
            "Profit net réalisé (Commissions - Frais)",
            () => openModal("withdraw")
          )}
          
          {renderIndicatorCard(
            "CAPITAL",
            summary.capital,
            "wallet",
            "#2196F3",
            "Working capital investi"
          )}
          
          {renderIndicatorCard(
            "À VERSER SIÈGE",
            summary.toPayHQ,
            "business",
            getAlertColor(summary.toPayHQ),
            "Dette envers SendBID",
            () => openModal("payhq")
          )}
          
          {renderIndicatorCard(
            "ENCOURS",
            summary.encours,
            "time",
            summary.encours > 0 ? "#FF9800" : "#4CAF50",
            "Dettes personnelles à solder",
            () => openModal("encours")
          )}
        </View>

        {/* Alertes */}
        {summary.toPayHQ > 100000 && (
          <View style={[styles.alertBox, { backgroundColor: "#FFEBEE" }]}>
            <Ionicons name="warning" size={24} color="#F44336" />
            <TText style={[styles.alertText, { color: "#C62828" }]}>
              Attention : Votre dette envers le siège dépasse 100,000 XAF. Risque de blocage des fonctionnalités.
            </TText>
          </View>
        )}

        {/* Liste encours actifs */}
        {encoursList.filter(e => e.status === "active").length > 0 && (
          <View style={styles.encoursSection}>
            <TText style={styles.sectionTitle}>Encours actifs ({encoursList.filter(e => e.status === "active").length})</TText>
            {encoursList
              .filter(e => e.status === "active")
              .map(encours => (
                <View key={encours.id} style={styles.encoursItem}>
                  <View style={styles.encoursLeft}>
                    <Ionicons name="time" size={24} color="#FF9800" />
                    <View>
                      <TText style={styles.encoursReason}>{encours.reason}</TText>
                      <TText style={styles.encoursDate}>Échéance: {encours.dueDate}</TText>
                    </View>
                  </View>
                  <TText style={styles.encoursAmount}>
                    {encours.amount.toLocaleString()} XAF
                  </TText>
                </View>
              ))}
          </View>
        )}
      </ScrollView>

      {/* Modal Encours */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible && modalType === "encours"}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TText style={styles.modalTitle}>Gestion des Encours</TText>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={paybidColors.neutrals.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Liste encours */}
              <TText style={styles.modalSectionTitle}>Encours actifs</TText>
              {encoursList.filter(e => e.status === "active").length === 0 ? (
                <TText style={styles.emptyText}>Aucun encours actif</TText>
              ) : (
                encoursList
                  .filter(e => e.status === "active")
                  .map(encours => (
                    <View key={encours.id} style={styles.encoursModalItem}>
                      <View>
                        <TText style={styles.encoursModalReason}>{encours.reason}</TText>
                        <TText style={styles.encoursModalDate}>Échéance: {encours.dueDate}</TText>
                      </View>
                      <View style={styles.encoursModalRight}>
                        <TText style={styles.encoursModalAmount}>
                          {encours.amount.toLocaleString()} XAF
                        </TText>
                        <Button
                          title="Solder"
                          onPress={() => Alert.alert("Solder", `Solder l'encours ${encours.id}?`)}
                          variant="primary"
                          style={styles.settleButton}
                        />
                      </View>
                    </View>
                  ))
              )}

              {/* Créer nouvel encours */}
              <TText style={styles.modalSectionTitle}>Créer un encours</TText>
              <TextInput
                style={styles.input}
                placeholder="Montant (XAF)"
                keyboardType="numeric"
                value={encoursAmount}
                onChangeText={setEncoursAmount}
              />
              <TextInput
                style={styles.input}
                placeholder="Motif"
                value={encoursReason}
                onChangeText={setEncoursReason}
              />
              <TextInput
                style={styles.input}
                placeholder="Date d'échéance (YYYY-MM-DD)"
                value={encoursDueDate}
                onChangeText={setEncoursDueDate}
              />
              <TextInput
                style={styles.input}
                placeholder="Votre PIN (6 chiffres)"
                keyboardType="numeric"
                maxLength={6}
                secureTextEntry
                value={encoursPin}
                onChangeText={setEncoursPin}
              />
              <Button
                title="Créer l'encours"
                onPress={() => Alert.alert("Créer", "Nouvel encours créé")}
                variant="primary"
                style={styles.createButton}
                disabled={!encoursAmount || !encoursReason || !encoursDueDate || encoursPin.length !== 6}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal simple pour Retirer/Recharger/Verser Siège */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible && modalType !== "encours" && modalType !== null}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TText style={styles.modalTitle}>
                {modalType === "withdraw" && "Retirer des fonds"}
                {modalType === "deposit" && "Recharger le compte"}
                {modalType === "payhq" && "Verser au siège"}
              </TText>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={paybidColors.neutrals.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                style={styles.input}
                placeholder="Montant (XAF)"
                keyboardType="numeric"
              />
              <TextInput
                style={styles.input}
                placeholder="Votre PIN (6 chiffres)"
                keyboardType="numeric"
                maxLength={6}
                secureTextEntry
              />
              <Button
                title="Confirmer"
                onPress={() => Alert.alert("Succès", "Opération effectuée")}
                variant="primary"
                style={styles.confirmButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: paybidColors.neutrals.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: paybidColors.neutrals.border,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: paybidFontFamily.bold,
    color: paybidColors.neutrals.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: paybidFontFamily.regular,
    color: paybidColors.neutrals.textSecondary,
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  // Balance Card
  balanceCard: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    ...shadows.lg,
  },
  balanceLabel: {
    fontSize: 14,
    fontFamily: paybidFontFamily.medium,
    color: "rgba(255,255,255,0.8)",
  },
  balanceValue: {
    fontSize: 32,
    fontFamily: paybidFontFamily.bold,
    color: "#FFFFFF",
    marginTop: spacing.sm,
  },
  balanceEur: {
    fontSize: 16,
    fontFamily: paybidFontFamily.regular,
    color: "rgba(255,255,255,0.7)",
    marginTop: spacing.xs,
  },
  monthlyEarnings: {
    fontSize: 14,
    fontFamily: paybidFontFamily.medium,
    color: "#4CAF50",
    marginTop: spacing.md,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    alignSelf: "flex-start",
  },
  // Quick Actions
  quickActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  quickButton: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  withdrawButton: {
    borderColor: "#F44336",
  },
  depositButton: {
    borderColor: "#4CAF50",
  },
  payhqButton: {
    borderColor: paybidColors.primary.base,
  },
  // Section Title
  sectionTitle: {
    fontSize: 18,
    fontFamily: paybidFontFamily.bold,
    color: paybidColors.neutrals.textPrimary,
    marginTop: spacing.md,
  },
  // Indicators Grid
  indicatorsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  indicatorCard: {
    width: "47%",
    backgroundColor: paybidColors.neutrals.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  indicatorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  indicatorIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  indicatorTitle: {
    fontSize: 12,
    fontFamily: paybidFontFamily.bold,
    color: paybidColors.neutrals.textSecondary,
    textTransform: "uppercase",
  },
  indicatorValue: {
    fontSize: 18,
    fontFamily: paybidFontFamily.bold,
    marginTop: spacing.xs,
  },
  indicatorSubtitle: {
    fontSize: 11,
    fontFamily: paybidFontFamily.regular,
    color: paybidColors.neutrals.textTertiary,
    marginTop: spacing.xs,
  },
  // Alert Box
  alertBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.md,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    fontFamily: paybidFontFamily.medium,
  },
  // Encours Section
  encoursSection: {
    marginTop: spacing.md,
  },
  encoursItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: paybidColors.neutrals.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.sm,
    ...shadows.sm,
  },
  encoursLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  encoursReason: {
    fontSize: 14,
    fontFamily: paybidFontFamily.medium,
    color: paybidColors.neutrals.textPrimary,
  },
  encoursDate: {
    fontSize: 12,
    fontFamily: paybidFontFamily.regular,
    color: paybidColors.neutrals.textTertiary,
  },
  encoursAmount: {
    fontSize: 14,
    fontFamily: paybidFontFamily.bold,
    color: "#FF9800",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: paybidColors.neutrals.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: paybidColors.neutrals.border,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: paybidFontFamily.bold,
    color: paybidColors.neutrals.textPrimary,
  },
  modalBody: {
    padding: spacing.lg,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontFamily: paybidFontFamily.bold,
    color: paybidColors.neutrals.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: paybidFontFamily.regular,
    color: paybidColors.neutrals.textTertiary,
    textAlign: "center",
    paddingVertical: spacing.xl,
  },
  // Encours Modal
  encoursModalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: paybidColors.neutrals.background,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  encoursModalReason: {
    fontSize: 14,
    fontFamily: paybidFontFamily.medium,
    color: paybidColors.neutrals.textPrimary,
  },
  encoursModalDate: {
    fontSize: 12,
    fontFamily: paybidFontFamily.regular,
    color: paybidColors.neutrals.textSecondary,
    marginTop: spacing.xs,
  },
  encoursModalRight: {
    alignItems: "flex-end",
  },
  encoursModalAmount: {
    fontSize: 14,
    fontFamily: paybidFontFamily.bold,
    color: "#FF9800",
    marginBottom: spacing.sm,
  },
  settleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  // Inputs
  input: {
    backgroundColor: paybidColors.neutrals.background,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    fontSize: 16,
    fontFamily: paybidFontFamily.regular,
    color: paybidColors.neutrals.textPrimary,
    borderWidth: 1,
    borderColor: paybidColors.neutrals.border,
  },
  createButton: {
    marginTop: spacing.md,
  },
  confirmButton: {
    marginTop: spacing.lg,
  },
});
