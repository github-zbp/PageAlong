import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { getAuthCopy } from "@/lib/i18n";
import { useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";

export type AuthMethod = "password" | "code";

type Props = {
  value: AuthMethod;
  onChange: (next: AuthMethod) => void;
};

export function AuthMethodTabs({ value, onChange }: Props) {
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const copy = getAuthCopy(locale);
  const options: Array<{ value: AuthMethod; label: string; icon: keyof typeof Feather.glyphMap }> = [
    { value: "password", label: copy.methodTabs.password, icon: "lock" },
    { value: "code", label: copy.methodTabs.code, icon: "mail" }
  ];

  return (
    <View
      style={{
        flexDirection: "row",
        borderWidth: 1,
        borderColor: tokens.border,
        borderRadius: 12,
        padding: 4,
        backgroundColor: tokens.surface
      }}
    >
      {options.map((option) => {
        const selected = value === option.value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: 8,
              paddingVertical: 10,
              backgroundColor: selected ? tokens.elevatedSurface : "transparent"
            }}
          >
            <Feather name={option.icon} size={16} color={selected ? tokens.accent : tokens.mutedText} />
            <Text style={{ color: selected ? tokens.text : tokens.mutedText, fontSize: 14, fontWeight: "600" }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default AuthMethodTabs;
