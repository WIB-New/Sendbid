import React from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radii } from "../theme";
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
};

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
}: Props) {
  const router = useRouter();

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
            <Ionicons name="chevron-back" size={24} color={hero ? "white" : colors.neutrals.textPrimary} />
          </TouchableOpacity>
        )}
      </View>
      <View style={{ flex: 1, alignItems: "center" }}>
        {title ? (
          <TText variant="subtitle" weight="bold" align="center" color={hero ? "white" : colors.neutrals.textPrimary}>
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

  if (hero) {
    return (
      <View style={{ flex: 1, backgroundColor: bg || colors.neutrals.background }}>
        <LinearGradient
          colors={heroColors || (colors.gradients.imperial as any)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBand}
        >
          <SafeAreaView edges={["top", "left", "right"]}>{HeaderRow}</SafeAreaView>
        </LinearGradient>
        {scroll ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              { padding: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
              contentStyle,
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1, padding: spacing.lg }, contentStyle]}>{children}</View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: bg || colors.neutrals.background }}>
      {(title || back || right) && HeaderRow}
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[{ padding: spacing.lg, paddingBottom: spacing.xxxl }, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: spacing.lg }, contentStyle]}>{children}</View>
      )}
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
