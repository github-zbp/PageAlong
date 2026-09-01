import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  icon: ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  muted?: boolean;
};

export function IconButton({ icon, label, onPress, muted = false }: Props) {
  const { tokens } = useTheme();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        height: 44,
        justifyContent: "center",
        opacity: pressed ? 0.58 : 1,
        width: 44
      })}
    >
      <Feather name={icon} size={24} color={muted ? tokens.mutedText : tokens.text} />
    </Pressable>
  );
}
