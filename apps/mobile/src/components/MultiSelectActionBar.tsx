import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  count: number;
  onClear: () => void;
  onUnstar: () => void;
  onMove: () => void;
  onDelete: () => void;
};

export function MultiSelectActionBar({ count, onClear, onUnstar, onMove, onDelete }: Props) {
  const { tokens } = useTheme();
  return (
    <View style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 10 }}>
      <Text style={{ flex: 1, color: tokens.text, fontSize: 14, fontWeight: "600" }}>{`已选择 ${count} 项`}</Text>
      <Pressable accessibilityLabel="取消选择" accessibilityRole="button" onPress={onClear} style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}>
        <Feather name="x" size={20} color={tokens.mutedText} />
      </Pressable>
      <Pressable accessibilityLabel="取消星标" accessibilityRole="button" onPress={onUnstar} style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}>
        <Feather name="star" size={18} color={tokens.mutedText} />
      </Pressable>
      <Pressable accessibilityLabel="转移至" accessibilityRole="button" onPress={onMove} style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}>
        <Feather name="folder" size={18} color={tokens.mutedText} />
      </Pressable>
      <Pressable accessibilityLabel="删除所选" accessibilityRole="button" onPress={onDelete} style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}>
        <Feather name="trash-2" size={18} color={tokens.danger} />
      </Pressable>
    </View>
  );
}

export default MultiSelectActionBar;
