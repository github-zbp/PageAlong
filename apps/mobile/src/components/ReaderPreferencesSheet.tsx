import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { LocalePreference, ReaderFontSize, ReaderLineHeight, ReaderPreferences } from "@/lib/preferences";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  visible: boolean;
  preferences: ReaderPreferences;
  onClose: () => void;
  onSave: (preferences: ReaderPreferences) => void;
  locale?: LocalePreference;
};

type Copy = {
  title: string;
  fontSize: string;
  lineHeight: string;
  playbackRate: string;
  done: string;
  close: string;
  small: string;
  standard: string;
  large: string;
  compact: string;
  comfortable: string;
  loose: string;
};

const COPY: Record<LocalePreference, Copy> = {
  zh: {
    title: "阅读偏好",
    fontSize: "字号",
    lineHeight: "行高",
    playbackRate: "播放速度",
    done: "完成",
    close: "关闭",
    small: "小字",
    standard: "标准",
    large: "大字",
    compact: "紧凑",
    comfortable: "舒适",
    loose: "宽松"
  },
  en: {
    title: "Reading Preferences",
    fontSize: "Font size",
    lineHeight: "Line height",
    playbackRate: "Playback rate",
    done: "Done",
    close: "Close",
    small: "Small",
    standard: "Standard",
    large: "Large",
    compact: "Compact",
    comfortable: "Comfortable",
    loose: "Loose"
  }
};

type Choice<T extends string | number> = {
  value: T;
  label: string;
};

function ChoiceRow<T extends string | number>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: Array<Choice<T>>;
  onChange: (next: T) => void;
}) {
  const { tokens } = useTheme();

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: tokens.mutedText, fontSize: 13, fontWeight: "600" }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={{
                minWidth: 74,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: selected ? tokens.accent : tokens.border,
                backgroundColor: selected ? tokens.accent : tokens.elevatedSurface,
                opacity: selected ? 1 : 0.92
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
  );
}

const PLAYBACK_RATE_OPTIONS: Array<Choice<number>> = [
  { value: 0.75, label: "0.75x" },
  { value: 1, label: "1.0x" },
  { value: 1.25, label: "1.25x" },
  { value: 1.5, label: "1.5x" },
  { value: 2, label: "2.0x" }
];

export function ReaderPreferencesSheet({ visible, preferences, onClose, onSave, locale = "zh" }: Props) {
  const { tokens } = useTheme();
  const copy = COPY[locale];
  const fontSizeOptions: Array<Choice<ReaderFontSize>> = [
    { value: "small", label: copy.small },
    { value: "standard", label: copy.standard },
    { value: "large", label: copy.large }
  ];
  const lineHeightOptions: Array<Choice<ReaderLineHeight>> = [
    { value: "compact", label: copy.compact },
    { value: "comfortable", label: copy.comfortable },
    { value: "loose", label: copy.loose }
  ];
  const [draft, setDraft] = useState(preferences);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(preferences);
      setSubmitting(false);
    }
  }, [preferences, visible]);

  const actions = useMemo(
    () => ({
      done: copy.done,
      close: copy.close
    }),
    [copy.close, copy.done]
  );

  function handleSave() {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    onSave(draft);
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
            <Pressable accessibilityRole="button" accessibilityLabel={actions.close} onPress={onClose} hitSlop={10}>
              <Feather name="x" size={18} color={tokens.mutedText} />
            </Pressable>
          </View>

          <ChoiceRow label={copy.fontSize} value={draft.fontSize} options={fontSizeOptions} onChange={(fontSize) => setDraft((current) => ({ ...current, fontSize }))} />
          <ChoiceRow
            label={copy.lineHeight}
            value={draft.lineHeight}
            options={lineHeightOptions}
            onChange={(lineHeight) => setDraft((current) => ({ ...current, lineHeight }))}
          />
          <ChoiceRow
            label={copy.playbackRate}
            value={draft.playbackRate}
            options={PLAYBACK_RATE_OPTIONS}
            onChange={(playbackRate) => setDraft((current) => ({ ...current, playbackRate }))}
          />

          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={handleSave}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: 8,
              paddingVertical: 12,
              backgroundColor: tokens.accent,
              opacity: submitting ? 0.7 : 1
            }}
          >
            {submitting ? <ActivityIndicator color={tokens.surface} /> : null}
            <Text style={{ color: tokens.surface, fontSize: 14, fontWeight: "600" }}>{actions.done}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default ReaderPreferencesSheet;
