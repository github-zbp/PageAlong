import { Text, View } from "react-native";
import { useLocalePreference } from "@/lib/locale";
import { getTaskCopy } from "@/lib/i18n";
import { useTheme } from "@/providers/ThemeProvider";

type Tone = {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
};

function toneForStatus(status: string, tokens: ReturnType<typeof useTheme>["tokens"]): Tone {
  switch (status) {
    case "running":
      return {
        backgroundColor: tokens.accent + "18",
        borderColor: tokens.accent + "40",
        textColor: tokens.accent
      };
    case "succeeded":
    case "completed":
      return {
        backgroundColor: tokens.accent + "14",
        borderColor: tokens.accent + "26",
        textColor: tokens.accent
      };
    case "completed_with_failures":
    case "failed":
      return {
        backgroundColor: tokens.danger + "14",
        borderColor: tokens.danger + "26",
        textColor: tokens.danger
      };
    default:
      return {
        backgroundColor: tokens.border,
        borderColor: tokens.border,
        textColor: tokens.mutedText
      };
  }
}

type Props = {
  status: string;
};

export function TaskStatusPill({ status }: Props) {
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const copy = getTaskCopy(locale);
  const normalized = status.trim().toLowerCase();
  const tone = toneForStatus(normalized, tokens);
  const label = copy.statusLabels[normalized] ?? status;

  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderWidth: 1,
        borderRadius: 999,
        borderColor: tone.borderColor,
        backgroundColor: tone.backgroundColor,
        paddingHorizontal: 8,
        paddingVertical: 4
      }}
    >
      <Text style={{ color: tone.textColor, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

export default TaskStatusPill;
