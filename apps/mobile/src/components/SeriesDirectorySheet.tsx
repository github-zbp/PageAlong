import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { CourseSeriesDetail } from "@/lib/api";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  visible: boolean;
  title: string;
  series: CourseSeriesDetail | null;
  currentCourseId: string;
  onClose: () => void;
  onSelectCourse: (courseId: string) => void;
  closeLabel: string;
};

export function SeriesDirectorySheet({
  visible,
  title,
  series,
  currentCourseId,
  onClose,
  onSelectCourse,
  closeLabel
}: Props) {
  const { tokens } = useTheme();

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
            gap: 14,
            maxHeight: "78%"
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: tokens.text, fontSize: 16, fontWeight: "600" }}>{title}</Text>
              <Text style={{ color: tokens.mutedText, fontSize: 12 }}>{series?.title ?? ""}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} hitSlop={10}>
              <Feather name="x" size={18} color={tokens.mutedText} />
            </Pressable>
          </View>

          <View style={{ gap: 8 }}>
            {series === null ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator color={tokens.mutedText} />
              </View>
            ) : null}
            {series?.courses.length === 0 ? (
              <Text style={{ color: tokens.mutedText, fontSize: 13, paddingVertical: 16 }}>暂无课程</Text>
            ) : null}
            {series?.courses.map((course) => {
              const active = course.id === currentCourseId;
              return (
                <Pressable
                  key={course.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    onSelectCourse(course.id);
                    onClose();
                  }}
                  style={{
                    minHeight: 52,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: active ? tokens.accent : tokens.border,
                    backgroundColor: active ? `${tokens.accent}14` : tokens.elevatedSurface,
                    paddingHorizontal: 14,
                    paddingVertical: 12
                  }}
                >
                  <Text numberOfLines={2} style={{ flex: 1, color: active ? tokens.accent : tokens.text, fontSize: 14, lineHeight: 20 }}>
                    {course.title}
                  </Text>
                  <Feather name="chevron-right" size={18} color={active ? tokens.accent : tokens.mutedText} />
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default SeriesDirectorySheet;
