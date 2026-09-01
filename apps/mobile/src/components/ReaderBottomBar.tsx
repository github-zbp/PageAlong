import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Course } from "@/lib/api";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  course: Course;
  visible: boolean;
  onOutline: () => void;
  onSeries: () => void;
  onDownload: () => void;
  onToggleStar: () => void;
  labels: {
    outline: string;
    series: string;
    download: string;
    star: string;
    unstar: string;
  };
};

function ActionButton({
  label,
  icon,
  active,
  onPress
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  active?: boolean;
  onPress: () => void;
}) {
  const { tokens } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        paddingVertical: 8,
        opacity: active ? 1 : 0.82
      }}
    >
      <Feather name={icon} size={18} color={active ? tokens.accent : tokens.mutedText} />
      <Text numberOfLines={1} style={{ color: active ? tokens.accent : tokens.mutedText, fontSize: 11 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ReaderBottomBar({
  course,
  visible,
  onOutline,
  onSeries,
  onDownload,
  onToggleStar,
  labels
}: Props) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents={visible ? "auto" : "none"}
      style={{
        borderTopWidth: 1,
        borderTopColor: tokens.border,
        backgroundColor: tokens.surface,
        paddingBottom: Math.max(12, insets.bottom),
        paddingTop: 8,
        paddingHorizontal: 8,
        opacity: visible ? 1 : 0,
        transform: [{ translateY: visible ? 0 : 12 }]
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "stretch" }}>
        <ActionButton label={labels.outline} icon="menu" onPress={onOutline} />
        {course.series_id ? <ActionButton label={labels.series} icon="list" onPress={onSeries} /> : null}
        <ActionButton label={labels.download} icon="download" onPress={onDownload} />
        <ActionButton
          label={course.is_starred ? labels.unstar : labels.star}
          icon="star"
          active={course.is_starred}
          onPress={onToggleStar}
        />
      </View>
    </View>
  );
}

export default ReaderBottomBar;
