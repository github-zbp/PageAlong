import { Pressable, Text, View } from "react-native";
import { BottomSheet } from "@/components/BottomSheet";
import type { CourseSeries, CourseSummary } from "@/lib/api";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  visible: boolean;
  item: CourseSummary | CourseSeries | null;
  onClose: () => void;
  onDownload?: (format: "pdf" | "docx" | "markdown" | "audio") => void;
  onMove?: () => void;
  onToggleStar?: () => void;
  onDelete?: () => void;
  onClearCourses?: () => void;
};

export function LibraryMoreSheet({ visible, item, onClose, onDownload, onMove, onToggleStar, onDelete, onClearCourses }: Props) {
  const { tokens } = useTheme();
  if (!item) return null;

  const isSeries = "article_count" in item;
  const actions = isSeries
    ? [
        { label: item.is_starred ? "取消星标" : "星标", onPress: onToggleStar },
        { label: "清空课程", onPress: () => void onClearCourses?.() },
        { label: "删除系列", onPress: onDelete, danger: true }
      ]
    : [
        { label: "下载 PDF", onPress: () => onDownload?.("pdf"), disabled: !onDownload },
        { label: "下载 Word", onPress: () => onDownload?.("docx"), disabled: !onDownload },
        { label: "下载 Markdown", onPress: () => onDownload?.("markdown"), disabled: !onDownload },
        { label: "下载音频", onPress: () => onDownload?.("audio"), disabled: !onDownload },
        { label: "转移至", onPress: onMove },
        { label: item.is_starred ? "取消星标" : "星标", onPress: onToggleStar },
        { label: "删除", onPress: onDelete, danger: true }
      ];

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          accessibilityState={{ disabled: action.disabled }}
          disabled={action.disabled}
          onPress={() => {
            action.onPress?.();
            if (!action.disabled) onClose();
          }}
          style={({ pressed }) => ({
            minHeight: 48,
            justifyContent: "center",
            borderBottomWidth: 1,
            borderBottomColor: tokens.border,
            opacity: action.disabled ? 0.45 : pressed ? 0.65 : 1
          })}
        >
          <Text style={{ color: action.danger ? tokens.danger : tokens.text, fontSize: 15 }}>{action.label}</Text>
        </Pressable>
      ))}
    </BottomSheet>
  );
}

export default LibraryMoreSheet;
