import { Modal, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { CourseOutlineItem } from "@/lib/api";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  visible: boolean;
  title: string;
  outline: CourseOutlineItem[];
  onClose: () => void;
  onSelect: (item: CourseOutlineItem) => void;
  closeLabel: string;
};

export function OutlineSheet({ visible, title, outline, onClose, onSelect, closeLabel }: Props) {
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
              <Text style={{ color: tokens.mutedText, fontSize: 12 }}>{outline.length} items</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} hitSlop={10}>
              <Feather name="x" size={18} color={tokens.mutedText} />
            </Pressable>
          </View>

          <View style={{ gap: 6 }}>
            {outline.length === 0 ? (
              <Text style={{ color: tokens.mutedText, fontSize: 13, paddingVertical: 16 }}>暂无目录</Text>
            ) : null}
            {outline.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                style={{
                  paddingVertical: 10,
                  paddingLeft: 12 + (item.depth - 1) * 12,
                  paddingRight: 12,
                  borderRadius: 8,
                  backgroundColor: tokens.elevatedSurface,
                  borderWidth: 1,
                  borderColor: tokens.border
                }}
              >
                <Text style={{ color: tokens.text, fontSize: 14, lineHeight: 20 }}>{item.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default OutlineSheet;
