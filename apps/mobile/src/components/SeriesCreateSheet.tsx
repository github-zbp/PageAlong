import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BottomSheet } from "@/components/BottomSheet";
import type { CourseSeries } from "@/lib/api";
import { createCourseSeries } from "@/lib/api";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  visible: boolean;
  title: string;
  closeLabel: string;
  inputLabel: string;
  inputPlaceholder: string;
  submitLabel: string;
  errorLabel: string;
  onClose: () => void;
  onCreated: (series: CourseSeries) => void;
};

export function SeriesCreateSheet({
  visible,
  title,
  closeLabel,
  inputLabel,
  inputPlaceholder,
  submitLabel,
  errorLabel,
  onClose,
  onCreated
}: Props) {
  const { tokens } = useTheme();
  const [seriesTitle, setSeriesTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      return;
    }
    setSeriesTitle("");
    setSaving(false);
    setError("");
  }, [visible]);

  async function handleCreate() {
    const trimmed = seriesTitle.trim();
    if (!trimmed || saving) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const created = await createCourseSeries({ title: trimmed });
      onCreated(created);
      onClose();
      setSeriesTitle("");
    } catch (caughtError) {
      setError(caughtError instanceof Error && caughtError.message.trim() ? caughtError.message : errorLabel);
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: tokens.text, fontSize: 16, fontWeight: "600" }}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} hitSlop={10} onPress={onClose}>
            <Feather name="x" size={18} color={tokens.mutedText} />
          </Pressable>
        </View>

        <TextInput
          accessibilityLabel={inputLabel}
          placeholder={inputPlaceholder}
          placeholderTextColor={tokens.mutedText}
          value={seriesTitle}
          onChangeText={setSeriesTitle}
          onSubmitEditing={() => void handleCreate()}
          style={{
            minHeight: 48,
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

        {error ? <Text style={{ color: tokens.danger, fontSize: 12, lineHeight: 18 }}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={saving || !seriesTitle.trim()}
          onPress={() => void handleCreate()}
          style={({ pressed }) => ({
            minHeight: 48,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderRadius: 10,
            backgroundColor: tokens.accent,
            opacity: saving || !seriesTitle.trim() ? 0.6 : pressed ? 0.85 : 1
          })}
        >
          {saving ? <ActivityIndicator color={tokens.surface} /> : null}
          <Text style={{ color: tokens.surface, fontSize: 14, fontWeight: "600" }}>{submitLabel}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

export default SeriesCreateSheet;
