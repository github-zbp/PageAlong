import { ActivityIndicator, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  title: string;
  description?: string;
  icon?: ComponentProps<typeof Feather>["name"];
  loading?: boolean;
};

export function EmptyState({ title, description, icon = "inbox", loading = false }: Props) {
  const { tokens } = useTheme();

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
        paddingVertical: 32,
        gap: 8
      }}
    >
      {loading ? <ActivityIndicator color={tokens.accent} /> : <Feather name={icon} size={24} color={tokens.mutedText} />}
      <Text style={{ color: tokens.text, fontSize: 15, fontWeight: "600", textAlign: "center" }}>{title}</Text>
      {description ? <Text style={{ color: tokens.mutedText, fontSize: 13, lineHeight: 20, textAlign: "center" }}>{description}</Text> : null}
    </View>
  );
}
