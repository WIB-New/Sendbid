import React, { useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Dimensions, Modal, FlatList,
  TouchableWithoutFeedback,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { api, apiError } from "../../src/api";
import { useAuth } from "../../src/store";
import { useTranslation } from "../../src/i18n";
import { useThemeColors } from "../../src/hooks/useThemeMode";
import { fontFamily } from "../../src/theme";

const { height: SCREEN_H } = Dimensions.get("window");

const COUNTRIES = [
  "France", "Cameroun", "Sénégal", "Côte d'Ivoire", "Mali", "Gabon",
  "Congo (RDC)", "Congo (Brazzaville)", "Guinée", "Burkina Faso",
  "Togo", "Bénin", "Niger", "Tchad", "Madagascar", "Belgique",
  "Suisse", "Canada", "États-Unis", "Royaume-Uni", "Allemagne",
  "Espagne", "Italie", "Maroc", "Tunisie", "Algérie",
];

const COUNTRY_DIALCODES: Record<string, string> = {
  "France": "+33",
  "Cameroun": "+237",
  "Sénégal": "+221",
  "Côte d'Ivoire": "+225",
  "Mali": "+223",
  "Gabon": "+241",
  "Congo (RDC)": "+243",
  "Congo (Brazzaville)": "+242",
  "Guinée": "+224",
  "Burkina Faso": "+226",
  "Togo": "+228",
  "Bénin": "+229",
  "Niger": "+227",
  "Tchad": "+235",
  "Madagascar": "+261",
  "Belgique": "+32",
  "Suisse": "+41",
  "Canada": "+1",
  "États-Unis": "+1",
  "Royaume-Uni": "+44",
  "Allemagne": "+49",
  "Espagne": "+34",
  "Italie": "+39",
  "Maroc": "+212",
  "Tunisie": "+216",
  "Algérie": "+213",
};

export default function SignUp() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, isDark } = useThemeColors();
  const setSession = useAuth((s) => s.setSession);

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [pwVisible, setPwVisible] = useState(false);
  const [cpwVisible, setCpwVisible] = useState(false);

  // Refs for keyboard navigation
  const firstNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const pwRef = useRef<TextInput>(null);
  const cpwRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const strength = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!lastName.trim()) errs.lastName = t("auth.errLastName");
    else if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(lastName.trim())) errs.lastName = t("auth.errLettersOnly");
    if (!firstName.trim()) errs.firstName = t("auth.errFirstName");
    else if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(firstName.trim())) errs.firstName = t("auth.errLettersOnly");
    if (!email.trim()) errs.email = t("auth.errEmailRequired");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = t("auth.errEmail");
    if (!country) errs.country = t("auth.errCountry");
    if (!phone.trim()) errs.phone = t("auth.errPhoneRequired");
    else if (!/^\+?[0-9\s]{8,}$/.test(phone.trim())) errs.phone = t("auth.errPhone");
    if (password.length < 8) errs.password = t("auth.errPasswordMin");
    else if (!/[A-Z]/.test(password)) errs.password = t("auth.errPasswordUpper");
    else if (!/[0-9]/.test(password)) errs.password = t("auth.errPasswordDigit");
    if (confirmPassword !== password) errs.confirmPassword = t("auth.errPasswordMatch");
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const canSubmit = lastName.trim() && firstName.trim() && email.trim() && country && phone.trim() && password.length >= 8 && confirmPassword === password && acceptTerms && acceptPrivacy;

  const submit = async () => {
    setErr(null);
    if (!validate()) return;
    if (!acceptTerms || !acceptPrivacy) {
      setErr(t("auth.errAcceptConditions"));
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        country,
        password,
      });
      if (data.token && data.user) {
        await setSession(data.token, data.user);
      }
      router.push({
        pathname: "/(auth)/create-pin",
        params: { user_id: data.user_id, skip_otp: "1" },
      });
    } catch (e: any) {
      setErr(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const renderField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    key: string,
    options?: {
      placeholder?: string;
      keyboardType?: any;
      autoCapitalize?: any;
      secureTextEntry?: boolean;
      toggleVisible?: boolean;
      visible?: boolean;
      onToggle?: () => void;
      ref?: any;
      nextRef?: any;
      returnKeyType?: string;
      onSubmitEditing?: () => void;
      icon?: string;
    },
  ) => (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.label, { color: colors.banner }]}>{label}</Text>
      <View style={[styles.inputBox, { borderColor: fieldErrors[key] ? colors.error : colors.border, backgroundColor: colors.inputBg }]}>
        {options?.icon && <Ionicons name={options.icon as any} size={18} color={colors.banner} style={{ marginRight: 10 }} />}
        <TextInput
          ref={options?.ref}
          style={[styles.inputText, { color: colors.textPrimary }]}
          value={value}
          onChangeText={(v) => { onChange(v); setFieldErrors((p) => ({ ...p, [key]: "" })); }}
          placeholder={options?.placeholder}
          placeholderTextColor={colors.placeholder}
          keyboardType={options?.keyboardType}
          autoCapitalize={options?.autoCapitalize ?? "sentences"}
          secureTextEntry={options?.secureTextEntry && !options?.visible}
          returnKeyType={(options?.returnKeyType as any) ?? "next"}
          onSubmitEditing={options?.onSubmitEditing ?? (() => options?.nextRef?.current?.focus())}
          blurOnSubmit={false}
        />
        {options?.toggleVisible && (
          <TouchableOpacity onPress={options.onToggle} hitSlop={10}>
            <Ionicons name={options.visible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.placeholder} />
          </TouchableOpacity>
        )}
      </View>
      {fieldErrors[key] ? <Text style={[styles.errorText, { color: colors.error }]}>{fieldErrors[key]}</Text> : null}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={colors.statusBar} translucent backgroundColor="transparent" />

      {/* Fond bleu en position absolue */}
      <View style={[styles.blueBg, { backgroundColor: colors.banner }]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          bounces={false}
        >
          {/* ===== ZONE BANDEAU ===== */}
          <View style={styles.bannerContent}>
            <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.backBtnBg }]}>
              <Ionicons name="chevron-back" size={22} color={colors.textOnBanner} />
            </TouchableOpacity>
            <Text style={[styles.brandText, { color: "#00E676" }]}>S E N D B I D</Text>
            <Text style={[styles.bannerTitle, { color: colors.textOnBanner }]}>{t("auth.signupTitle")}</Text>
            <Text style={[styles.bannerSubtitle, { color: colors.textOnBannerSub }]}>{t("auth.signupSubtitle")}</Text>
          </View>

          {/* ===== CARTE ===== */}
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {renderField(t("auth.lastName"), lastName, setLastName, "lastName", { placeholder: t("auth.lastNamePlaceholder"), nextRef: firstNameRef, icon: "person-outline" })}
            {renderField(t("auth.firstName"), firstName, setFirstName, "firstName", { placeholder: t("auth.firstNamePlaceholder"), ref: firstNameRef, nextRef: emailRef, icon: "person-outline" })}
            {renderField(t("auth.email"), email, setEmail, "email", { placeholder: t("auth.emailPlaceholder"), keyboardType: "email-address", autoCapitalize: "none", ref: emailRef, icon: "mail-outline" })}

            {/* Pays de résidence — sélecteur */}
            <View style={{ marginBottom: 16 }}>
              <Text style={[styles.label, { color: colors.banner }]}>{t("auth.countryLabel")}</Text>
              <TouchableOpacity
                style={[styles.inputBox, { borderColor: fieldErrors.country ? colors.error : colors.border, backgroundColor: colors.inputBg }]}
                onPress={() => setShowCountryPicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="globe-outline" size={18} color={colors.banner} style={{ marginRight: 10 }} />
                <Text style={country ? [styles.inputText, { color: colors.textPrimary }] : [styles.placeholderText, { color: colors.placeholder }]}>
                  {country || t("auth.countryPlaceholder")}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.placeholder} />
              </TouchableOpacity>
              {fieldErrors.country ? <Text style={[styles.errorText, { color: colors.error }]}>{fieldErrors.country}</Text> : null}
            </View>

            {renderField(t("auth.phone"), phone, setPhone, "phone", { placeholder: t("auth.phonePlaceholder"), keyboardType: "phone-pad", ref: phoneRef, nextRef: pwRef, icon: "call-outline" })}
            {renderField(t("auth.password"), password, setPassword, "password", {
              placeholder: t("auth.passwordPlaceholder"), secureTextEntry: true, toggleVisible: true,
              visible: pwVisible, onToggle: () => setPwVisible(!pwVisible),
              ref: pwRef, nextRef: cpwRef, icon: "lock-closed-outline",
            })}

            {/* Barre de force */}
            <View style={{ flexDirection: "row", gap: 4, marginBottom: 16, marginTop: -8 }}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={{
                    flex: 1, height: 4, borderRadius: 2,
                    backgroundColor: i < strength
                      ? (strength <= 2 ? "#F59E0B" : strength === 3 ? "#2E4A7A" : "#10B981")
                      : colors.border,
                  }}
                />
              ))}
            </View>

            {renderField(t("auth.confirmPassword"), confirmPassword, setConfirmPassword, "confirmPassword", {
              placeholder: t("auth.passwordPlaceholder"), secureTextEntry: true, toggleVisible: true,
              visible: cpwVisible, onToggle: () => setCpwVisible(!cpwVisible),
              ref: cpwRef, returnKeyType: "done", icon: "lock-closed-outline",
              onSubmitEditing: () => { if (canSubmit) submit(); },
            })}

            {/* Checkboxes */}
            <TouchableOpacity style={styles.checkRow} onPress={() => setAcceptTerms(!acceptTerms)} activeOpacity={0.7}>
              <View style={[styles.checkbox, { borderColor: colors.checkboxInactive }, acceptTerms && { backgroundColor: colors.checkboxActive, borderColor: colors.checkboxActive }]}>
                {acceptTerms && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </View>
              <Text style={[styles.checkText, { color: colors.textPrimary }]}>
                {t("auth.acceptTerms")} <Text style={styles.checkBold}>{t("auth.terms")}</Text>
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.checkRow} onPress={() => setAcceptPrivacy(!acceptPrivacy)} activeOpacity={0.7}>
              <View style={[styles.checkbox, { borderColor: colors.checkboxInactive }, acceptPrivacy && { backgroundColor: colors.checkboxActive, borderColor: colors.checkboxActive }]}>
                {acceptPrivacy && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </View>
              <Text style={[styles.checkText, { color: colors.textPrimary }]}>
                {t("auth.acceptPrivacy")} <Text style={styles.checkBold}>{t("auth.privacy")}</Text>
              </Text>
            </TouchableOpacity>

            {err ? <Text style={[styles.errorText, { color: colors.error, marginTop: 8 }]}>{err}</Text> : null}

            {/* Bouton Continuer */}
            <TouchableOpacity
              testID="signup-submit"
              style={[styles.btn, { backgroundColor: colors.button, opacity: canSubmit && !loading ? 1 : 0.5 }]}
              onPress={submit}
              disabled={!canSubmit || loading}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnText, { color: colors.buttonText }]}>
                {loading ? t("common.loading") : t("common.continue")}
              </Text>
            </TouchableOpacity>

            {/* Lien connexion */}
            <View style={styles.loginRow}>
              <Text style={[styles.loginText, { color: colors.linkSecondary }]}>{t("auth.hasAccount")} </Text>
              <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
                <Text style={[styles.loginLink, { color: colors.link }]}>{t("auth.login")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal sélection pays */}
      <Modal visible={showCountryPicker} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setShowCountryPicker(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t("auth.selectCountry")}</Text>
                  <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                    <Ionicons name="close" size={24} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={COUNTRIES}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.countryItem, { borderBottomColor: isDark ? colors.border : "#F3F4F6" }, country === item && { backgroundColor: isDark ? colors.banner : "#E6ECF8" }]}
                      onPress={() => {
                        setCountry(item);
                        setFieldErrors((p) => ({ ...p, country: "" }));
                        setShowCountryPicker(false);
                        const dialCode = COUNTRY_DIALCODES[item];
                        if (dialCode) setPhone(dialCode + " ");
                      }}
                    >
                      <Text style={[styles.countryText, { color: colors.textPrimary }, country === item && { fontWeight: "700" }]}>{item}</Text>
                      {country === item && <Ionicons name="checkmark" size={18} color={colors.checkboxActive} />}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const BANNER_H = 180;

const styles = StyleSheet.create({
  container: { flex: 1 },

  blueBg: { position: "absolute", top: 0, left: 0, right: 0, height: BANNER_H + 40 },
  scrollContent: { flexGrow: 1 },

  bannerContent: {
    height: BANNER_H,
    paddingTop: Platform.OS === "ios" ? 56 : 44,
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  brandText: { fontSize: 14, fontFamily: fontFamily.openSansBold, letterSpacing: 3 },
  bannerTitle: { fontSize: 22, fontFamily: fontFamily.openSansBold, marginTop: 8 },
  bannerSubtitle: { fontSize: 14, fontFamily: fontFamily.openSansRegular, marginTop: 4 },

  card: {
    flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 5,
    minHeight: SCREEN_H * 0.65,
  },

  label: { fontSize: 12, fontFamily: fontFamily.openSansMedium, marginBottom: 4 },
  inputBox: {
    height: 48, borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, flexDirection: "row", alignItems: "center",
  },
  inputText: { flex: 1, fontSize: 16, fontFamily: fontFamily.openSansRegular },
  placeholderText: { flex: 1, fontSize: 16, fontFamily: fontFamily.openSansRegular },
  errorText: { fontSize: 10, fontFamily: fontFamily.openSansRegular, marginTop: 4 },

  checkRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8, gap: 8 },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  checkText: { flex: 1, fontSize: 12, fontFamily: fontFamily.openSansRegular, lineHeight: 18 },
  checkBold: { fontFamily: fontFamily.openSansBold },

  btn: {
    height: 52, borderRadius: 12,
    alignItems: "center", justifyContent: "center", marginTop: 24,
  },
  btnText: { fontSize: 16, fontFamily: fontFamily.openSansSemiBold },

  loginRow: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
  loginText: { fontSize: 14, fontFamily: fontFamily.openSansRegular },
  loginLink: { fontSize: 14, fontFamily: fontFamily.openSansBold, textDecorationLine: "underline" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: SCREEN_H * 0.6, paddingBottom: 32 },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontFamily: fontFamily.openSansBold },
  countryItem: {
    paddingHorizontal: 20, paddingVertical: 14,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderBottomWidth: 1,
  },
  countryText: { fontSize: 16, fontFamily: fontFamily.openSansRegular },
});
