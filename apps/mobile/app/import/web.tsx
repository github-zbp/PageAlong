import { useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createExtensionSyncCourse } from "@/lib/api";
import { getImportCopy } from "@/lib/i18n";
import { useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export default function ImportWebScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const copy = getImportCopy(locale);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ url?: string | string[] }>();
  const initialUrl = useMemo(() => firstParam(params.url), [params.url]);
  type WebViewInstance = ComponentRef<typeof WebView>;
  const webViewRef = useRef<WebViewInstance | null>(null);
  const [webViewUrl, setWebViewUrl] = useState(initialUrl);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [currentTitle, setCurrentTitle] = useState("");
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useLayoutEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);

  function handleOpenWindow(targetUrl: string) {
    if (/^https?:\/\//i.test(targetUrl)) {
      setWebViewUrl(targetUrl);
      setCurrentUrl(targetUrl);
      setCurrentTitle("");
      setCanGoBack(true);
      return;
    }

    void Linking.canOpenURL(targetUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(targetUrl);
        }
        return undefined;
      })
      .catch(() => undefined);
  }

  async function handleSave() {
    if (!currentUrl || loading) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      await createExtensionSyncCourse({
        url: currentUrl,
        title: currentTitle.trim() || undefined
      });
      router.replace("/(tabs)/downloads");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : copy.web.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: tokens.border,
          backgroundColor: tokens.surface,
          paddingHorizontal: 16,
          paddingTop: 12 + insets.top,
          paddingBottom: 12,
          gap: 10
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (canGoBack) {
                (webViewRef.current as { goBack?: () => void } | null)?.goBack?.();
                return;
              }
              router.back();
            }}
            hitSlop={10}
            style={{
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: 17,
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: tokens.surface
            }}
          >
            <Feather name="chevron-left" size={18} color={tokens.text} />
          </Pressable>

          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text numberOfLines={1} style={{ color: tokens.text, fontSize: 14, fontWeight: "600" }}>
              {currentTitle || currentUrl || copy.web.titleFallback}
            </Text>
            <Text numberOfLines={1} style={{ color: tokens.mutedText, fontSize: 12 }}>
              {currentUrl || initialUrl}
            </Text>
          </View>

          <Pressable
            accessibilityLabel={copy.web.bookmarkLabel}
            accessibilityRole="button"
            disabled={loading || !currentUrl}
            onPress={handleSave}
            hitSlop={10}
            style={{
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: tokens.accent,
              opacity: loading || !currentUrl ? 0.6 : 1
            }}
          >
            <Feather name="bookmark" size={18} color={tokens.surface} />
          </Pressable>
        </View>

        {error ? <Text style={{ color: tokens.danger, fontSize: 12, lineHeight: 18 }}>{error}</Text> : null}
      </View>

      <WebView
        ref={webViewRef}
        testID="import-webview"
        startInLoadingState
        source={{ uri: webViewUrl }}
        style={{ flex: 1, backgroundColor: tokens.background }}
        allowsBackForwardNavigationGestures
        javaScriptCanOpenWindowsAutomatically
        renderLoading={() => <View style={{ flex: 1, backgroundColor: tokens.background }} />}
        onOpenWindow={({ nativeEvent }) => {
          handleOpenWindow(nativeEvent.targetUrl);
        }}
        onNavigationStateChange={(state) => {
          if (/^https?:\/\//i.test(state.url)) {
            setWebViewUrl(state.url);
          }
          setCurrentUrl(state.url);
          setCurrentTitle(state.title || "");
          setCanGoBack(state.canGoBack);
        }}
      />
    </View>
  );
}
