import { Stack } from "expo-router";
import { colors } from "../../src/theme";
export default function WLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.neutrals.background } }} />;
}
