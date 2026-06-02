import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radii } from "../theme";
import { useThemeTokens } from "../themeContext";
import { TText } from "./TText";
import { SendBidLogo } from "./Logo";

type Props = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
  scroll?: boolean;
  bg?: string;
  contentStyle?: any;
  /** Affiche un hero dégradé bleu impérial derrière le titre. */
  hero?: boolean;
  heroColors?: [string, string, ...string[]];
  /** Désactive KeyboardAvoidingView si nécessaire (rarement utile). */
  noKeyboardAvoid?: boolean;
  /** Inclut l'inset bas (utile hors-tabs). Par défaut true. */
  bottomInset?: boolean;
  /** Permet de fermer le clavier en tapant en dehors d'un champ. */
  dismissKeyboardOnTap?: boolean;
};

/**
 * Écran de base SendBID / PayBID.
 * - SafeArea (top, left, right + bottom optionnel)
 * - KeyboardAvoidingView (iOS padding / Android height)
 * - ScrollView avec keyboardShouldPersistTaps="handled" + dismiss on drag
 * - Hero gradient en option, header back/title/right.
 */
export function Screen({
  children,
  title,
  subtitle,
  back,
  right,
  scroll = true,
  bg,
  contentStyle,
  hero = false,
  heroColors,
  noKeyboardAvoid = false,
  bottomInset = true,
  dismissKeyboardOnTap = true,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tokens, isDark } = useThemeTokens();

  // Offset Android pour la status bar quand le clavier monte.
  const kbOffset = Platform.select({ ios: 0, android: 0 }) as number;
  const kbBehavior = Platform.OS === "ios" ? ("padding" as const) : ("height" as const);

  // Padding bas dynamique : safe area + gutter raisonnable.
  // 100px ≥ hauteur typique d'un tab bar (80) + marge respiratoire, garantissant
  // qu'aucun contenu n'est masqué par la barre d'onglets ou la barre système.
  const bottomPad = (bottomInset ? Math.max(insets.bottom, 8) : 0) + 100;

  const HeaderRow = (
    <View style={styles.header}>
      <View style={{ width: 40 }}>
        {back && (
          <TouchableOpacity
            testID="header-back"
            onPress={() => router.back()}
            hitSlop={10}
            style={[styles.backBtn, hero && styles.backBtnHero]}
          >
            <Ionicons name="chevron-back" size={24} color={hero ? "white" : tokens.neutrals.textPrimary} />
          </TouchableOpacity>
        )}
      </View>
      <View style={{ flex: 1, alignItems: "center" }}>
        {title ? (
          <TText variant="subtitle" weight="bold" align="center" color={hero ? "white" : tokens.neutrals.textPrimary}>
            {title}
          </TText>
        ) : null}
        {hero && subtitle ? (
          <TText variant="caption" color="rgba(255,255,255,0.75)" align="center" style={{ marginTop: 2 }}>
            {subtitle}
          </TText>
        ) : null}
      </View>
      <View style={{ width: 40, alignItems: "flex-end" }}>{right || <SendBidLogo size={32} />}</View>
    </View>
  );

  // Body (scroll ou static), enveloppé pour gérer clavier + tap-to-dismiss.
  const Body = (
    <>
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            { padding: spacing.lg, paddingTop: hero ? spacing.lg : undefined, paddingBottom: bottomPad },
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          // @ts-ignore — disponible iOS 13+
          automaticallyAdjustKeyboardInsets
          contentInsetAdjustmentBehavior="automatic"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: spacing.lg, paddingBottom: bottomInset ? bottomPad : spacing.lg }, contentStyle]}>
          {children}
        </View>
      )}
    </>
  );

  const KeyboardWrapper = noKeyboardAvoid
    ? ({ children: c }: { children: React.ReactNode }) => <View style={{ flex: 1 }}>{c}</View>
    : ({ children: c }: { children: React.ReactNode }) => (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={kbBehavior} keyboardVerticalOffset={kbOffset}>
          {c}
        </KeyboardAvoidingView>
      );

  const DismissWrapper = ({ children: c }: { children: React.ReactNode }) =>
    dismissKeyboardOnTap && Platform.OS !== "web" ? (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>{c}</View>
      </TouchableWithoutFeedback>
    ) : (
      <View style={{ flex: 1 }}>{c}</View>
    );

  if (hero) {
    return (
      <View style={{ flex: 1, backgroundColor: bg || tokens.neutrals.background }}>
        <LinearGradient
          colors={heroColors || (tokens.gradients.imperial as any)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBand}
        >
          <SafeAreaView edges={["top", "left", "right"]}>{HeaderRow}</SafeAreaView>
        </LinearGradient>
        <KeyboardWrapper>
          <DismissWrapper>{Body}</DismissWrapper>
        </KeyboardWrapper>
      </View>
    );
  }

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: bg || tokens.neutrals.background }}
    >
      {(title || back || right) && HeaderRow}
      <KeyboardWrapper>
        <DismissWrapper>{Body}</DismissWrapper>
      </KeyboardWrapper>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutrals.surface,
    borderWidth: 1,
    borderColor: colors.neutrals.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnHero: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.24)",
  },
  heroBand: {
    paddingBottom: spacing.md,
    borderBottomLeftRadius: radii.xxl,
    borderBottomRightRadius: radii.xxl,
  },
});
