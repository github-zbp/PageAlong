import type { ComponentProps, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { IconButton } from "@/components/IconButton";
import { useTheme } from "@/providers/ThemeProvider";

export type TopBarAction = {
  icon: ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
};

type Props = {
  title: string;
  leftAction?: TopBarAction;
  rightAction?: TopBarAction | ReactNode;
  largeTitle?: boolean;
  subtitle?: string;
  onRightAction?: () => void;
  rightActionLabel?: string;
};

function isTopBarAction(action: Props["rightAction"]): action is TopBarAction {
  return (
    typeof action === "object" &&
    action !== null &&
    !Array.isArray(action) &&
    "icon" in action &&
    "label" in action &&
    "onPress" in action
  );
}

export function TopAppBar({
  title,
  leftAction,
  rightAction,
  largeTitle = false,
  subtitle,
  onRightAction,
  rightActionLabel
}: Props) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const typedRightAction = isTopBarAction(rightAction) ? rightAction : undefined;
  const legacyRightAction: ReactNode | undefined = typedRightAction ? undefined : (rightAction as ReactNode | undefined);

  const rightControl = typedRightAction ? (
    <IconButton icon={typedRightAction.icon} label={typedRightAction.label} onPress={typedRightAction.onPress} muted />
  ) : onRightAction ? (
    <Pressable
      accessibilityLabel={rightActionLabel ?? title}
      accessibilityRole="button"
      hitSlop={10}
      onPress={onRightAction}
    >
      {legacyRightAction ?? <Feather name="settings" size={20} color={tokens.mutedText} />}
    </Pressable>
  ) : (
    legacyRightAction ?? <Feather name="settings" size={20} color={tokens.mutedText} />
  );

  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: tokens.border,
        backgroundColor: tokens.surface,
        paddingLeft: 16 + insets.left,
        paddingRight: 16 + insets.right,
        paddingTop: 12 + insets.top,
        paddingBottom: largeTitle ? 20 : 12
      }}
    >
      {largeTitle ? (
        <>
          <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ width: 44 }}>{leftAction ? <IconButton icon={leftAction.icon} label={leftAction.label} onPress={leftAction.onPress} muted /> : null}</View>
            <View style={{ width: 44, alignItems: "flex-end" }}>{rightControl}</View>
          </View>
          <View style={{ marginTop: 12, gap: 4 }}>
            <Text style={{ color: tokens.text, fontSize: 32, fontWeight: "700" }}>{title}</Text>
            {subtitle ? <Text style={{ color: tokens.mutedText, fontSize: 14, lineHeight: 20 }}>{subtitle}</Text> : null}
          </View>
        </>
      ) : (
        <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ width: 44 }}>{leftAction ? <IconButton icon={leftAction.icon} label={leftAction.label} onPress={leftAction.onPress} muted /> : null}</View>
          <Text numberOfLines={1} style={{ flex: 1, color: tokens.text, fontSize: 18, fontWeight: "600", textAlign: "center" }}>
            {title}
          </Text>
          <View style={{ width: 44, alignItems: "flex-end" }}>{rightControl}</View>
        </View>
      )}
    </View>
  );
}
