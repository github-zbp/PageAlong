import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AuthProviderButtons } from "@/components/AuthProviderButtons";
import { Screen } from "@/components/Screen";
import { getLoginCapabilities, type LoginCapabilities } from "@/lib/api";
import { getAuthCopy } from "@/lib/i18n";
import { useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";

type Feedback = {
  text: string;
  tone: "default" | "danger";
};

const DEFAULT_CAPABILITIES: LoginCapabilities = {
  email_password: true,
  email_code: true,
  wechat: false,
  one_tap: false
};

export default function LoginScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const copy = getAuthCopy(locale);

  const [capabilities, setCapabilities] = useState<LoginCapabilities | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const passwordEnabled = capabilities?.email_password ?? true;
  const codeEnabled = capabilities?.email_code ?? true;

  useEffect(() => {
    let active = true;
    void getLoginCapabilities()
      .then((nextCapabilities) => {
        if (active) {
          setCapabilities(nextCapabilities);
        }
      })
      .catch(() => {
        if (active) {
          setCapabilities(DEFAULT_CAPABILITIES);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleWechatPress = useCallback(() => {
    setFeedback({ text: copy.login.wechatUnavailable, tone: "default" });
  }, [copy.login.wechatUnavailable]);

  const handleOneTapPress = useCallback(() => {
    setFeedback({ text: copy.login.oneTapUnavailable, tone: "default" });
  }, [copy.login.oneTapUnavailable]);

  return (
    <Screen>
      <View style={{ flex: 1, gap: 20, paddingTop: 8, paddingBottom: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.login.backLabel}
            onPress={() => router.back()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tokens.surface,
              borderWidth: 1,
              borderColor: tokens.border
            }}
          >
            <Feather name="arrow-left" size={18} color={tokens.text} />
          </Pressable>
          <Text style={{ color: tokens.text, fontSize: 16, fontWeight: "600" }}>{copy.brand}</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: tokens.text, fontSize: 30, lineHeight: 36, fontWeight: "700" }}>{copy.login.title}</Text>
          <Text style={{ color: tokens.mutedText, fontSize: 14, lineHeight: 20 }}>{copy.login.subtitle}</Text>
        </View>

        <View style={{ gap: 12 }}>
          {passwordEnabled ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/(auth)/credentials", params: { method: "password" } })}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                borderWidth: 1,
                borderColor: tokens.border,
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 15,
                backgroundColor: tokens.surface
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: tokens.elevatedSurface,
                    borderWidth: 1,
                    borderColor: tokens.border
                  }}
                >
                  <Feather name="lock" size={16} color={tokens.text} />
                </View>
                <Text style={{ color: tokens.text, fontSize: 15, fontWeight: "600" }}>{copy.login.passwordMethod}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={tokens.mutedText} />
            </Pressable>
          ) : null}

          {codeEnabled ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/(auth)/credentials", params: { method: "code" } })}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                borderWidth: 1,
                borderColor: tokens.border,
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 15,
                backgroundColor: tokens.surface
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: tokens.elevatedSurface,
                    borderWidth: 1,
                    borderColor: tokens.border
                  }}
                >
                  <Feather name="mail" size={16} color={tokens.text} />
                </View>
                <Text style={{ color: tokens.text, fontSize: 15, fontWeight: "600" }}>{copy.login.codeMethod}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={tokens.mutedText} />
            </Pressable>
          ) : null}

          <AuthProviderButtons
            capabilities={capabilities}
            loading={false}
            onWechatPress={handleWechatPress}
            onOneTapPress={handleOneTapPress}
          />

          <View style={{ alignItems: "center", paddingTop: 2 }}>
            <Pressable accessibilityRole="link" accessibilityLabel={copy.login.register} onPress={() => router.push("/(auth)/register")}>
              <Text style={{ color: tokens.accent, fontSize: 14, fontWeight: "600" }}>{copy.login.register}</Text>
            </Pressable>
          </View>
        </View>

        {feedback ? (
          <Text
            style={{
              color: feedback.tone === "danger" ? tokens.danger : tokens.mutedText,
              fontSize: 13,
              lineHeight: 18
            }}
          >
            {feedback.text}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
