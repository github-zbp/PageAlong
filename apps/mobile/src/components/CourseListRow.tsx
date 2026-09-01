import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { CourseSummary } from "@/lib/api";
import { courseProgress, formatCourseMeta, formatUpdatedDate } from "@/lib/library";
import { useTheme } from "@/providers/ThemeProvider";
import { useLocalePreference } from "@/lib/locale";
import ProgressLine from "@/components/ProgressLine";

type Props = {
  course: CourseSummary;
  selected?: boolean;
  selectionMode?: boolean;
  onPress: (courseId: string) => void;
  onLongPress?: (courseId: string) => void;
  onMorePress?: (course: CourseSummary) => void;
  onToggleStar?: (course: CourseSummary) => void;
};

export const COURSE_ROW_HEIGHT = 96;

export function CourseListRow({
  course,
  selected = false,
  selectionMode = false,
  onPress,
  onLongPress,
  onMorePress,
  onToggleStar
}: Props) {
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const progress = courseProgress(course);
  const isInProgress = progress > 0;

  return (
    <View style={{ height: COURSE_ROW_HEIGHT, justifyContent: "center", backgroundColor: selected ? tokens.surface : "transparent" }}>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
        {selectionMode ? (
          <View
            style={{
              width: 22,
              height: 22,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 11,
              borderWidth: 1,
              borderColor: selected ? tokens.accent : tokens.border,
              backgroundColor: selected ? tokens.accent : "transparent"
            }}
          >
            {selected ? <Feather name="check" size={14} color={tokens.surface} /> : null}
          </View>
        ) : (
          <View style={{ width: 8, alignItems: "center" }}>
            {isInProgress ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.accent }} /> : null}
          </View>
        )}

        <Pressable
          accessibilityLabel={course.title}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          onLongPress={() => onLongPress?.(course.id)}
          onPress={() => onPress(course.id)}
          style={({ pressed }) => ({ flex: 1, minWidth: 0, justifyContent: "center", gap: 5, opacity: pressed ? 0.64 : 1 })}
        >
          <Text numberOfLines={2} style={{ color: tokens.text, fontSize: 15, fontWeight: "600" }}>
            {course.title}
          </Text>
          <Text numberOfLines={1} style={{ color: tokens.mutedText, fontSize: 12 }}>
            {formatCourseMeta(course, locale)}{formatUpdatedDate(course.updated_at, locale) ? ` · ${formatUpdatedDate(course.updated_at, locale)}` : ""}
          </Text>
          {course.tags.length > 0 ? (
            <View style={{ flexDirection: "row", gap: 5, height: 18, overflow: "hidden" }}>
              {course.tags.slice(0, 2).map((tag) => (
                <View key={tag.id} style={{ borderRadius: 4, backgroundColor: tokens.border, paddingHorizontal: 6, justifyContent: "center" }}>
                  <Text numberOfLines={1} style={{ color: tokens.mutedText, fontSize: 10 }}>{tag.name}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <ProgressLine progress={progress} />
        </Pressable>

        {!selectionMode && (onToggleStar || onMorePress) ? (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {onToggleStar ? (
              <Pressable
                accessibilityLabel={course.is_starred ? "取消收藏" : "收藏"}
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => onToggleStar(course)}
                style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
              >
                <Feather name={course.is_starred ? "star" : "star"} size={18} color={course.is_starred ? tokens.highlight : tokens.mutedText} />
              </Pressable>
            ) : null}
            {onMorePress ? (
              <Pressable
                accessibilityLabel="更多"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => onMorePress(course)}
                style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
              >
                <Feather name="more-horizontal" size={20} color={tokens.mutedText} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default CourseListRow;
