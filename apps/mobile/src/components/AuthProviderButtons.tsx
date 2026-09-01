import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { getAuthCopy } from "@/lib/i18n";
import { useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";
import type { LoginCapabilities } from "@/lib/api";

type Props = {
  capabilities: LoginCapabilities | null;
  loading?: boolean;
  onWechatPress: () => void;
  onOneTapPress: () => void;
};

function ProviderButton({
  label,
  icon,
  disabled,
  onPress
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  disabled: boolean;
  onPress: () => void;
}) {
  const { tokens } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderWidth: 1,
        borderColor: tokens.border,
        borderRadius: 12,
        paddingVertical: 12,
        backgroundColor: tokens.surface,
        opacity: disabled ? 0.48 : 1
      }}
    >
      <Feather name={icon} size={16} color={disabled ? tokens.mutedText : tokens.text} />
      <Text style={{ color: disabled ? tokens.mutedText : tokens.text, fontSize: 14, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

export function AuthProviderButtons({ capabilities, loading = false, onWechatPress, onOneTapPress }: Props) {
  const locale = useLocalePreference();
  const copy = getAuthCopy(locale);

  if (!capabilities) {
    return null;
  }

  const disabled = loading;

  if (!capabilities.wechat && !capabilities.one_tap) {
    return null;
  }

  return (
    <View style={{ gap: 10 }}>
      {capabilities.wechat ? (
        <ProviderButton label={copy.provider.wechat} icon="message-circle" disabled={disabled} onPress={onWechatPress} />
      ) : null}
      {capabilities.one_tap ? (
        <ProviderButton label={copy.provider.oneTap} icon="zap" disabled={disabled} onPress={onOneTapPress} />
      ) : null}
    </View>
  );
}

export default AuthProviderButtons;
