import { useMemo, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppFrame } from "@/components/AppFrame";
import CourseListRow from "@/components/CourseListRow";
import LibraryMoreSheet from "@/components/LibraryMoreSheet";
import MultiSelectActionBar from "@/components/MultiSelectActionBar";
import { SeriesMoveSheet } from "@/components/SeriesMoveSheet";
import type { CourseDownloadFormat, CourseSeriesDetail, CourseSummary } from "@/lib/api";
import { deleteCourse, getCourseSeries, mediaUrl, requestCourseDownload, updateCourseLibrary } from "@/lib/api";
import { useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";

function toSingleValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function formatSeriesMeta(series: CourseSeriesDetail, locale: "zh" | "en"): string {
  const articleLabel = locale === "en" ? "articles" : "篇文章";
  const updatedLabel = locale === "en" ? "Updated" : "更新";
  const lastReadLabel = locale === "en" ? "Last read" : "最近阅读";
  const parts = [`${series.article_count} ${articleLabel}`];
  if (series.last_read_at) {
    const date = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", { month: "numeric", day: "numeric" }).format(new Date(series.last_read_at));
    parts.push(`${lastReadLabel} ${date}`);
  } else {
    const date = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", { month: "numeric", day: "numeric" }).format(new Date(series.updated_at));
    parts.push(`${updatedLabel} ${date}`);
  }
  return parts.join(" · ");
}

export default function SeriesCoursesScreen() {
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const router = useRouter();
  const params = useLocalSearchParams<{ seriesId?: string | string[] }>();
  const seriesId = toSingleValue(params.seriesId);
  const readerCopy = useMemo(
    () => ({
      queuedNotice: locale === "en" ? "The file is being generated. Open the download tasks page to track progress." : "文件正在生成中，前往下载任务页查看进度。",
      loadError: locale === "en" ? "Failed to load course" : "课程加载失败"
    }),
    [locale]
  );

  const seriesQuery = useQuery({
    queryKey: ["mobile", "series-detail", seriesId],
    queryFn: () => getCourseSeries(seriesId),
    enabled: Boolean(seriesId)
  });

  const series = seriesQuery.data ?? null;
  const loadingText = locale === "en" ? "Loading series..." : "正在加载系列...";
  const errorText = locale === "en" ? "Failed to load series" : "系列加载失败";
  const emptyText = locale === "en" ? "No courses yet" : "暂无课程";
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moreItem, setMoreItem] = useState<CourseSummary | null>(null);
  const [moveVisible, setMoveVisible] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const selectionMode = selectedIds.size > 0;

  const metaText = useMemo(() => {
    if (!series) {
      return "";
    }
    return formatSeriesMeta(series, locale);
  }, [locale, series]);

  const delay = useMemo(() => {
    return (milliseconds: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds);
      });
  }, []);

  const clearSelection = () => setSelectedIds(new Set());
  const runSettledAction = async (tasks: Array<() => Promise<unknown>>) => {
    setActionError("");
    const results = await Promise.allSettled(tasks.map((task) => Promise.resolve().then(task)));
    if (results.some((result) => result.status === "rejected")) {
      setActionError(locale === "en" ? "Some items could not be updated. Try again." : "部分操作未完成，请稍后重试");
    }
  };

  const toggleSelection = (courseId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  const refreshSeries = async () => {
    await seriesQuery.refetch();
  };

  const toggleCourseStar = async (course: CourseSummary) => {
    await updateCourseLibrary({ courseId: course.id, isStarred: !course.is_starred });
    await refreshSeries();
  };

  const deleteSelected = async () => {
    try {
      await runSettledAction([...selectedIds].map((id) => () => deleteCourse(id)));
    } finally {
      clearSelection();
      await refreshSeries();
    }
  };

  const unstarSelected = async () => {
    try {
      await runSettledAction([...selectedIds].map((id) => () => updateCourseLibrary({ courseId: id, isStarred: false })));
    } finally {
      clearSelection();
      await refreshSeries();
    }
  };

  const moveSelected = async (title: string) => {
    try {
      await runSettledAction([...selectedIds].map((id) => () => updateCourseLibrary({ courseId: id, libraryType: "series", seriesTitle: title })));
    } finally {
      clearSelection();
      setMoveVisible(false);
      await refreshSeries();
    }
  };

  const deleteMoreItem = async () => {
    if (!moreItem) return;
    setActionError("");
    try {
      await deleteCourse(moreItem.id);
    } catch (error) {
      setActionError(error instanceof Error && error.message.trim() ? error.message : locale === "en" ? "Some items could not be updated. Try again." : "部分操作未完成，请稍后重试");
    } finally {
      setMoreItem(null);
      await refreshSeries();
    }
  };

  const toggleMoreStar = async () => {
    if (!moreItem) return;
    setActionError("");
    try {
      await updateCourseLibrary({ courseId: moreItem.id, isStarred: !moreItem.is_starred });
    } catch (error) {
      setActionError(error instanceof Error && error.message.trim() ? error.message : locale === "en" ? "Some items could not be updated. Try again." : "部分操作未完成，请稍后重试");
    } finally {
      setMoreItem(null);
      await refreshSeries();
    }
  };

  const downloadCourse = async (format: CourseDownloadFormat) => {
    if (!moreItem) return;
    setDownloadNotice("");
    try {
      const request = await requestCourseDownload(moreItem.id, format);
      if (request.status === "ready" && request.download_url) {
        await Linking.openURL(mediaUrl(request.download_url)).catch(() => undefined);
      } else {
        setDownloadNotice(readerCopy.queuedNotice);
        await delay(900);
        router.push("/(tabs)/downloads");
      }
    } catch (error) {
      setDownloadNotice(error instanceof Error && error.message.trim() ? error.message : readerCopy.loadError);
    } finally {
      setMoreItem(null);
    }
  };

  if (!series && seriesQuery.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.background }}>
        <ActivityIndicator color={tokens.mutedText} />
        <Text style={{ marginTop: 12, color: tokens.mutedText, fontSize: 13 }}>{loadingText}</Text>
      </View>
    );
  }

  if (!series && seriesQuery.error) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.background, paddingHorizontal: 24 }}>
        <Text style={{ color: tokens.text, fontSize: 18, fontWeight: "600" }}>{errorText}</Text>
        <Text style={{ marginTop: 8, color: tokens.mutedText, fontSize: 13, textAlign: "center" }}>
          {seriesQuery.error instanceof Error && seriesQuery.error.message.trim() ? seriesQuery.error.message : errorText}
        </Text>
      </View>
    );
  }

  return (
    <AppFrame title={series?.title ?? (locale === "en" ? "Series" : "系列课程")} largeTitle={false}>
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
        {series ? <Text style={{ color: tokens.mutedText, fontSize: 12, marginBottom: 12 }}>{metaText}</Text> : null}
        {downloadNotice ? <Text style={{ color: tokens.accent, marginBottom: 8, fontSize: 12 }}>{downloadNotice}</Text> : null}
        {actionError ? <Text style={{ color: tokens.danger, marginBottom: 8, fontSize: 12 }}>{actionError}</Text> : null}
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {series?.courses && series.courses.length > 0 ? (
            series.courses.map((item, index) => (
              <View key={item.id}>
                <CourseListRow
                  course={item}
                  selected={selectedIds.has(item.id)}
                  selectionMode={selectionMode}
                  onPress={(courseId) => {
                    if (selectionMode) {
                      toggleSelection(courseId);
                      return;
                    }
                    router.push({ pathname: "/courses/[courseId]", params: { courseId } });
                  }}
                  onLongPress={toggleSelection}
                  onMorePress={(course) => setMoreItem(course)}
                  onToggleStar={(course) => void toggleCourseStar(course)}
                />
                {index < series.courses.length - 1 ? <View style={{ height: 1, backgroundColor: tokens.border }} /> : null}
              </View>
            ))
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 28 }}>
              <Text style={{ color: tokens.mutedText, fontSize: 13 }}>{emptyText}</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {selectionMode ? (
        <MultiSelectActionBar count={selectedIds.size} onClear={clearSelection} onUnstar={unstarSelected} onMove={() => setMoveVisible(true)} onDelete={deleteSelected} />
      ) : null}

      <LibraryMoreSheet
        visible={Boolean(moreItem)}
        item={moreItem}
        onClose={() => setMoreItem(null)}
        onDownload={(format) => void downloadCourse(format)}
        onMove={() => {
          if (!moreItem) return;
          setSelectedIds(new Set([moreItem.id]));
          setMoreItem(null);
          setMoveVisible(true);
        }}
        onToggleStar={() => void toggleMoreStar()}
        onDelete={() => void deleteMoreItem()}
      />

      <SeriesMoveSheet
        visible={moveVisible}
        title={locale === "en" ? "Move to" : "转移至"}
        closeLabel={locale === "en" ? "Close" : "关闭"}
        inputLabel={locale === "en" ? "Series title" : "系列标题"}
        inputPlaceholder={locale === "en" ? "Enter a series title" : "输入系列标题"}
        submitLabel={locale === "en" ? "Move" : "确认转移"}
        errorLabel={locale === "en" ? "Move failed" : "转移失败"}
        onClose={() => setMoveVisible(false)}
        onSubmit={async (title) => {
          await moveSelected(title);
        }}
      />
    </AppFrame>
  );
}
