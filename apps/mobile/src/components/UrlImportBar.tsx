import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getImportCopy } from "@/lib/i18n";
import { useLocalePreference } from "@/lib/locale";
import { normalizeWebUrl } from "@/lib/url";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onBack?: () => void;
  onOpen: (url: string) => void;
  includeSafeArea?: boolean;
  showBackButton?: boolean;
};

export function UrlImportBar({
  value,
  onChangeText,
  onBack,
  onOpen,
  includeSafeArea = true,
  showBackButton = true
}: Props) {
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const copy = getImportCopy(locale);
  const insets = useSafeAreaInsets();
  const [error, setError] = useState("");

  function handleOpen() {
    const normalized = normalizeWebUrl(value);
    if (!normalized) {
      setError(copy.urlBar.invalidUrl);
      return;
    }
    setError("");
    onOpen(normalized);
  }

  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: tokens.border,
        backgroundColor: tokens.surface,
        paddingHorizontal: 16,
        paddingTop: 12 + (includeSafeArea ? insets.top : 0),
        paddingBottom: 12
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {showBackButton && onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={locale === "en" ? "Back" : "返回"}
            onPress={onBack}
            hitSlop={10}
            style={{
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: 17,
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: tokens.surface
            }}
          >
            <Feather name="chevron-left" size={18} color={tokens.text} />
          </Pressable>
        ) : null}

        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: 10,
            backgroundColor: tokens.elevatedSurface,
            paddingHorizontal: 12,
            paddingVertical: 10
          }}
        >
          <Feather name="link-2" size={16} color={tokens.mutedText} />
          <TextInput
            accessibilityLabel={copy.urlBar.inputLabel}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder={copy.urlBar.placeholder}
            placeholderTextColor={tokens.mutedText}
            returnKeyType="go"
            style={{ flex: 1, minWidth: 0, color: tokens.text, fontSize: 14, padding: 0 }}
            value={value}
            onChangeText={(nextValue) => {
              setError("");
              onChangeText(nextValue);
            }}
            onSubmitEditing={handleOpen}
          />
        </View>

        <Pressable
          accessibilityLabel={copy.urlBar.openLabel}
          accessibilityRole="button"
          onPress={handleOpen}
          hitSlop={10}
          style={{
            alignItems: "center",
            justifyContent: "center",
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: tokens.accent
          }}
        >
          <Feather name="arrow-right" size={18} color={tokens.surface} />
        </Pressable>
      </View>

      {error ? (
        <Text style={{ marginTop: 8, color: tokens.danger, fontSize: 12, lineHeight: 18 }}>{error}</Text>
      ) : null}
    </View>
  );
}

export default UrlImportBar;
