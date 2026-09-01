import { Linking, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { getAuthCopy } from "@/lib/i18n";
import { useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";

const WEB_BASE_URL = (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const PRIVACY_URL = `${WEB_BASE_URL}/privacy`;
const TERMS_URL = `${WEB_BASE_URL}/terms`;

type Props = {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export function AuthConsentRow({ checked, disabled = false, onChange }: Props) {
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const copy = getAuthCopy(locale);

  const openUrl = (url: string) => {
    void Linking.openURL(url).catch(() => undefined);
  };

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={copy.consent.label}
        accessibilityState={{ checked, disabled }}
        disabled={disabled}
        onPress={() => onChange(!checked)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          opacity: disabled ? 0.56 : 1
        }}
      >
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: checked ? tokens.accent : tokens.border,
            backgroundColor: checked ? tokens.accent : "transparent",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          {checked ? <Feather name="check" size={12} color={tokens.surface} /> : null}
        </View>
        <Text style={{ flex: 1, color: tokens.text, fontSize: 14, lineHeight: 20, flexWrap: "wrap" }}>
          {copy.consent.label}
        </Text>
      </Pressable>

      <View style={{ flexDirection: "row", paddingLeft: 28, gap: 12 }}>
        <Pressable accessibilityRole="link" onPress={() => openUrl(PRIVACY_URL)}>
          <Text style={{ color: tokens.accent, fontSize: 12 }}>{copy.consent.privacy}</Text>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => openUrl(TERMS_URL)}>
          <Text style={{ color: tokens.accent, fontSize: 12 }}>{copy.consent.terms}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default AuthConsentRow;
