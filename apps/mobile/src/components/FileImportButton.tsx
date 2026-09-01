import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { createFileImportBatch, type FileImportUpload } from "@/lib/api";
import { getImportCopy } from "@/lib/i18n";
import { useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";

export function FileImportButton() {
  const router = useRouter();
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const copy = getImportCopy(locale);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePress() {
    if (loading) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true
      });
      if (result.canceled || !result.assets?.length) {
        return;
      }

      const files: FileImportUpload[] = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name ?? "untitled",
        type: asset.mimeType ?? "application/octet-stream",
        relativePath: (asset as DocumentPicker.DocumentPickerAsset & { relativePath?: string | null }).relativePath ?? null
      }));

      await createFileImportBatch({
        files,
        sourceMode: files.length === 1 ? "single_file" : "multiple_files"
      });
      router.replace("/(tabs)/downloads");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : copy.fileImport.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        disabled={loading}
        onPress={handlePress}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderWidth: 1,
          borderColor: tokens.border,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 14,
          backgroundColor: tokens.surface,
          opacity: loading ? 0.72 : 1
        }}
      >
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: 8,
            backgroundColor: tokens.accent + "18"
          }}
        >
          {loading ? <ActivityIndicator color={tokens.accent} /> : <Feather name="upload" size={16} color={tokens.accent} />}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ color: tokens.text, fontSize: 14, fontWeight: "600" }}>{copy.fileImport.buttonTitle}</Text>
          <Text style={{ color: tokens.mutedText, fontSize: 12 }}>{copy.fileImport.buttonSubtitle}</Text>
        </View>
        <Feather name="chevron-right" size={16} color={tokens.mutedText} />
      </Pressable>

      {error ? <Text style={{ color: tokens.danger, fontSize: 12, lineHeight: 18 }}>{error}</Text> : null}
    </View>
  );
}

export default FileImportButton;
