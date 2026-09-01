import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AuthConsentRow } from "@/components/AuthConsentRow";
import { getAuthCopy } from "@/lib/i18n";
import { useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";
import type { AuthMethod } from "@/components/AuthMethodTabs";

type Stage = "login" | "register";

type Feedback = {
  text: string;
  tone: "default" | "danger";
};

type Props = {
  method: AuthMethod;
  stage: Stage;
  email: string;
  code: string;
  password: string;
  consented: boolean;
  loading: boolean;
  feedback: Feedback | null;
  onEmailChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConsentChange: (value: boolean) => void;
  onRequestCode: () => void;
  onSubmit: () => void;
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = "default"
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "number-pad";
}) {
  const { tokens } = useTheme();

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: tokens.mutedText, fontSize: 13 }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
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

export function AuthForm({
  method,
  stage,
  email,
  code,
  password,
  consented,
  loading,
  feedback,
  onEmailChange,
  onCodeChange,
  onPasswordChange,
  onConsentChange,
  onRequestCode,
  onSubmit
}: Props) {
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const copy = getAuthCopy(locale);
  const formDisabled = !consented || !email.trim() || (method === "password" ? !password.trim() : !code.trim());
  const submitDisabled = formDisabled || loading;
  const requestCodeDisabled = !consented || loading || !email.trim();
  const primaryLabel = method === "password" ? copy.form.login : stage === "register" ? copy.form.completeRegister : copy.form.login;
  const requestCodeLabel = stage === "register" ? copy.form.sendRegisterCode : copy.form.sendCode;
  const submitBackground = loading ? tokens.accent : formDisabled ? tokens.border : tokens.accent;
  const submitTextColor = formDisabled && !loading ? tokens.mutedText : tokens.surface;

  return (
    <View style={{ gap: 14 }}>
      <Field label={copy.form.email} value={email} onChangeText={onEmailChange} placeholder={copy.form.emailPlaceholder} keyboardType="email-address" />

      {method === "code" ? (
        <>
          <Field label={copy.form.code} value={code} onChangeText={onCodeChange} placeholder={copy.form.codePlaceholder} keyboardType="number-pad" />
          {stage === "register" ? (
            <Field
              label={copy.form.password}
              value={password}
              onChangeText={onPasswordChange}
              placeholder={copy.form.registerPasswordPlaceholder}
              secureTextEntry
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={requestCodeDisabled}
            onPress={onRequestCode}
            style={{
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: tokens.border,
              borderRadius: 12,
              paddingVertical: 12,
              backgroundColor: tokens.surface,
              opacity: requestCodeDisabled ? 0.48 : 1
            }}
          >
            <Text style={{ color: requestCodeDisabled ? tokens.mutedText : tokens.text, fontSize: 14, fontWeight: "600" }}>
              {requestCodeLabel}
            </Text>
          </Pressable>
        </>
      ) : (
        <Field label={copy.form.password} value={password} onChangeText={onPasswordChange} placeholder={copy.form.passwordPlaceholder} secureTextEntry />
      )}

      <AuthConsentRow checked={consented} disabled={loading} onChange={onConsentChange} />

      <Pressable
        accessibilityRole="button"
        disabled={submitDisabled}
        onPress={onSubmit}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderRadius: 12,
          paddingVertical: 13,
          backgroundColor: submitBackground,
          opacity: submitDisabled ? 0.56 : 1
        }}
      >
        {loading ? <ActivityIndicator color={tokens.surface} /> : <Feather name="arrow-right" size={16} color={submitTextColor} />}
        <Text style={{ color: submitTextColor, fontSize: 15, fontWeight: "600" }}>{primaryLabel}</Text>
      </Pressable>

      {feedback ? (
        <Text style={{ color: feedback.tone === "danger" ? tokens.danger : tokens.mutedText, fontSize: 13, lineHeight: 18 }}>
          {feedback.text}
        </Text>
      ) : null}
    </View>
  );
}

export default AuthForm;
