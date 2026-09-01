import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { FloatingPlayer } from "@/components/FloatingPlayer";
import { FullScreenPlayer } from "@/components/FullScreenPlayer";
import { MarkdownArticle } from "@/components/MarkdownArticle";
import { OutlineSheet } from "@/components/OutlineSheet";
import { CourseTagSheet } from "@/components/CourseTagSheet";
import { ReaderBottomBar } from "@/components/ReaderBottomBar";
import { ReaderTopBar } from "@/components/ReaderTopBar";
import { SeriesDirectorySheet } from "@/components/SeriesDirectorySheet";
import { ReaderPreferencesSheet } from "@/components/ReaderPreferencesSheet";
import type { Course, CourseOutlineItem, CourseDownloadFormat, Sentence } from "@/lib/api";
import {
  getCourse,
  getCourseSeries,
  mediaUrl,
  requestCourseAudioGeneration,
  requestCourseDownload,
  updateCourseLibrary
} from "@/lib/api";
import { getReaderCopy } from "@/lib/i18n";
import { useLocalePreference } from "@/lib/locale";
import { defaultReaderPreferences, loadReaderPreferences, saveReaderPreferences, type ReaderPreferences } from "@/lib/preferences";
import { usePlayback } from "@/providers/PlaybackProvider";
import { useTheme } from "@/providers/ThemeProvider";

function toSingleValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function formatCourseMeta(course: Course, locale: "zh" | "en"): string {
  const minutes = Math.max(1, Math.ceil((course.duration_seconds || 0) / 60));
  if (locale === "en") {
    return `${course.sentences.length} sentences · ~${minutes} min`;
  }
  return `${course.sentences.length} 句 · 约 ${minutes} 分钟`;
}

export function CourseReaderScreen() {
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const copy = getReaderCopy(locale);
  const router = useRouter();
  const params = useLocalSearchParams<{ courseId?: string | string[] }>();
  const courseId = toSingleValue(params.courseId);
  const playback = usePlayback();
  const scrollRef = useRef<ScrollView | null>(null);
  const lastScrollYRef = useRef(0);
  const [course, setCourse] = useState<Course | null>(null);
  const [readerPreferences, setReaderPreferences] = useState<ReaderPreferences>(defaultReaderPreferences);
  const [preferencesVisible, setPreferencesVisible] = useState(false);
  const [outlineVisible, setOutlineVisible] = useState(false);
  const [seriesVisible, setSeriesVisible] = useState(false);
  const [tagSheetVisible, setTagSheetVisible] = useState(false);
  const [downloadSheetVisible, setDownloadSheetVisible] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState("");
  const [playbackNotice, setPlaybackNotice] = useState("");
  const [playerExpanded, setPlayerExpanded] = useState(false);
  const [playerCollapsed, setPlayerCollapsed] = useState(false);
  const [bottomBarHeight, setBottomBarHeight] = useState(0);
  const [loadingPlayback, setLoadingPlayback] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);

  const courseQuery = useQuery({
    queryKey: ["mobile", "course", courseId],
    queryFn: () => getCourse(courseId),
    enabled: Boolean(courseId)
  });

  const seriesQuery = useQuery({
    queryKey: ["mobile", "course-series", course?.series_id],
    queryFn: () => getCourseSeries(course?.series_id ?? ""),
    enabled: seriesVisible && Boolean(course?.series_id)
  });

  useEffect(() => {
    let active = true;
    void loadReaderPreferences().then((preferences) => {
      if (active) {
        setReaderPreferences(preferences);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (courseQuery.data) {
      setCourse(courseQuery.data);
    }
  }, [courseQuery.data]);

  useEffect(() => {
    if (!course) {
      return;
    }
    setOutlineVisible(false);
    setSeriesVisible(false);
    setTagSheetVisible(false);
    setDownloadSheetVisible(false);
    setPreferencesVisible(false);
    setPlayerExpanded(false);
    setPlaybackNotice("");
    setDownloadNotice("");
    setChromeVisible(true);
    setPlayerCollapsed(false);
  }, [course?.id]);

  const [chromeVisible, setChromeVisible] = useState(true);

  const courseOutline = useMemo<CourseOutlineItem[]>(() => course?.outline ?? [], [course?.outline]);
  const markdown = course?.content_markdown ?? course?.sentences.map((sentence) => sentence.text).join("\n\n") ?? "";

  const hasCourseError = Boolean(courseQuery.error && !course);
  const courseErrorMessage =
    courseQuery.error instanceof Error && courseQuery.error.message.trim() ? courseQuery.error.message : copy.loadError;

  const delay = useCallback((milliseconds: number) => {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }, []);

  const ensurePlayableCourse = useCallback(
    async (nextCourse: Course): Promise<Course | null> => {
      if (nextCourse.current_audio_url) {
        return nextCourse;
      }

      if (nextCourse.status === "text_ready") {
        setPlaybackNotice(copy.generatingAudio);
        try {
          await requestCourseAudioGeneration(nextCourse.id);
        } catch (error) {
          setPlaybackNotice(error instanceof Error && error.message.trim() ? error.message : copy.loadError);
          return null;
        }
      } else if (nextCourse.status !== "audio_generating") {
        return null;
      }

      let refreshed = nextCourse;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await delay(1500);
        try {
          refreshed = await getCourse(nextCourse.id);
        } catch {
          continue;
        }
        setCourse(refreshed);
        if (refreshed.current_audio_url) {
          setPlaybackNotice("");
          return refreshed;
        }
      }

      setPlaybackNotice(copy.loadError);
      return null;
    },
    [copy.generatingAudio, copy.loadError, delay]
  );

  const handlePrimaryPlaybackPress = useCallback(async () => {
    if (!course || loadingPlayback) {
      return;
    }

    setChromeVisible(true);
    setPlayerCollapsed(false);
    setLoadingPlayback(true);
    try {
      const playableCourse = await ensurePlayableCourse(course);
      if (!playableCourse) {
        return;
      }

      const shouldLoad =
        playback.track?.id !== playableCourse.id ||
        playback.track?.current_audio_url !== playableCourse.current_audio_url;

      if (shouldLoad) {
        playback.loadCourse(playableCourse);
      }
      playback.toggle();
      setPlaybackNotice("");
    } finally {
      setLoadingPlayback(false);
    }
  }, [course, ensurePlayableCourse, loadingPlayback, playback]);

  const handleSentencePress = useCallback(
    (sentence: Sentence) => {
      if (!course || sentence.audio_start_seconds == null) {
        return;
      }

      setChromeVisible(true);
      setPlayerCollapsed(false);
      if (playback.track?.id !== course.id || playback.track?.current_audio_url !== course.current_audio_url) {
        playback.loadCourse(course);
      }
      void playback.seekTo(sentence.audio_start_seconds);
    },
    [course, playback]
  );

  const handleToggleStar = useCallback(async () => {
    if (!course) {
      return;
    }

    const updated = await updateCourseLibrary({
      courseId: course.id,
      isStarred: !course.is_starred
    });
    setCourse(updated);
  }, [course]);

  const handleDownload = useCallback(
    async (format: CourseDownloadFormat) => {
      if (!course) {
        return;
      }

      setDownloadBusy(true);
      setDownloadSheetVisible(false);
      setDownloadNotice("");

      try {
        const request = await requestCourseDownload(course.id, format);
        if (request.status === "ready" && request.download_url) {
          await Linking.openURL(mediaUrl(request.download_url)).catch(() => undefined);
          return;
        }

        setDownloadNotice(copy.queuedNotice);
        await delay(900);
        router.push("/(tabs)/downloads");
      } catch (error) {
        setDownloadNotice(error instanceof Error && error.message.trim() ? error.message : copy.loadError);
      } finally {
        setDownloadBusy(false);
      }
    },
    [copy.loadError, copy.queuedNotice, course, delay, router]
  );

  const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const nextY = event.nativeEvent.contentOffset.y;
    const lastY = lastScrollYRef.current;
    if (nextY - lastY > 48) {
      setChromeVisible(false);
    } else if (lastY - nextY > 20) {
      setChromeVisible(true);
    }
    lastScrollYRef.current = nextY;
  }, []);

  const handleOutlineSelect = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setChromeVisible(true);
  }, []);

  const handleSeriesSelect = useCallback(
    (selectedCourseId: string) => {
      if (selectedCourseId === course?.id) {
        setChromeVisible(true);
        return;
      }
      router.push({ pathname: "/courses/[courseId]", params: { courseId: selectedCourseId } });
    },
    [course?.id, router]
  );

  const handlePreferencesSave = useCallback(
    (nextPreferences: ReaderPreferences) => {
      setReaderPreferences(nextPreferences);
      void saveReaderPreferences(nextPreferences);
      playback.setRate(nextPreferences.playbackRate);
    },
    [playback]
  );

  const handleTagsPress = useCallback(() => {
    setTagSheetVisible(true);
  }, []);

  const article = course ? (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 14 }}>
        <Text style={{ color: tokens.text, fontSize: 30, lineHeight: 36, fontWeight: "700" }}>{course.title}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playback.playing ? copy.pause : copy.play}
            disabled={loadingPlayback}
            onPress={(event) => {
              event.stopPropagation();
              void handlePrimaryPlaybackPress();
            }}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tokens.accent,
              opacity: loadingPlayback ? 0.7 : 1
            }}
          >
            {loadingPlayback ? (
              <ActivityIndicator color={tokens.surface} />
            ) : (
              <Feather name={playback.playing && playback.track?.id === course.id ? "pause" : "play"} size={22} color={tokens.surface} />
            )}
          </Pressable>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: tokens.mutedText, fontSize: 12, lineHeight: 18 }}>{formatCourseMeta(course, locale)}</Text>
            {playbackNotice ? <Text style={{ color: tokens.danger, fontSize: 12, lineHeight: 18 }}>{playbackNotice}</Text> : null}
          </View>
        </View>
        {course.tags.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {course.tags.map((tag) => (
              <View
                key={tag.id}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: tokens.border,
                  backgroundColor: tokens.elevatedSurface,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 6
                }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tag.color }} />
                <Text style={{ color: tokens.text, fontSize: 12 }}>{tag.name}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={{ gap: 12 }}>
        {downloadNotice ? (
          <View
            style={{
              borderRadius: 10,
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: tokens.elevatedSurface,
              paddingHorizontal: 12,
              paddingVertical: 10
            }}
          >
            <Text style={{ color: tokens.mutedText, fontSize: 12, lineHeight: 18 }}>{downloadNotice}</Text>
          </View>
        ) : null}

        <MarkdownArticle
          activeSentenceIndex={playback.activeSentenceIndex}
          fontSize={readerPreferences.fontSize}
          lineHeight={readerPreferences.lineHeight}
          markdown={markdown}
          onSentencePress={handleSentencePress}
          sentences={course.sentences}
        />
      </View>
    </View>
  ) : null;

  if (!course && courseQuery.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.background }}>
        <ActivityIndicator color={tokens.mutedText} />
        <Text style={{ marginTop: 12, color: tokens.mutedText, fontSize: 13 }}>{copy.loadingCourse}</Text>
      </View>
    );
  }

  if (hasCourseError) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.background, paddingHorizontal: 24 }}>
        <Text style={{ color: tokens.text, fontSize: 18, fontWeight: "600" }}>{copy.loadError}</Text>
        <Text style={{ marginTop: 8, color: tokens.mutedText, fontSize: 13, textAlign: "center" }}>{courseErrorMessage}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void courseQuery.refetch()}
          style={{
            marginTop: 18,
            borderRadius: 8,
            backgroundColor: tokens.accent,
            paddingHorizontal: 16,
            paddingVertical: 10
          }}
        >
          <Text style={{ color: tokens.surface, fontSize: 14, fontWeight: "600" }}>{copy.retry}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      <ReaderTopBar
        title={course?.title ?? copy.loadingCourse}
        visible={chromeVisible && !playerExpanded}
        onBack={() => router.back()}
        onPreferences={() => setPreferencesVisible(true)}
        onAddTag={handleTagsPress}
        backLabel={copy.back}
        preferencesLabel={copy.preferences}
        addTagLabel={copy.addTag}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 176 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => setChromeVisible((value) => !value)}>{article}</Pressable>
        {course ? <View style={{ height: 12 }} /> : null}
      </ScrollView>

      {course ? (
        <View
          onLayout={(event) => {
            const nextHeight = Math.round(event.nativeEvent.layout.height);
            setBottomBarHeight((current) => (current === nextHeight ? current : nextHeight));
          }}
        >
          <ReaderBottomBar
            course={course}
            visible={chromeVisible && !playerExpanded}
            labels={{
              outline: copy.outline,
              series: copy.seriesDirectory,
              download: copy.download,
              star: copy.star,
              unstar: copy.unstar
            }}
            onDownload={() => setDownloadSheetVisible(true)}
            onOutline={() => setOutlineVisible(true)}
            onSeries={() => setSeriesVisible(true)}
            onToggleStar={() => void handleToggleStar()}
          />
        </View>
      ) : null}

      <FloatingPlayer
        visible={!playerExpanded && (chromeVisible || playerCollapsed)}
        collapsed={playerCollapsed}
        bottomOffset={bottomBarHeight > 0 ? bottomBarHeight + 16 : 96}
        onExpand={() => setPlayerExpanded(true)}
        onCollapse={() => setPlayerCollapsed(true)}
        onRestore={() => {
          setChromeVisible(true);
          setPlayerCollapsed(false);
        }}
        expandLabel={copy.expandPlayer}
        closeLabel={copy.closePlayer}
        restoreLabel={copy.restorePlayer}
        playLabel={copy.play}
        pauseLabel={copy.pause}
      />

      <FullScreenPlayer
        labels={{
          closePlayer: copy.closePlayer,
          play: copy.play,
          pause: copy.pause,
          back10: locale === "en" ? "Back 10 seconds" : "后退 10 秒",
          forward10: locale === "en" ? "Forward 10 seconds" : "前进 10 秒",
          currentSentence: copy.currentSentence,
          speed: copy.speed
        }}
        onClose={() => setPlayerExpanded(false)}
        visible={playerExpanded}
      />

      <OutlineSheet
        closeLabel={copy.close}
        outline={courseOutline}
        onClose={() => setOutlineVisible(false)}
        onSelect={handleOutlineSelect}
        title={copy.outline}
        visible={outlineVisible}
      />

      <SeriesDirectorySheet
        closeLabel={copy.close}
        currentCourseId={course?.id ?? ""}
        onClose={() => setSeriesVisible(false)}
        onSelectCourse={handleSeriesSelect}
        series={seriesQuery.data ?? null}
        title={copy.seriesDirectory}
        visible={seriesVisible}
      />

      <ReaderPreferencesSheet
        locale={locale}
        onClose={() => setPreferencesVisible(false)}
        onSave={handlePreferencesSave}
        preferences={readerPreferences}
        visible={preferencesVisible}
      />

      <Modal animationType="slide" transparent visible={downloadSheetVisible} onRequestClose={() => setDownloadSheetVisible(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)" }}
            onPress={() => setDownloadSheetVisible(false)}
          />
          <View
            style={{
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              backgroundColor: tokens.surface,
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 20,
              gap: 14
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: tokens.text, fontSize: 16, fontWeight: "600" }}>{copy.formatTitle}</Text>
              <Pressable accessibilityRole="button" onPress={() => setDownloadSheetVisible(false)} hitSlop={10}>
                <Feather name="x" size={18} color={tokens.mutedText} />
              </Pressable>
            </View>
            <View style={{ gap: 10 }}>
              {(
                [
                  { format: "markdown", label: copy.formats.markdown },
                  { format: "docx", label: copy.formats.docx },
                  { format: "pdf", label: copy.formats.pdf },
                  { format: "audio", label: copy.formats.audio }
                ] as Array<{ format: CourseDownloadFormat; label: string }>
              ).map((item) => (
                <Pressable
                  key={item.format}
                  accessibilityRole="button"
                  disabled={downloadBusy}
                  onPress={() => void handleDownload(item.format)}
                  style={{
                    minHeight: 52,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: tokens.border,
                    backgroundColor: tokens.elevatedSurface,
                    paddingHorizontal: 14,
                    paddingVertical: 12
                  }}
                >
                  <Text style={{ color: tokens.text, fontSize: 14, fontWeight: "600" }}>{item.label}</Text>
                  <Feather name="download" size={18} color={tokens.mutedText} />
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <CourseTagSheet
        visible={tagSheetVisible}
        course={course}
        title={copy.tags}
        closeLabel={copy.close}
        inputLabel={copy.tagInputLabel}
        inputPlaceholder={copy.tagInputPlaceholder}
        submitLabel={copy.tagSubmit}
        emptyLabel={copy.tagEmpty}
        removeLabel={copy.tagRemove}
        updateErrorLabel={copy.tagError}
        onClose={() => setTagSheetVisible(false)}
        onUpdated={(updatedCourse) => setCourse(updatedCourse)}
      />
    </View>
  );
}

export default CourseReaderScreen;
