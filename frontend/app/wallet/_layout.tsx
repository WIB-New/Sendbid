import { Stack } from "expo-router";
import { useThemedColors } from "../../src/themeContext";
export default function WLayout() {
  const colors = useThemedColors();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.neutrals.background } }} />;
}
