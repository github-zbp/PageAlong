import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { LocalePreference } from "@/lib/preferences";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  visible: boolean;
  value: LocalePreference;
  onClose: () => void;
  onChange: (locale: LocalePreference) => void | Promise<void>;
};

type Copy = {
  title: string;
  close: string;
  done: string;
  chinese: string;
  english: string;
};

const COPY: Record<LocalePreference, Copy> = {
  zh: {
    title: "界面语言",
    close: "关闭",
    done: "完成",
    chinese: "简体中文",
    english: "English"
  },
  en: {
    title: "Interface Language",
    close: "Close",
    done: "Done",
    chinese: "Simplified Chinese",
    english: "English"
  }
};

export function LanguageSheet({ visible, value, onClose, onChange }: Props) {
  const { tokens } = useTheme();
  const [draft, setDraft] = useState<LocalePreference>(value);
  const [saving, setSaving] = useState(false);
  const copy = COPY[value];

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setSaving(false);
    }
  }, [value, visible]);

  async function handleDone() {
    if (saving) {
      return;
    }
    setSaving(true);
    await onChange(draft);
    onClose();
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
            {(
              [
                { value: "zh", label: copy.chinese },
                { value: "en", label: copy.english }
              ] as Array<{ value: LocalePreference; label: string }>
            ).map((option) => {
              const selected = draft === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setDraft(option.value)}
                  style={{
                    minHeight: 52,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: selected ? tokens.accent : tokens.border,
                    backgroundColor: selected ? tokens.accent : tokens.elevatedSurface,
                    paddingHorizontal: 14,
                    paddingVertical: 12
                  }}
                >
                  <Text style={{ color: selected ? tokens.surface : tokens.text, fontSize: 15, fontWeight: "600" }}>
                    {option.label}
                  </Text>
                  {selected ? <Feather name="check" size={16} color={tokens.surface} /> : null}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => void handleDone()}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: 8,
              paddingVertical: 12,
              backgroundColor: tokens.accent,
              opacity: saving ? 0.7 : 1
            }}
          >
            {saving ? <ActivityIndicator color={tokens.surface} /> : null}
            <Text style={{ color: tokens.surface, fontSize: 14, fontWeight: "600" }}>{copy.done}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default LanguageSheet;
