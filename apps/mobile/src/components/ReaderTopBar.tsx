import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  title: string;
  visible: boolean;
  onBack: () => void;
  onPreferences: () => void;
  onAddTag: () => void;
  backLabel: string;
  preferencesLabel: string;
  addTagLabel: string;
};

function IconButton({
  label,
  icon,
  onPress
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
}) {
  const { tokens } = useTheme();

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={10} onPress={onPress}>
      <Feather name={icon} size={19} color={tokens.mutedText} />
    </Pressable>
  );
}

export function ReaderTopBar({
  title,
  visible,
  onBack,
  onPreferences,
  onAddTag,
  backLabel,
  preferencesLabel,
  addTagLabel
}: Props) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents={visible ? "auto" : "none"}
      style={{
        paddingTop: insets.top + 10,
        paddingBottom: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: tokens.border,
        backgroundColor: tokens.surface,
        opacity: visible ? 1 : 0,
        transform: [{ translateY: visible ? 0 : -8 }]
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 104, alignItems: "flex-start" }}>
          <IconButton label={backLabel} icon="arrow-left" onPress={onBack} />
        </View>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text numberOfLines={1} style={{ color: tokens.text, fontSize: 17, fontWeight: "600", textAlign: "center" }}>
            {title}
          </Text>
        </View>
        <View style={{ width: 104, flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
          <IconButton label={preferencesLabel} icon="settings" onPress={onPreferences} />
          <IconButton label={addTagLabel} icon="plus" onPress={onAddTag} />
        </View>
      </View>
    </View>
  );
}

export default ReaderTopBar;
