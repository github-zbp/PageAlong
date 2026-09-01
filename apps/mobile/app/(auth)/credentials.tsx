import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AuthForm } from "@/components/AuthForm";
import type { AuthMethod } from "@/components/AuthMethodTabs";
import { Screen } from "@/components/Screen";
import {
  loginWithPassword,
  loginWithEmailCode,
  registerWithEmail,
  requestEmailCode
} from "@/lib/api";
import { getAuthCopy } from "@/lib/i18n";
import { getPostLoginRedirect } from "@/lib/share";
import { useLocalePreference } from "@/lib/locale";
import { useSession } from "@/providers/SessionProvider";
import { useTheme } from "@/providers/ThemeProvider";

type AuthStage = "login" | "register";

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

function isMissingAccountError(error: unknown): boolean {
  const message = getErrorMessage(error, "");
  return /email not found|email not registered/i.test(message);
}

function getMethodParam(value: string | string[] | undefined): AuthMethod {
  const method = Array.isArray(value) ? value[0] : value;
  return method === "code" ? "code" : "password";
}

export default function CredentialsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ method?: string | string[] }>();
  const { signInWithToken } = useSession();
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const copy = getAuthCopy(locale);

  const method = getMethodParam(params.method);
  const [stage, setStage] = useState<AuthStage>("login");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const signInAndLeave = useCallback(
    async (token: string) => {
      await signInWithToken(token);
      router.replace(await getPostLoginRedirect());
    },
    [router, signInWithToken]
  );

  const submitPassword = useCallback(async () => {
    if (!consented || submitting) {
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await loginWithPassword({ email, password });
      await signInAndLeave(result.token);
    } catch (error) {
      setFeedback({ text: getErrorMessage(error, copy.credentials.loginFailed), tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }, [consented, copy.credentials.loginFailed, email, password, signInAndLeave, submitting]);

  const submitCode = useCallback(async () => {
    if (!consented || submitting) {
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      if (stage === "register") {
        const result = await registerWithEmail({ email, password, code });
        await signInAndLeave(result.token);
        return;
      }

      const result = await loginWithEmailCode({ email, code });
      await signInAndLeave(result.token);
    } catch (error) {
      if (method === "code" && stage === "login" && isMissingAccountError(error)) {
        setStage("register");
        setCode("");
        setPassword("");
        try {
          await requestEmailCode({ email, purpose: "register" });
          setFeedback({ text: `${copy.credentials.missingAccountSwitchNotice} ${copy.credentials.codeSentNotice}`, tone: "default" });
        } catch (requestError) {
          setFeedback({ text: getErrorMessage(requestError, copy.credentials.switchFailed), tone: "danger" });
        }
        return;
      }

      setFeedback({ text: getErrorMessage(error, copy.credentials.loginFailed), tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }, [
    code,
    copy.credentials.codeSentNotice,
    copy.credentials.loginFailed,
    copy.credentials.missingAccountSwitchNotice,
    copy.credentials.switchFailed,
    consented,
    email,
    method,
    password,
    signInAndLeave,
    stage,
    submitting
  ]);

  const requestCode = useCallback(async () => {
    if (!consented || submitting || !email.trim()) {
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    const purpose = stage === "register" ? "register" : "login";
    try {
      await requestEmailCode({ email, purpose });
      setFeedback({ text: copy.credentials.codeSentNotice, tone: "default" });
    } catch (error) {
      setFeedback({ text: getErrorMessage(error, copy.credentials.sendCodeFailed), tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }, [consented, copy.credentials.codeSentNotice, copy.credentials.sendCodeFailed, email, stage, submitting]);

  return (
    <Screen>
      <View style={{ flex: 1, gap: 18, paddingTop: 8, paddingBottom: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.credentials.backLabel}
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
          <Text style={{ color: tokens.text, fontSize: 30, lineHeight: 36, fontWeight: "700" }}>
            {copy.credentials.title[method]}
          </Text>
          <Text style={{ color: tokens.mutedText, fontSize: 14, lineHeight: 20 }}>{copy.credentials.subtitle}</Text>
        </View>

        <AuthForm
          method={method}
          stage={stage}
          email={email}
          code={code}
          password={password}
          consented={consented}
          loading={submitting}
          feedback={feedback}
          onEmailChange={setEmail}
          onCodeChange={setCode}
          onPasswordChange={setPassword}
          onConsentChange={setConsented}
          onRequestCode={requestCode}
          onSubmit={method === "password" ? submitPassword : submitCode}
        />
      </View>
    </Screen>
  );
}
