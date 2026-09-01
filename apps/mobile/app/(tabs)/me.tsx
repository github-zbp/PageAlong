import { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppFrame } from "@/components/AppFrame";
import { AccountSummaryCard } from "@/components/AccountSummaryCard";
import { FeedbackSheet } from "@/components/FeedbackSheet";
import { LanguageSheet } from "@/components/LanguageSheet";
import { ReaderPreferencesSheet } from "@/components/ReaderPreferencesSheet";
import { Screen } from "@/components/Screen";
import { SettingsGroup } from "@/components/SettingsGroup";
import { SettingsRow } from "@/components/SettingsRow";
import { logoutSession } from "@/lib/api";
import { getMeCopy, formatReaderPreferencesSummary } from "@/lib/i18n";
import { setLocalePreference, useLocalePreference } from "@/lib/locale";
import { defaultReaderPreferences, loadReaderPreferences, saveReaderPreferences, type ReaderPreferences } from "@/lib/preferences";
import { useSession } from "@/providers/SessionProvider";
import { useTheme } from "@/providers/ThemeProvider";

const WEB_BASE_URL = (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export default function MeScreen() {
  const router = useRouter();
  const { state, signOut } = useSession();
  const { tokens, mode, toggleMode } = useTheme();
  const locale = useLocalePreference();
  const [readerPreferences, setReaderPreferences] = useState<ReaderPreferences>(defaultReaderPreferences);
  const [showPreferencesSheet, setShowPreferencesSheet] = useState(false);
  const [showLanguageSheet, setShowLanguageSheet] = useState(false);
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false);
  const [logoutMode, setLogoutMode] = useState<"current" | null>(null);

  useEffect(() => {
    let active = true;
    void loadReaderPreferences().then((nextPreferences) => {
      if (!active) {
        return;
      }
      setReaderPreferences(nextPreferences);
    });

    return () => {
      active = false;
    };
  }, []);

  const copy = getMeCopy(locale);
  const user = state.status === "signed_in" ? state.user : null;

  const openExternal = (path: string) => {
    void Linking.openURL(`${WEB_BASE_URL}${path}`).catch(() => undefined);
  };

  const handleSavePreferences = (nextPreferences: ReaderPreferences) => {
    setReaderPreferences(nextPreferences);
    void saveReaderPreferences(nextPreferences);
  };

  const handleSignOutCurrent = async () => {
    if (logoutMode) {
      return;
    }
    setLogoutMode("current");
    try {
      await logoutSession().catch(() => undefined);
    } finally {
      await signOut();
      router.replace("/(auth)/login");
      setLogoutMode(null);
    }
  };

  return (
    <AppFrame
      title={copy.title}
      largeTitle={false}
      rightAction={<Feather name="globe" size={20} color={tokens.mutedText} />}
      rightActionLabel={copy.languageAction}
      onRightAction={() => setShowLanguageSheet(true)}
    >
      <Screen>
        <View style={{ gap: 16 }}>
          {user ? <AccountSummaryCard user={user} locale={locale} /> : <Text style={{ color: tokens.mutedText, fontSize: 14 }}>{copy.loading}</Text>}

          <SettingsGroup title={copy.preferencesTitle}>
            <SettingsRow
              icon="book-open"
              label={copy.readerPreferences}
              value={formatReaderPreferencesSummary(readerPreferences, locale)}
              onPress={() => setShowPreferencesSheet(true)}
            />
            <SettingsRow
              icon="globe"
              label={copy.interfaceLanguage}
              value={copy.languageValues[locale]}
              onPress={() => setShowLanguageSheet(true)}
            />
            <SettingsRow
              icon={mode === "dark" ? "moon" : "sun"}
              label={copy.theme}
              value={copy.themeValues[mode]}
              onPress={toggleMode}
            />
          </SettingsGroup>

          <SettingsGroup title={copy.supportTitle}>
            <SettingsRow icon="message-circle" label={copy.feedback} onPress={() => setShowFeedbackSheet(true)} />
            <SettingsRow icon="shield" label={copy.privacy} onPress={() => openExternal("/privacy")} />
            <SettingsRow icon="file-text" label={copy.terms} onPress={() => openExternal("/terms")} />
          </SettingsGroup>

          <SettingsGroup title={copy.actionsTitle}>
            <SettingsRow icon="log-out" label={copy.signOut} danger onPress={() => void handleSignOutCurrent()} />
          </SettingsGroup>
        </View>
      </Screen>

      <ReaderPreferencesSheet
        visible={showPreferencesSheet}
        preferences={readerPreferences}
        locale={locale}
        onClose={() => setShowPreferencesSheet(false)}
        onSave={handleSavePreferences}
      />
      <LanguageSheet
        visible={showLanguageSheet}
        value={locale}
        onClose={() => setShowLanguageSheet(false)}
        onChange={setLocalePreference}
      />
      <FeedbackSheet visible={showFeedbackSheet} locale={locale} onClose={() => setShowFeedbackSheet(false)} pagePath="/mobile/me" />
    </AppFrame>
  );
}
