import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { CourseSeries } from "@/lib/api";
import { formatUpdatedDate } from "@/lib/library";
import { getLibraryCopy } from "@/lib/i18n";
import { useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";
import { pickSeriesReadCourseId } from "@/lib/series";

type Props = {
  series: CourseSeries;
  onViewPress: (seriesId: string) => void;
  onReadPress?: (series: CourseSeries) => void;
  onMorePress?: (series: CourseSeries) => void;
};

export const SERIES_ROW_HEIGHT = 84;

export function CourseSeriesRow({ series, onViewPress, onReadPress, onMorePress }: Props) {
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const libraryCopy = getLibraryCopy(locale);
  const hasLastRead = Boolean(series.last_read_at);
  const readCourseId = pickSeriesReadCourseId(series);
  const updated = formatUpdatedDate(series.last_read_at ?? series.updated_at, locale);
  const articleLabel = locale === "en" ? `${series.article_count} articles` : `${series.article_count} 篇文章`;
  const dateLabel = locale === "en" ? (hasLastRead ? "Last read" : "Updated") : hasLastRead ? "最近阅读" : "更新";
  const viewLabel = locale === "en" ? `View ${series.title}` : `查看 ${series.title}`;
  const readLabel = locale === "en" ? `Read ${series.title}` : `阅读 ${series.title}`;

  return (
    <View style={{ height: SERIES_ROW_HEIGHT, justifyContent: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={viewLabel}
          onPress={() => onViewPress(series.id)}
          style={({ pressed }) => ({ flex: 1, minWidth: 0, gap: 5, opacity: pressed ? 0.64 : 1 })}
        >
          <Text numberOfLines={2} style={{ color: tokens.text, fontSize: 15, fontWeight: "600" }}>{series.title}</Text>
          <Text numberOfLines={1} style={{ color: tokens.mutedText, fontSize: 12 }}>
            {articleLabel}{updated ? ` · ${dateLabel} ${updated}` : ""}
          </Text>
        </Pressable>
        {onReadPress && readCourseId ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={readLabel}
            hitSlop={8}
            onPress={() => onReadPress(series)}
            style={{ width: 64, minHeight: 52, alignItems: "center", justifyContent: "center", gap: 2 }}
          >
            <Feather name="play" size={18} color={tokens.accent} />
            <Text numberOfLines={1} style={{ color: tokens.accent, fontSize: 11, fontWeight: "600" }}>
              {libraryCopy.continueReading}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="更多"
          hitSlop={8}
          onPress={() => onMorePress?.(series)}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Feather name="more-horizontal" size={20} color={tokens.mutedText} />
        </Pressable>
      </View>
    </View>
  );
}

export default CourseSeriesRow;
