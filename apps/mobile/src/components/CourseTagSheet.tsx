import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BottomSheet } from "@/components/BottomSheet";
import type { Course } from "@/lib/api";
import { updateCourseLibrary } from "@/lib/api";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  visible: boolean;
  course: Course | null;
  title: string;
  closeLabel: string;
  inputLabel: string;
  inputPlaceholder: string;
  submitLabel: string;
  emptyLabel: string;
  removeLabel: string;
  updateErrorLabel: string;
  onClose: () => void;
  onUpdated: (course: Course) => void;
};

function dedupeTags(values: string[]): string[] {
  const next: string[] = [];
  const seen = new Set<string>();
  values.forEach((value) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    next.push(normalized);
  });
  return next;
}

export function CourseTagSheet({
  visible,
  course,
  title,
  closeLabel,
  inputLabel,
  inputPlaceholder,
  submitLabel,
  emptyLabel,
  removeLabel,
  updateErrorLabel,
  onClose,
  onUpdated
}: Props) {
  const { tokens } = useTheme();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentTags = course?.tags ?? [];
  const currentTagNames = useMemo(() => currentTags.map((tag) => tag.name), [currentTags]);

  useEffect(() => {
    if (visible) {
      return;
    }
    setDraft("");
    setSaving(false);
    setError("");
  }, [visible]);

  async function saveTag(nextNames: string[]) {
    if (!course) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const updated = await updateCourseLibrary({
        courseId: course.id,
        tags: dedupeTags(nextNames)
      });
      onUpdated(updated);
      setDraft("");
    } catch (caughtError) {
      setError(caughtError instanceof Error && caughtError.message.trim() ? caughtError.message : updateErrorLabel);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddTag() {
    const trimmed = draft.trim();
    if (!trimmed || saving || !course) {
      return;
    }
    if (currentTagNames.includes(trimmed)) {
      setDraft("");
      return;
    }
    await saveTag([...currentTagNames, trimmed]);
  }

  async function handleRemoveTag(name: string) {
    if (saving || !course) {
      return;
    }
    await saveTag(currentTagNames.filter((tagName) => tagName !== name));
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ gap: 12, maxHeight: "82%" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: tokens.text, fontSize: 16, fontWeight: "600" }}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} hitSlop={10} onPress={onClose}>
            <Feather name="x" size={18} color={tokens.mutedText} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator={false}>
          {currentTags.length > 0 ? (
            currentTags.map((tag) => (
              <View
                key={tag.id}
                style={{
                  minHeight: 40,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: tag.color,
                  backgroundColor: `${tag.color}14`,
                  paddingHorizontal: 12,
                  paddingVertical: 8
                }}
              >
                <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tag.color }} />
                  <Text numberOfLines={1} style={{ color: tokens.text, fontSize: 14, flexShrink: 1 }}>
                    {tag.name}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${removeLabel} ${tag.name}`}
                  disabled={saving}
                  hitSlop={8}
                  onPress={() => void handleRemoveTag(tag.name)}
                  style={({ pressed }) => ({
                    width: 24,
                    height: 24,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: saving ? 0.45 : pressed ? 0.7 : 1
                  })}
                >
                  <Feather name="x" size={16} color={tokens.mutedText} />
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={{ color: tokens.mutedText, fontSize: 13, lineHeight: 20 }}>{emptyLabel}</Text>
          )}
        </ScrollView>

        <View style={{ gap: 10 }}>
          <TextInput
            accessibilityLabel={inputLabel}
            placeholder={inputPlaceholder}
            placeholderTextColor={tokens.mutedText}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => void handleAddTag()}
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
            disabled={saving || !draft.trim()}
            onPress={() => void handleAddTag()}
            style={({ pressed }) => ({
              minHeight: 48,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: 10,
              backgroundColor: tokens.accent,
              opacity: saving || !draft.trim() ? 0.6 : pressed ? 0.85 : 1
            })}
          >
            {saving ? <ActivityIndicator color={tokens.surface} /> : null}
            <Text style={{ color: tokens.surface, fontSize: 14, fontWeight: "600" }}>{submitLabel}</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

export default CourseTagSheet;
