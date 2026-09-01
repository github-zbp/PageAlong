import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AuthConsentRow } from "@/components/AuthConsentRow";
import { Screen } from "@/components/Screen";
import { registerWithEmail, requestEmailCode } from "@/lib/api";
import { getAuthCopy } from "@/lib/i18n";
import { getPostLoginRedirect } from "@/lib/share";
import { useLocalePreference } from "@/lib/locale";
import { useSession } from "@/providers/SessionProvider";
import { useTheme } from "@/providers/ThemeProvider";

type Feedback = {
  text: string;
  tone: "default" | "danger";
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error && typeof error === "object") {
    const detail = (error as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
  }
  return fallback;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  testID,
  secureTextEntry = false,
  keyboardType = "default"
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  testID?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "number-pad";
}) {
  const { tokens } = useTheme();

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: tokens.mutedText, fontSize: 13 }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        testID={testID}
        autoCapitalize="none"
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={tokens.mutedText}
        secureTextEntry={secureTextEntry}
        value={value}
        onChangeText={onChangeText}
        style={{
          borderWidth: 1,
          borderColor: tokens.border,
          borderRadius: 10,
          backgroundColor: tokens.elevatedSurface,
          color: tokens.text,
          fontSize: 15,
          paddingHorizontal: 12,
          paddingVertical: 12
        }}
      />
    </View>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const { signInWithToken } = useSession();
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const copy = getAuthCopy(locale);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [consented, setConsented] = useState(false);
  const [requestingCode, setRequestingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [codeCooldown, setCodeCooldown] = useState(0);

  useEffect(() => {
    if (codeCooldown <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setCodeCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [codeCooldown]);

  const signInAndLeave = useCallback(
    async (token: string) => {
      await signInWithToken(token);
      router.replace(await getPostLoginRedirect());
    },
    [router, signInWithToken]
  );

  const requestCode = useCallback(async () => {
    if (!consented || requestingCode || submitting || !email.trim() || codeCooldown > 0) {
      return;
    }
    setRequestingCode(true);
    setFeedback(null);
    try {
      await requestEmailCode({ email, purpose: "register" });
      setFeedback({ text: copy.register.codeSentNotice, tone: "default" });
      setCodeCooldown(60);
    } catch (error) {
      setFeedback({ text: getErrorMessage(error, copy.register.sendCodeFailed), tone: "danger" });
    } finally {
      setRequestingCode(false);
    }
  }, [codeCooldown, consented, copy.register.codeSentNotice, copy.register.sendCodeFailed, email, requestingCode, submitting]);

  const submit = useCallback(async () => {
    if (!consented || submitting || requestingCode || !email.trim() || !password.trim() || !code.trim()) {
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await registerWithEmail({ email, password, code });
      await signInAndLeave(result.token);
    } catch (error) {
      setFeedback({ text: getErrorMessage(error, copy.register.registerFailed), tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }, [code, consented, copy.register.registerFailed, email, password, requestingCode, signInAndLeave, submitting]);

  const sendCodeDisabled = !consented || requestingCode || submitting || codeCooldown > 0 || !email.trim();
  const submitDisabled = !consented || requestingCode || submitting || !email.trim() || !password.trim() || !code.trim();

  return (
    <Screen>
      <View style={{ flex: 1, gap: 18, paddingTop: 8, paddingBottom: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.register.backLabel}
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
          <Text style={{ color: tokens.text, fontSize: 30, lineHeight: 36, fontWeight: "700" }}>{copy.register.title}</Text>
          <Text style={{ color: tokens.mutedText, fontSize: 14, lineHeight: 20 }}>{copy.register.subtitle}</Text>
        </View>

        <View style={{ gap: 14 }}>
          <Field
            label={copy.register.email}
            value={email}
            onChangeText={setEmail}
            placeholder={copy.form.emailPlaceholder}
            testID="register-email-input"
            keyboardType="email-address"
          />

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field
                label={copy.register.password}
                value={password}
                onChangeText={setPassword}
                placeholder={copy.register.passwordPlaceholder}
                testID="register-password-input"
                secureTextEntry
              />
            </View>
            <Pressable
              testID="register-send-code-button"
              accessibilityRole="button"
              accessibilityLabel={copy.register.sendCode}
              disabled={sendCodeDisabled}
              onPress={() => void requestCode()}
              style={{
                alignSelf: "flex-end",
                minWidth: 102,
                height: 46,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: tokens.surface,
                opacity: sendCodeDisabled ? 0.48 : 1
              }}
              >
              <Text style={{ color: sendCodeDisabled ? tokens.mutedText : tokens.text, fontSize: 14, fontWeight: "600" }}>
                {codeCooldown > 0 ? copy.register.resendCode(codeCooldown) : copy.register.sendCode}
              </Text>
            </Pressable>
          </View>

          <Field
            label={copy.register.code}
            value={code}
            onChangeText={setCode}
            placeholder={copy.form.codePlaceholder}
            testID="register-code-input"
            keyboardType="number-pad"
          />

          <AuthConsentRow checked={consented} disabled={requestingCode || submitting} onChange={setConsented} />

          {feedback ? (
            <Text
              testID="register-feedback"
              style={{
                color: feedback.tone === "danger" ? tokens.danger : tokens.accent,
                fontSize: 13,
                lineHeight: 18
              }}
            >
              {feedback.text}
            </Text>
          ) : null}

          <Pressable
            testID="register-submit-button"
            accessibilityRole="button"
            accessibilityLabel={copy.register.submit}
            disabled={submitDisabled}
            onPress={() => void submit()}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: 12,
              paddingVertical: 13,
              backgroundColor: tokens.accent,
              opacity: submitDisabled ? 0.56 : 1
            }}
            >
            {submitting ? <ActivityIndicator color={tokens.surface} /> : <Feather name="arrow-right" size={16} color={tokens.surface} />}
            <Text style={{ color: tokens.surface, fontSize: 15, fontWeight: "600" }}>{copy.register.submit}</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4 }}>
          <Text style={{ color: tokens.mutedText, fontSize: 14 }}>{copy.register.alreadyHaveAccount}</Text>
          <Pressable accessibilityRole="link" accessibilityLabel={copy.register.login} onPress={() => router.push("/(auth)/login")}>
            <Text style={{ color: tokens.accent, fontSize: 14, fontWeight: "600" }}>{copy.register.login}</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
