import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { CourseSummary } from "@/lib/api";
import { useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  course: CourseSummary;
  onPress: () => void;
};

function sourceLabel(sourceType: string, locale: "zh" | "en") {
  if (sourceType === "url") return "URL";
  if (sourceType === "manual_text") return locale === "zh" ? "文本" : "Text";
  if (sourceType === "file") return locale === "zh" ? "文件" : "File";
  return sourceType;
}

function progressLabel(course: CourseSummary, locale: "zh" | "en") {
  if (course.duration_seconds > 0 && course.last_playback_position_seconds > 0) {
    const progress = Math.min(100, Math.round((course.last_playback_position_seconds / course.duration_seconds) * 100));
    return locale === "zh" ? `已读 ${progress}%` : `${progress}% read`;
  }
  if (course.word_count > 0) {
    const unit = course.word_count_unit === "words" ? (locale === "zh" ? "词" : "words") : locale === "zh" ? "字" : "chars";
    return `${course.word_count} ${unit}`;
  }
  return locale === "zh" ? "未开始" : "Not started";
}

function statusLabel(status: string, locale: "zh" | "en") {
  const normalized = status.toLowerCase();
  if (normalized === "ready" || normalized === "text_ready") {
    return locale === "zh" ? "已就绪" : "Ready";
  }
  if (normalized === "audio_generating") {
    return locale === "zh" ? "生成中" : "Generating";
  }
  if (normalized === "extracting_text") {
    return locale === "zh" ? "提取中" : "Extracting";
  }
  if (normalized === "failed") {
    return locale === "zh" ? "失败" : "Failed";
  }
  return status;
}

export function SearchResultRow({ course, onPress }: Props) {
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const status = statusLabel(course.status, locale);
  const source = sourceLabel(course.source_type, locale);
  const context = course.series_title || (course.library_type === "series" ? (locale === "zh" ? "系列课程" : "Series") : "");

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 68,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: tokens.border,
        paddingHorizontal: 16,
        paddingVertical: 12,
        opacity: pressed ? 0.72 : 1
      })}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <Text numberOfLines={2} style={{ color: tokens.text, fontSize: 15, lineHeight: 21, fontWeight: "600" }}>
          {course.title}
        </Text>
        <Text numberOfLines={1} style={{ color: tokens.mutedText, fontSize: 12, lineHeight: 17 }}>
          {status} · {progressLabel(course, locale)} · {source}
          {context ? ` · ${context}` : ""}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={tokens.mutedText} />
    </Pressable>
  );
}

export default SearchResultRow;
