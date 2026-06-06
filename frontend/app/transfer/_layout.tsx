import { Stack } from "expo-router";
import { t, useLocale } from "../../src/i18n";
import { useThemedColors } from "../../src/themeContext";
export default function TransferLayout() {
  useLocale((st) => st.locale);
  const colors = useThemedColors();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.neutrals.background } }} />;
}
