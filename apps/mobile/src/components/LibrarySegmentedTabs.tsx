import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  value: "courses" | "series";
  onChange: (value: "courses" | "series") => void;
};

export function LibrarySegmentedTabs({ value, onChange }: Props) {
  const { tokens } = useTheme();
  const options = [
    ["courses", "课程"],
    ["series", "系列课程"]
  ] as const;

  return (
    <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: tokens.border }}>
      {options.map(([option, label]) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            onPress={() => onChange(option)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderBottomWidth: 2,
              borderBottomColor: selected ? tokens.accent : "transparent",
              opacity: pressed ? 0.65 : 1
            })}
          >
            <Text style={{ color: selected ? tokens.accent : tokens.mutedText, fontSize: 14, fontWeight: selected ? "700" : "500" }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default LibrarySegmentedTabs;
