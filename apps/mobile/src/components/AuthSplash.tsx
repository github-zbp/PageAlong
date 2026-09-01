import { ActivityIndicator, Text, View } from "react-native";
import { getAuthCopy } from "@/lib/i18n";
import { useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";

export function AuthSplash() {
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const copy = getAuthCopy(locale);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.background, padding: 24 }}>
      <View style={{ alignItems: "center", gap: 12 }}>
        <Text style={{ color: tokens.text, fontSize: 34, fontWeight: "700" }}>PageAlong</Text>
        <Text style={{ color: tokens.mutedText, fontSize: 14 }}>{copy.splash.subtitle}</Text>
        <ActivityIndicator color={tokens.accent} />
      </View>
    </View>
  );
}

export default AuthSplash;
