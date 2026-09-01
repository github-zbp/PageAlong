import { useCallback, useMemo, useState } from "react";
import { FlatList, Linking, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { AppFrame } from "@/components/AppFrame";
import CourseListRow from "@/components/CourseListRow";
import CourseSeriesRow from "@/components/CourseSeriesRow";
import LibrarySegmentedTabs from "@/components/LibrarySegmentedTabs";
import LibrarySortSheet from "@/components/LibrarySortSheet";
import LibraryMoreSheet from "@/components/LibraryMoreSheet";
import MultiSelectActionBar from "@/components/MultiSelectActionBar";
import { BottomSheet } from "@/components/BottomSheet";
import { SeriesCreateSheet } from "@/components/SeriesCreateSheet";
import { SeriesMoveSheet } from "@/components/SeriesMoveSheet";
import { TagCreateSheet } from "@/components/TagCreateSheet";
import { UrlImportBar } from "@/components/UrlImportBar";
import { deleteCourse, deleteCourseSeries, getCourseSeries, listCourseSeriesPage, listCoursesPage, mediaUrl, requestCourseDownload, updateCourseLibrary, updateCourseSeries, type CourseDownloadFormat, type CourseSeries, type CourseSummary, type LibrarySort } from "@/lib/api";
import { getLibraryCopy, getReaderCopy } from "@/lib/i18n";
import { useLocalePreference } from "@/lib/locale";
import { pickSeriesReadCourseId } from "@/lib/series";
import { useTheme } from "@/providers/ThemeProvider";

const PAGE_SIZE = 20;

export default function LibraryScreen() {
  const { tokens } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const locale = useLocalePreference();
  const copy = getLibraryCopy(locale);
  const readerCopy = getReaderCopy(locale);
  const [url, setUrl] = useState("");
  const [tab, setTab] = useState<"courses" | "series">("courses");
  const [sort, setSort] = useState<LibrarySort>("recent");
  const [sortVisible, setSortVisible] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moreItem, setMoreItem] = useState<CourseSummary | CourseSeries | null>(null);
  const [moveVisible, setMoveVisible] = useState(false);
  const [seriesCreateVisible, setSeriesCreateVisible] = useState(false);
  const [tagCreateVisible, setTagCreateVisible] = useState(false);
  const [plusMenuVisible, setPlusMenuVisible] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const selectionMode = selectedIds.size > 0;
  const partialFailureMessage = locale === "en" ? "Some items could not be updated. Try again." : "部分操作未完成，请稍后重试";
  const delay = useCallback((milliseconds: number) => {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }, []);

  const coursesQuery = useInfiniteQuery({
    queryKey: ["mobile", "library", "courses", sort],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => listCoursesPage({ libraryType: "fragmented", sort, page: pageParam, pageSize: PAGE_SIZE }),
    getNextPageParam: (lastPage) => (lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined)
  });
  const seriesQuery = useInfiniteQuery({
    queryKey: ["mobile", "library", "series", sort],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => listCourseSeriesPage({ sort, page: pageParam, pageSize: PAGE_SIZE }),
    getNextPageParam: (lastPage) => (lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined)
  });

  const courses = useMemo(() => coursesQuery.data?.pages.flatMap((page) => page.items) ?? [], [coursesQuery.data]);
  const series = useMemo(() => seriesQuery.data?.pages.flatMap((page) => page.items) ?? [], [seriesQuery.data]);
  const isCourses = tab === "courses";
  const isSeries = tab === "series";
  const loading = isCourses ? coursesQuery.isLoading : seriesQuery.isLoading;
  const error = isCourses ? coursesQuery.isError : seriesQuery.isError;
  const errorMessage = isCourses ? "课程加载失败" : "系列加载失败";
  const refreshing = isCourses ? coursesQuery.isRefetching : seriesQuery.isRefetching;
  const hasNextPage = isCourses ? coursesQuery.hasNextPage : seriesQuery.hasNextPage;
  const items = isCourses ? courses : series;

  const invalidateLibrary = async () => {
    await queryClient.invalidateQueries({ queryKey: ["mobile", "library"] });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const runSettledAction = async (tasks: Array<() => Promise<unknown>>) => {
    setActionError("");
    const results = await Promise.allSettled(tasks.map((task) => Promise.resolve().then(task)));
    if (results.some((result) => result.status === "rejected")) {
      setActionError(partialFailureMessage);
    }
  };
  const handleTabChange = (nextTab: "courses" | "series") => {
    if (nextTab === tab) return;
    clearSelection();
    setMoreItem(null);
    setMoveVisible(false);
    setSeriesCreateVisible(false);
    setTagCreateVisible(false);
    setPlusMenuVisible(false);
    setActionError("");
    setTab(nextTab);
  };
  const toggleSelection = (courseId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };
  const toggleCourseStar = async (course: CourseSummary) => {
    await updateCourseLibrary({ courseId: course.id, isStarred: !course.is_starred });
    await invalidateLibrary();
  };
  const toggleSeriesStar = async (item: CourseSeries) => {
    await updateCourseSeries({ seriesId: item.id, isStarred: !item.is_starred });
    await invalidateLibrary();
  };
  const deleteSelected = async () => {
    try {
      await runSettledAction([...selectedIds].map((id) => () => deleteCourse(id)));
    } finally {
      clearSelection();
      await invalidateLibrary();
    }
  };
  const unstarSelected = async () => {
    try {
      await runSettledAction([...selectedIds].map((id) => () => updateCourseLibrary({ courseId: id, isStarred: false })));
    } finally {
      clearSelection();
      await invalidateLibrary();
    }
  };
  const moveSelected = async (title: string) => {
    try {
      await runSettledAction([...selectedIds].map((id) => () => updateCourseLibrary({ courseId: id, libraryType: "series", seriesTitle: title })));
    } finally {
      clearSelection();
      setMoveVisible(false);
      await invalidateLibrary();
    }
  };
  const deleteMoreItem = async () => {
    if (!moreItem) return;
    setActionError("");
    try {
      if ("article_count" in moreItem) await deleteCourseSeries(moreItem.id);
      else await deleteCourse(moreItem.id);
    } catch (error) {
      setActionError(error instanceof Error && error.message.trim() ? error.message : partialFailureMessage);
    } finally {
      setMoreItem(null);
      await invalidateLibrary();
    }
  };
  const clearSeriesCourses = async () => {
    if (!moreItem || !("article_count" in moreItem)) return;
    setActionError("");
    try {
      const detail = await getCourseSeries(moreItem.id);
      await runSettledAction(detail.courses.map((course) => () => updateCourseLibrary({ courseId: course.id, libraryType: "fragmented" })));
    } catch (error) {
      setActionError(error instanceof Error && error.message.trim() ? error.message : partialFailureMessage);
    } finally {
      setMoreItem(null);
      await invalidateLibrary();
    }
  };
  const toggleMoreStar = async () => {
    if (!moreItem) return;
    setActionError("");
    try {
      if ("article_count" in moreItem) await toggleSeriesStar(moreItem);
      else await toggleCourseStar(moreItem);
    } catch (error) {
      setActionError(error instanceof Error && error.message.trim() ? error.message : partialFailureMessage);
    } finally {
      setMoreItem(null);
    }
  };
  const downloadCourse = async (format: CourseDownloadFormat) => {
    if (!moreItem || "article_count" in moreItem) return;
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

  const refresh = () => {
    void (isCourses ? coursesQuery.refetch() : seriesQuery.refetch());
  };
  const loadMore = () => {
    if (hasNextPage) {
      void (isCourses ? coursesQuery.fetchNextPage() : seriesQuery.fetchNextPage());
    }
  };

  return (
    <AppFrame
      title={copy.title}
      largeTitle={false}
      rightAction={<Feather name="plus" size={20} color={tokens.mutedText} />}
      onRightAction={() => setPlusMenuVisible(true)}
      rightActionLabel={locale === "en" ? "Add" : "新增"}
      topContent={
        <UrlImportBar
          value={url}
          onChangeText={setUrl}
          onOpen={(nextUrl) => router.push({ pathname: "/import/web", params: { url: nextUrl } })}
          includeSafeArea={false}
          showBackButton={false}
        />
      }
    >
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <LibrarySegmentedTabs value={tab} onChange={handleTabChange} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="排序"
            onPress={() => setSortVisible(true)}
            style={({ pressed }) => ({ width: 44, height: 48, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.65 : 1 })}
          >
            <Feather name="sliders" size={18} color={tokens.accent} />
          </Pressable>
        </View>
        {loading ? <Text style={{ color: tokens.mutedText, paddingTop: 20 }}>加载中...</Text> : null}
        {error ? <Text style={{ color: tokens.danger, paddingTop: 20 }}>{errorMessage}</Text> : null}
        {downloadNotice ? <Text style={{ color: tokens.accent, paddingTop: 8 }}>{downloadNotice}</Text> : null}
        {actionError ? <Text style={{ color: tokens.danger, paddingTop: 8 }}>{actionError}</Text> : null}
        <FlatList<CourseSummary | CourseSeries>
          data={items}
          keyExtractor={(item) => item.id}
          onEndReachedThreshold={0.45}
          onEndReached={loadMore}
          refreshing={refreshing}
          onRefresh={refresh}
          contentContainerStyle={{ paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: tokens.border }} />}
          renderItem={({ item }) => isCourses ? (
            <CourseListRow
              course={item as CourseSummary}
              selected={selectedIds.has(item.id)}
              selectionMode={selectionMode}
              onPress={(courseId) => selectionMode ? toggleSelection(courseId) : router.push({ pathname: "/courses/[courseId]", params: { courseId } })}
              onLongPress={toggleSelection}
              onMorePress={(item) => setMoreItem(item)}
              onToggleStar={toggleCourseStar}
            />
          ) : (
            <CourseSeriesRow
              series={item as CourseSeries}
              onViewPress={(seriesId) => {
                router.push({ pathname: "/series/[seriesId]", params: { seriesId } });
              }}
              onReadPress={(series) => {
                const courseId = pickSeriesReadCourseId(series);
                if (courseId) {
                  router.push({ pathname: "/courses/[courseId]", params: { courseId } });
                }
              }}
              onMorePress={(item) => setMoreItem(item)}
            />
          )}
          ListEmptyComponent={!loading ? <Text style={{ color: tokens.mutedText, paddingTop: 24 }}>暂无内容</Text> : null}
        />
      </View>
      <LibrarySortSheet
        visible={sortVisible}
        value={sort}
        onClose={() => setSortVisible(false)}
        onChange={(nextSort) => {
          setSort(nextSort);
          setSortVisible(false);
        }}
      />
      {selectionMode ? (
        <MultiSelectActionBar count={selectedIds.size} onClear={clearSelection} onUnstar={unstarSelected} onMove={() => setMoveVisible(true)} onDelete={deleteSelected} />
      ) : null}
      <LibraryMoreSheet
        visible={Boolean(moreItem)}
        item={moreItem}
        onClose={() => setMoreItem(null)}
        onDownload={isCourses && moreItem && !("article_count" in moreItem) ? downloadCourse : undefined}
        onMove={() => {
          setMoreItem(null);
          setSelectedIds(new Set(moreItem && !("article_count" in moreItem) ? [moreItem.id] : []));
          setMoveVisible(true);
        }}
        onToggleStar={toggleMoreStar}
        onDelete={deleteMoreItem}
        onClearCourses={clearSeriesCourses}
      />
      <BottomSheet visible={plusMenuVisible} onClose={() => setPlusMenuVisible(false)}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setPlusMenuVisible(false);
            router.push("/import");
          }}
          style={({ pressed }) => ({
            minHeight: 48,
            justifyContent: "center",
            borderBottomWidth: 1,
            borderBottomColor: tokens.border,
            opacity: pressed ? 0.65 : 1
          })}
        >
          <Text style={{ color: tokens.text, fontSize: 15 }}>{copy.action}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setPlusMenuVisible(false);
            setSeriesCreateVisible(true);
          }}
          style={({ pressed }) => ({
            minHeight: 48,
            justifyContent: "center",
            borderBottomWidth: 1,
            borderBottomColor: tokens.border,
            opacity: pressed ? 0.65 : 1
          })}
        >
          <Text style={{ color: tokens.text, fontSize: 15 }}>{copy.newSeries}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setPlusMenuVisible(false);
            setTagCreateVisible(true);
          }}
          style={({ pressed }) => ({
            minHeight: 48,
            justifyContent: "center",
            opacity: pressed ? 0.65 : 1
          })}
        >
          <Text style={{ color: tokens.text, fontSize: 15 }}>{copy.newTag}</Text>
        </Pressable>
      </BottomSheet>
      <SeriesMoveSheet
        visible={moveVisible}
        title={locale === "en" ? "Move to" : "转移至"}
        closeLabel={copy.close}
        inputLabel={copy.seriesInputLabel}
        inputPlaceholder={copy.seriesInputPlaceholder}
        submitLabel={locale === "en" ? "Move" : "确认转移"}
        errorLabel={locale === "en" ? "Move failed" : "转移失败"}
        onClose={() => setMoveVisible(false)}
        onSubmit={async (title) => {
          await moveSelected(title);
        }}
      />
      <SeriesCreateSheet
        visible={seriesCreateVisible}
        title={copy.newSeries}
        closeLabel={copy.close}
        inputLabel={copy.seriesInputLabel}
        inputPlaceholder={copy.seriesInputPlaceholder}
        submitLabel={copy.seriesSubmit}
        errorLabel={copy.seriesError}
        onClose={() => setSeriesCreateVisible(false)}
        onCreated={() => {
          void seriesQuery.refetch();
        }}
      />
      <TagCreateSheet
        visible={tagCreateVisible}
        title={copy.newTag}
        closeLabel={copy.close}
        inputLabel={readerCopy.tagInputLabel}
        inputPlaceholder={readerCopy.tagInputPlaceholder}
        submitLabel={readerCopy.tagSubmit}
        errorLabel={readerCopy.tagError}
        onClose={() => setTagCreateVisible(false)}
        onCreated={() => undefined}
      />
    </AppFrame>
  );
}
