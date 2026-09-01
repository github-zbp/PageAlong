import { Linking, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { resolveApiUrl } from "@/lib/api";
import { formatTaskUpdatedAt, getTaskCopy } from "@/lib/i18n";
import { useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";
import { TaskStatusPill } from "@/components/TaskStatusPill";
import type { TaskRowModel } from "@/lib/tasks";

type Props = {
  task: TaskRowModel;
  onPress?: () => void;
};

export function TaskRow({ task, onPress }: Props) {
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const copy = getTaskCopy(locale);
  const hasDownloadAction = Boolean(task.downloadUrl);
  const rowStyle = {
    borderWidth: 1,
    borderColor: task.group === "failed" ? tokens.danger + "33" : tokens.border,
    borderRadius: 8,
    backgroundColor: tokens.surface,
    padding: 12
  };

  const updatedAt = formatTaskUpdatedAt(task.updatedAt, locale);

  const handleDownload = () => {
    if (!task.downloadUrl) {
      return;
    }
    void Linking.openURL(resolveApiUrl(task.downloadUrl)).catch(() => undefined);
  };

  const content = (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
        <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, color: tokens.text, fontSize: 15, fontWeight: "600" }}>
          {task.title}
        </Text>
        {hasDownloadAction ? (
          <Pressable
            accessibilityLabel={`${copy.download} ${task.title}`}
            accessibilityRole="button"
            hitSlop={10}
            onPress={(event) => {
              event.stopPropagation();
              handleDownload();
            }}
            style={{
              width: 32,
              height: 32,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: tokens.accent + "33",
              backgroundColor: tokens.accent + "14",
              flexShrink: 0
            }}
          >
            <Feather name="download" size={16} color={tokens.accent} />
          </Pressable>
        ) : (
          <TaskStatusPill status={task.status} />
        )}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, color: tokens.mutedText, fontSize: 12, lineHeight: 18 }}>
          {task.typeLabel}
          {task.subtitle ? ` · ${task.subtitle}` : ""}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Text numberOfLines={1} style={{ color: tokens.mutedText, fontSize: 11 }}>
            {updatedAt}
          </Text>
          {onPress ? <Feather name="chevron-right" size={18} color={tokens.mutedText} /> : null}
        </View>
      </View>

      {task.errorMessage ? <Text numberOfLines={2} style={{ color: tokens.danger, fontSize: 12, lineHeight: 18 }}>{task.errorMessage}</Text> : null}
    </View>
  );

  if (!onPress) {
    return <View style={rowStyle}>{content}</View>;
  }

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [rowStyle, { opacity: pressed ? 0.92 : 1 }]}>
      {content}
    </Pressable>
  );
}

export default TaskRow;
