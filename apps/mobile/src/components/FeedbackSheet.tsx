import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { submitFeedback, type FeedbackCategory } from "@/lib/api";
import { useTheme } from "@/providers/ThemeProvider";
import type { LocalePreference } from "@/lib/preferences";

type Props = {
  visible: boolean;
  onClose: () => void;
  locale?: LocalePreference;
  pagePath?: string;
};

type Copy = {
  title: string;
  close: string;
  submit: string;
  category: string;
  summary: string;
  message: string;
  success: string;
  failure: string;
  categories: Record<FeedbackCategory, string>;
};

const COPY: Record<LocalePreference, Copy> = {
  zh: {
    title: "反馈",
    close: "关闭",
    submit: "发送",
    category: "分类",
    summary: "一句话概括问题",
    message: "详细说明",
    success: "反馈已发送",
    failure: "反馈发送失败",
    categories: {
      suggestion: "建议",
      bug: "问题",
      feature: "功能"
    }
  },
  en: {
    title: "Feedback",
    close: "Close",
    submit: "Send",
    category: "Category",
    summary: "Summarize the issue",
    message: "Details",
    success: "Feedback sent",
    failure: "Failed to send feedback",
    categories: {
      suggestion: "Suggestion",
      bug: "Issue",
      feature: "Feature"
    }
  }
};

type CategoryOption = {
  value: FeedbackCategory;
  label: string;
};

export function FeedbackSheet({ visible, onClose, locale = "zh", pagePath = "/mobile/me" }: Props) {
  const { tokens } = useTheme();
  const copy = COPY[locale];
  const [category, setCategory] = useState<FeedbackCategory>("suggestion");
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    if (visible) {
      setCategory("suggestion");
      setSummary("");
      setMessage("");
      setLoading(false);
      setStatus("");
    }
  }, [visible]);

  const categoryOptions = useMemo<Array<CategoryOption>>(
    () => [
      { value: "suggestion", label: copy.categories.suggestion },
      { value: "bug", label: copy.categories.bug },
      { value: "feature", label: copy.categories.feature }
    ],
    [copy.categories.bug, copy.categories.feature, copy.categories.suggestion]
  );

  async function handleSubmit() {
    if (loading || !summary.trim() || !message.trim()) {
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      await submitFeedback({
        category,
        summary: summary.trim(),
        message: message.trim(),
        pagePath
      });
      setStatus(copy.success);
    } catch (error) {
      setStatus(error instanceof Error && error.message.trim() ? error.message : copy.failure);
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
            gap: 14
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: tokens.text, fontSize: 16, fontWeight: "600" }}>{copy.title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={copy.close} onPress={onClose} hitSlop={10}>
              <Feather name="x" size={18} color={tokens.mutedText} />
            </Pressable>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={{ color: tokens.mutedText, fontSize: 13, fontWeight: "600" }}>{copy.category}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {categoryOptions.map((option) => {
                const selected = category === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setCategory(option.value)}
                    style={{
                      minWidth: 74,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: selected ? tokens.accent : tokens.border,
                      backgroundColor: selected ? tokens.accent : tokens.elevatedSurface
                    }}
                  >
                    <Text style={{ color: selected ? tokens.surface : tokens.text, fontSize: 14, fontWeight: "600", textAlign: "center" }}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <TextInput
            accessibilityLabel={copy.summary}
            placeholder={copy.summary}
            placeholderTextColor={tokens.mutedText}
            value={summary}
            onChangeText={setSummary}
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
            accessibilityLabel={copy.message}
            multiline
            placeholder={copy.message}
            placeholderTextColor={tokens.mutedText}
            textAlignVertical="top"
            value={message}
            onChangeText={setMessage}
            style={{
              minHeight: 150,
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

          {status ? <Text style={{ color: status === copy.success ? tokens.accent : tokens.danger, fontSize: 13, lineHeight: 18 }}>{status}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={loading || !summary.trim() || !message.trim()}
            onPress={() => void handleSubmit()}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: 8,
              paddingVertical: 12,
              backgroundColor: tokens.accent,
              opacity: loading || !summary.trim() || !message.trim() ? 0.6 : 1
            }}
          >
            {loading ? <ActivityIndicator color={tokens.surface} /> : null}
            <Text style={{ color: tokens.surface, fontSize: 14, fontWeight: "600" }}>{copy.submit}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default FeedbackSheet;
