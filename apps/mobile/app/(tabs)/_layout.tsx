import { Tabs } from "expo-router";
import { TabBar } from "@/components/TabBar";
import { getTabRoutes } from "@/lib/navigation";
import { useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";

export default function TabsLayout() {
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const tabRoutes = getTabRoutes(locale);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.accent,
        tabBarInactiveTintColor: tokens.mutedText,
        tabBarStyle: { borderTopColor: tokens.border, backgroundColor: tokens.surface }
      }}
      tabBar={(props) => <TabBar {...props} />}
    >
      {tabRoutes.map((route) => (
        <Tabs.Screen
          key={route.name}
          name={route.name}
          options={{
            title: route.title
          }}
        />
      ))}
    </Tabs>
  );
}
