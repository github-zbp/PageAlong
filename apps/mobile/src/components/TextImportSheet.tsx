import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { createTextCourse } from "@/lib/api";
import { getImportCopy } from "@/lib/i18n";
import { useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function TextImportSheet({ visible, onClose }: Props) {
  const router = useRouter();
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const copy = getImportCopy(locale);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) {
      setLoading(false);
      setError("");
      setTitle("");
      setText("");
    }
  }, [visible]);

  async function handleSubmit() {
    const trimmedText = text.trim();
    if (!trimmedText || loading) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      await createTextCourse({
        title: title.trim() || trimmedText.slice(0, 32),
        text: trimmedText
      });
      onClose();
      router.replace("/(tabs)/downloads");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : copy.textImport.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)" }}
          onPress={onClose}
        />
        <View
          style={{
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            backgroundColor: tokens.surface,
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 20,
            gap: 12
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: tokens.text, fontSize: 16, fontWeight: "600" }}>{copy.textImport.title}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10}>
              <Feather name="x" size={18} color={tokens.mutedText} />
            </Pressable>
          </View>

          <View style={{ gap: 10 }}>
            <TextInput
              accessibilityLabel={copy.textImport.titleLabel}
              placeholder={copy.textImport.titlePlaceholder}
              placeholderTextColor={tokens.mutedText}
              value={title}
              onChangeText={setTitle}
              style={{
                borderWidth: 1,
                borderColor: tokens.border,
                borderRadius: 10,
                backgroundColor: tokens.elevatedSurface,
                color: tokens.text,
                fontSize: 14,
                paddingHorizontal: 12,
                paddingVertical: 12
              }}
            />
            <TextInput
              accessibilityLabel={copy.textImport.textLabel}
              multiline
              placeholder={copy.textImport.textPlaceholder}
              placeholderTextColor={tokens.mutedText}
              textAlignVertical="top"
              value={text}
              onChangeText={setText}
              style={{
                minHeight: 180,
                borderWidth: 1,
                borderColor: tokens.border,
                borderRadius: 10,
                backgroundColor: tokens.elevatedSurface,
                color: tokens.text,
                fontSize: 14,
                lineHeight: 22,
                paddingHorizontal: 12,
                paddingVertical: 12
              }}
            />
          </View>

          {error ? <Text style={{ color: tokens.danger, fontSize: 12, lineHeight: 18 }}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={loading || !text.trim()}
            onPress={handleSubmit}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: 10,
              paddingVertical: 12,
              backgroundColor: tokens.accent,
              opacity: loading || !text.trim() ? 0.6 : 1
            }}
          >
            {loading ? <ActivityIndicator color={tokens.surface} /> : null}
            <Text style={{ color: tokens.surface, fontSize: 14, fontWeight: "600" }}>{copy.textImport.submit}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default TextImportSheet;
