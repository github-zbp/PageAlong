import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useIncomingShare } from "expo-sharing";
import type { Course } from "@/lib/api";
import { createUrlCourse, getCourse } from "@/lib/api";
import { clearPendingShare, extractSharedUrl, loadPendingShare, savePendingShare } from "@/lib/share";
import { getShareCopy } from "@/lib/i18n";
import { useLocalePreference } from "@/lib/locale";
import { useSession } from "@/providers/SessionProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SharePhase = "loading" | "processing" | "waiting_login" | "invalid" | "failed";

const SHARE_POLL_INTERVAL_MS = 400;
const SHARE_POLL_ATTEMPTS = 60;

function hasReadableText(course: Course): boolean {
  if (course.content_markdown?.trim()) {
    return true;
  }

  return course.sentences.some((sentence) => sentence.text.trim().length > 0);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitForReadableCourse(courseId: string): Promise<Course> {
  for (let attempt = 0; attempt < SHARE_POLL_ATTEMPTS; attempt += 1) {
    try {
      const course = await getCourse(courseId);
      if (hasReadableText(course)) {
        return course;
      }
      if (course.status === "failed") {
        throw new Error("Failed to parse the shared page");
      }
    } catch (error) {
      if (error instanceof Error && error.message === "Failed to parse the shared page") {
        throw error;
      }
      if (attempt === SHARE_POLL_ATTEMPTS - 1) {
        throw error instanceof Error ? error : new Error("Failed to load the shared page");
      }
    }

    await sleep(SHARE_POLL_INTERVAL_MS);
  }

  throw new Error("Timed out waiting for the shared page");
}

export default function ShareReceiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const copy = getShareCopy(locale);
  const { state: sessionState } = useSession();
  const { sharedPayloads, resolvedSharedPayloads, clearSharedPayloads, error: shareError, refreshSharePayloads } =
    useIncomingShare();
  const [storedShare, setStoredShare] = useState<{ url: string; title?: string } | null>(null);
  const [storedShareLoaded, setStoredShareLoaded] = useState(false);
  const [phase, setPhase] = useState<SharePhase>("loading");
  const [failureMessage, setFailureMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const processingShareKeyRef = useRef<string | null>(null);

  const incomingShare = useMemo(
    () =>
      extractSharedUrl([
        ...resolvedSharedPayloads.map((payload) => ({
          value: payload.value,
          contentUri: payload.contentUri
        })),
        ...sharedPayloads.map((payload) => ({
          value: payload.value
        }))
      ]),
    [resolvedSharedPayloads, sharedPayloads]
  );

  const currentShare = incomingShare ?? (storedShareLoaded ? storedShare : null);

  useEffect(() => {
    let active = true;
    setStoredShareLoaded(false);
    void loadPendingShare().then((share) => {
      if (!active) {
        return;
      }
      setStoredShare(share);
      setStoredShareLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [reloadNonce]);

  const routeToLogin = useCallback(
    async (share: { url: string; title?: string }) => {
      try {
        processingShareKeyRef.current = share.url;
        setPhase("waiting_login");
        setFailureMessage("");
        await savePendingShare(share);
        router.replace("/(auth)/login");
      } catch (error) {
        processingShareKeyRef.current = null;
        setPhase("failed");
        setFailureMessage(error instanceof Error && error.message.trim() ? error.message : copy.failed);
      }
    },
    [copy.failed, router]
  );

  const importShare = useCallback(
    async (share: { url: string; title?: string }) => {
      try {
        const createdCourse = await createUrlCourse({
          url: share.url,
          title: share.title,
          autoGenerateAudio: true
        });
        const readyCourse = hasReadableText(createdCourse) ? createdCourse : await waitForReadableCourse(createdCourse.id);
        await clearPendingShare();
        clearSharedPayloads();
        router.replace({
          pathname: "/courses/[courseId]",
          params: { courseId: readyCourse.id }
        });
      } catch (error) {
        processingShareKeyRef.current = null;
        setPhase("failed");
        setFailureMessage(error instanceof Error && error.message.trim() ? error.message : copy.failed);
      }
    },
    [clearSharedPayloads, copy.failed, router]
  );

  useEffect(() => {
    if (sessionState.status === "loading") {
      setPhase("loading");
      setFailureMessage("");
      return;
    }

    if (!storedShareLoaded && !incomingShare) {
      setPhase("loading");
      return;
    }

    if (!currentShare) {
      if (shareError) {
        setPhase("failed");
        setFailureMessage(shareError.message || copy.failed);
        return;
      }

      setPhase("invalid");
      setFailureMessage(copy.invalidShare);
      return;
    }

    if (phase === "failed" || phase === "invalid" || phase === "waiting_login") {
      return;
    }

    if (processingShareKeyRef.current === currentShare.url && phase === "processing") {
      return;
    }

    if (sessionState.status === "signed_out") {
      void routeToLogin(currentShare);
      return;
    }

    processingShareKeyRef.current = currentShare.url;
    setPhase("processing");
    setFailureMessage("");
    void importShare(currentShare);
  }, [
    copy.failed,
    copy.invalidShare,
    currentShare,
    incomingShare,
    phase,
    reloadNonce,
    importShare,
    routeToLogin,
    sessionState.status,
    shareError,
    storedShareLoaded
  ]);

  const handleRetry = useCallback(() => {
    processingShareKeyRef.current = null;
    setFailureMessage("");
    setPhase("loading");
    setReloadNonce((value) => value + 1);
    refreshSharePayloads();
  }, [refreshSharePayloads]);

  const bodyText =
    phase === "waiting_login"
      ? copy.waitingForLogin
      : phase === "failed"
        ? failureMessage || copy.failed
        : phase === "invalid"
          ? copy.invalidShare
          : copy.processing;

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tokens.background,
        paddingHorizontal: 24,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24
      }}
    >
      <View style={{ alignItems: "center", gap: 14, maxWidth: 320 }}>
        <Text style={{ color: tokens.text, fontSize: 28, lineHeight: 34, fontWeight: "700", textAlign: "center" }}>
          {copy.title}
        </Text>
        <View style={{ minHeight: 24, alignItems: "center", justifyContent: "center" }}>
          {phase === "failed" || phase === "invalid" ? (
            <Feather name="alert-triangle" size={22} color={tokens.danger} />
          ) : (
            <ActivityIndicator color={tokens.accent} />
          )}
        </View>
        <Text style={{ color: tokens.mutedText, fontSize: 14, lineHeight: 20, textAlign: "center" }}>{bodyText}</Text>

        {phase === "failed" || phase === "invalid" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.retry}
            onPress={() => void handleRetry()}
            style={{
              marginTop: 4,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              borderWidth: 1,
              borderColor: tokens.border,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
              backgroundColor: tokens.surface
            }}
          >
            <Feather name="refresh-cw" size={16} color={tokens.text} />
            <Text style={{ color: tokens.text, fontSize: 14, fontWeight: "600" }}>{copy.retry}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
