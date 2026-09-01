import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { FileImportButton } from "@/components/FileImportButton";
import { TextImportSheet } from "@/components/TextImportSheet";
import { UrlImportBar } from "@/components/UrlImportBar";
import { getImportCopy } from "@/lib/i18n";
import { useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";

function ImportEntry({
  icon,
  title,
  subtitle,
  onPress
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { tokens } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 1,
        borderColor: tokens.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 14,
        backgroundColor: tokens.surface
      }}
    >
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          width: 30,
          height: 30,
          borderRadius: 8,
          backgroundColor: tokens.border + "55"
        }}
      >
        <Feather name={icon} size={16} color={tokens.text} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ color: tokens.text, fontSize: 14, fontWeight: "600" }}>{title}</Text>
        <Text style={{ color: tokens.mutedText, fontSize: 12, lineHeight: 18 }}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={tokens.mutedText} />
    </Pressable>
  );
}

export default function ImportScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const copy = getImportCopy(locale);
  const [url, setUrl] = useState("");
  const [textImportVisible, setTextImportVisible] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      <UrlImportBar value={url} onChangeText={setUrl} onBack={() => router.back()} onOpen={(nextUrl) => {
        router.push({ pathname: "/import/web", params: { url: nextUrl } });
      }} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ color: tokens.text, fontSize: 28, fontWeight: "700", paddingTop: 4 }}>{copy.title}</Text>
        <ImportEntry
          icon="file-text"
          title={copy.textImport.title}
          subtitle={copy.textImport.subtitle}
          onPress={() => setTextImportVisible(true)}
        />
        <FileImportButton />
      </ScrollView>

      <TextImportSheet visible={textImportVisible} onClose={() => setTextImportVisible(false)} />
    </View>
  );
}
