import { Pressable, Text, View } from "react-native";
import { BottomSheet } from "@/components/BottomSheet";
import type { LibrarySort } from "@/lib/api";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  visible: boolean;
  value: LibrarySort;
  onClose: () => void;
  onChange: (value: LibrarySort) => void;
};

const SORT_OPTIONS: ReadonlyArray<readonly [LibrarySort, string]> = [
  ["recent", "最近阅读"],
  ["created_at", "按创建日期"],
  ["updated_at", "按更新日期"],
  ["title", "按标题"],
  ["starred", "按星标"]
];

export function LibrarySortSheet({ visible, value, onClose, onChange }: Props) {
  const { tokens } = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={{ color: tokens.text, fontSize: 18, fontWeight: "700", marginBottom: 6 }}>排序方式</Text>
      {SORT_OPTIONS.map(([sort, label]) => (
        <Pressable
          key={sort}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === sort }}
          onPress={() => onChange(sort)}
          style={({ pressed }) => ({
            minHeight: 48,
            justifyContent: "center",
            borderBottomWidth: 1,
            borderBottomColor: tokens.border,
            opacity: pressed ? 0.65 : 1
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: tokens.text, fontSize: 15 }}>{label}</Text>
            {value === sort ? <Text style={{ color: tokens.accent, fontSize: 18 }}>✓</Text> : null}
          </View>
        </Pressable>
      ))}
    </BottomSheet>
  );
}

export default LibrarySortSheet;
