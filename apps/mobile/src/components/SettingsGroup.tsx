import { Children, type PropsWithChildren } from "react";
import { View, Text } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";

type Props = PropsWithChildren<{
  title?: string;
}>;

export function SettingsGroup({ title, children }: Props) {
  const { tokens } = useTheme();
  const items = Children.toArray(children);

  return (
    <View style={{ gap: 8 }}>
      {title ? <Text style={{ color: tokens.mutedText, fontSize: 13, fontWeight: "600", paddingHorizontal: 4 }}>{title}</Text> : null}
      <View style={{ overflow: "hidden", borderWidth: 1, borderColor: tokens.border, borderRadius: 8, backgroundColor: tokens.surface }}>
        {items.map((child, index) => (
          <View key={index} style={index > 0 ? { borderTopWidth: 1, borderTopColor: tokens.border } : undefined}>
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

export default SettingsGroup;
