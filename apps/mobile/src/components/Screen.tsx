import { ScrollView, View } from "react-native";
import type { PropsWithChildren } from "react";
import { useTheme } from "@/providers/ThemeProvider";

export function Screen({ children }: PropsWithChildren) {
  const { tokens } = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flex: 1, padding: 16 }}>{children}</View>
    </ScrollView>
  );
}
