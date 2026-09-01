import type { ComponentProps, ReactNode } from "react";
import { Feather } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";

type SettingsRowProps = {
  icon: ComponentProps<typeof Feather>["name"];
  label: string;
  value?: string;
  danger?: boolean;
  onPress?: () => void;
  rightAccessory?: ReactNode;
};

export function SettingsRow({ icon, label, value, danger, onPress, rightAccessory }: SettingsRowProps) {
  const { tokens } = useTheme();
  const iconColor = danger ? tokens.danger : tokens.mutedText;
  const textColor = danger ? tokens.danger : tokens.text;
  const valueColor = danger ? tokens.danger : tokens.mutedText;

  const content = (
    <View
      style={{
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: tokens.surface
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          backgroundColor: tokens.elevatedSurface,
          marginRight: 12
        }}
      >
        <Feather name={icon} size={16} color={iconColor} />
      </View>

      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ color: textColor, fontSize: 15, fontWeight: "600", flexShrink: 1 }}>{label}</Text>
        {value ? (
          <Text
            numberOfLines={1}
            style={{
              color: valueColor,
              fontSize: 13,
              flexShrink: 1,
              textAlign: "right",
              marginLeft: "auto"
            }}
          >
            {value}
          </Text>
        ) : null}
      </View>

      <View style={{ marginLeft: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
        {rightAccessory}
        {onPress ? <Feather name="chevron-right" size={18} color={tokens.mutedText} /> : null}
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.75 : 1
      })}
    >
      {content}
    </Pressable>
  );
}

export default SettingsRow;
