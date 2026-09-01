import { useEffect } from "react";
import { Stack } from "expo-router";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AudioProvider } from "@/providers/AudioProvider";
import { PlaybackProvider } from "@/providers/PlaybackProvider";
import { bootstrapLocalePreference } from "@/lib/locale";
import { getAppNavigatorScreenOptions } from "@/lib/navigation";
import { QueryProvider } from "@/providers/QueryProvider";
import { SessionProvider } from "@/providers/SessionProvider";
import { ThemeProvider, useTheme } from "@/providers/ThemeProvider";

function AppNavigator() {
  const { tokens } = useTheme();
  const screenOptions = getAppNavigatorScreenOptions(tokens.background);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      <Stack screenOptions={screenOptions} />
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void bootstrapLocalePreference().catch(() => undefined);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryProvider>
          <ThemeProvider>
            <SessionProvider>
              <AudioProvider>
                <PlaybackProvider>
                  <AppNavigator />
                </PlaybackProvider>
              </AudioProvider>
            </SessionProvider>
          </ThemeProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
