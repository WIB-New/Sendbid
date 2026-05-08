import React from "react";
import { Text, TextProps } from "react-native";
import { colors, fontFamily, fontSize } from "../theme";

type Variant = "display" | "title" | "subtitle" | "body" | "caption" | "label";
type Weight = "regular" | "medium" | "semiBold" | "bold" | "extraBold";

type Props = TextProps & {
  variant?: Variant;
  weight?: Weight;
  color?: string;
  align?: "left" | "center" | "right";
  /** Force serif (Playfair) on body/caption variants if needed */
  serif?: boolean;
};

const sizeMap: Record<Variant, number> = {
  display: fontSize.display,
  title: fontSize.xxl,
  subtitle: fontSize.lg,
  body: fontSize.base,
  caption: fontSize.sm,
  label: fontSize.xs,
};

// By default display + title use Playfair Display (imperial feel).
// All other variants use Montserrat for clean readability.
function pickFamily(variant: Variant, weight: Weight, serif?: boolean): string {
  const isHeadline = serif === true || variant === "display" || variant === "title";
  if (!isHeadline) return fontFamily[weight];
  if (weight === "extraBold") return fontFamily.serifBlack;
  if (weight === "bold") return fontFamily.serifExtraBold;
  if (weight === "semiBold") return fontFamily.serifBold;
  if (weight === "medium") return fontFamily.serifSemiBold;
  return fontFamily.serifRegular;
}

export function TText({ variant = "body", weight, color, align, style, serif, children, ...rest }: Props) {
  const fw: Weight =
    weight || (variant === "display" || variant === "title" ? "bold" : variant === "subtitle" ? "semiBold" : "regular");
  const ff = pickFamily(variant, fw, serif);
  // Slight letter-spacing tweaks: tight on serif headlines, normal on body
  const isHeadline = serif === true || variant === "display" || variant === "title";
  return (
    <Text
      style={[
        {
          fontFamily: ff,
          fontSize: sizeMap[variant],
          color: color || colors.neutrals.textPrimary,
          textAlign: align || "left",
          letterSpacing: isHeadline ? 0.2 : 0,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
