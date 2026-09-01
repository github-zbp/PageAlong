import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { getTabRoutes } from "@/lib/navigation";
import { useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";

type TabBarProps = {
  state: {
    index: number;
  };
  navigation: {
    navigate: (name: string) => void;
  };
  insets: {
    bottom: number;
  };
};

export function TabBar({ state, navigation, insets }: TabBarProps) {
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const routes = getTabRoutes(locale);

  return (
    <View
      style={{
        flexDirection: "row",
        borderTopWidth: 1,
        borderTopColor: tokens.border,
        backgroundColor: tokens.surface,
        paddingBottom: Math.max(12, insets.bottom),
        paddingTop: 8
      }}
    >
      {routes.map((route, index) => {
        const focused = state.index === index;

        return (
          <Pressable
            key={route.name}
            onPress={() => navigation.navigate(route.name)}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              opacity: focused ? 1 : 0.72
            }}
          >
            <Feather name={route.icon} size={18} color={focused ? tokens.accent : tokens.mutedText} />
            <Text style={{ color: focused ? tokens.accent : tokens.mutedText, fontSize: 12 }}>{route.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
