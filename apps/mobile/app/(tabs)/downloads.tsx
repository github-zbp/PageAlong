import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { AppFrame } from "@/components/AppFrame";
import { TaskRetrySheet } from "@/components/TaskRetrySheet";
import { TaskRow } from "@/components/TaskRow";
import { UrlImportBar } from "@/components/UrlImportBar";
import { listFileImportBatchesPage, listGenerationJobsPage } from "@/lib/api";
import { getDownloadsCopy, getTaskCopy } from "@/lib/i18n";
import { useLocalePreference } from "@/lib/locale";
import { buildTaskRows, groupTasks, type TaskGroupKey, type TaskRowModel } from "@/lib/tasks";
import { useTheme } from "@/providers/ThemeProvider";

const TASK_PAGE_SIZE = 20;
const TASK_GROUPS: TaskGroupKey[] = ["running", "pending", "completed", "failed"];

function pageParamToNumber(pageParam: unknown): number {
  return typeof pageParam === "number" && Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
}

export default function DownloadsScreen() {
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const copy = getDownloadsCopy(locale);
  const taskCopy = getTaskCopy(locale);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTask, setActiveTask] = useState<TaskRowModel | null>(null);
  const [activeGroup, setActiveGroup] = useState<TaskGroupKey>("running");
  const [url, setUrl] = useState("");
  const didMountRef = useRef(false);

  const jobsQuery = useInfiniteQuery({
    queryKey: ["mobile", "tasks", "jobs"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      listGenerationJobsPage({
        scope: "all",
        page: pageParamToNumber(pageParam),
        pageSize: TASK_PAGE_SIZE
      }),
    getNextPageParam: (lastPage) => (lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined)
  });

  const fileBatchesQuery = useInfiniteQuery({
    queryKey: ["mobile", "tasks", "file-batches"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      listFileImportBatchesPage({
        page: pageParamToNumber(pageParam),
        pageSize: TASK_PAGE_SIZE
      }),
    getNextPageParam: (lastPage) => (lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined)
  });

  const jobs = jobsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const fileBatches = fileBatchesQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const taskRows = useMemo(
    () =>
      buildTaskRows({
        jobs,
        fileBatches,
        locale
      }),
    [fileBatches, jobs, locale]
  );
  const taskGroups = useMemo(() => groupTasks(taskRows), [taskRows]);
  const visibleRows = taskGroups[activeGroup];
  const hasLiveTasks = taskGroups.pending.length > 0 || taskGroups.running.length > 0;
  const shouldPoll = (activeGroup === "pending" || activeGroup === "running") && hasLiveTasks;
  const hasMoreTasks = Boolean(jobsQuery.hasNextPage || fileBatchesQuery.hasNextPage);
  const isInitialLoading = Boolean(jobsQuery.isLoading || fileBatchesQuery.isLoading);
  const isLoadingMore = Boolean(jobsQuery.isFetchingNextPage || fileBatchesQuery.isFetchingNextPage);

  const refreshTasks = useCallback(async () => {
    await Promise.all([jobsQuery.refetch(), fileBatchesQuery.refetch()]);
  }, [fileBatchesQuery.refetch, jobsQuery.refetch]);

  useEffect(() => {
    if (didMountRef.current) {
      void refreshTasks();
      return;
    }
    didMountRef.current = true;
  }, [activeGroup, refreshTasks]);

  useEffect(() => {
    if (!shouldPoll) {
      return;
    }

    const timer = setInterval(() => {
      void refreshTasks();
    }, 5000);

    return () => clearInterval(timer);
  }, [refreshTasks, shouldPoll]);

  async function handleLoadMore() {
    if (isLoadingMore || !hasMoreTasks) {
      return;
    }
    await Promise.all([
      jobsQuery.hasNextPage ? jobsQuery.fetchNextPage() : Promise.resolve(),
      fileBatchesQuery.hasNextPage ? fileBatchesQuery.fetchNextPage() : Promise.resolve()
    ]);
  }

  async function handleRetried() {
    setActiveTask(null);
    await queryClient.invalidateQueries({ queryKey: ["mobile", "tasks"] });
  }

  const header = (
    <View style={{ gap: 12, marginBottom: 16 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: tokens.text, fontSize: 16, fontWeight: "600" }}>{copy.introTitle}</Text>
        <Text style={{ color: tokens.mutedText, fontSize: 12, lineHeight: 18 }}>{copy.introBody}</Text>
      </View>

      {isInitialLoading ? <Text style={{ color: tokens.mutedText, fontSize: 13 }}>{copy.loading}</Text> : null}

      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: "row",
          borderWidth: 1,
          borderColor: tokens.border,
          borderRadius: 12,
          padding: 4,
          backgroundColor: tokens.surface
        }}
      >
        {TASK_GROUPS.map((group) => {
          const selected = activeGroup === group;

          return (
            <Pressable
              key={group}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setActiveGroup(group)}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                paddingVertical: 10,
                backgroundColor: selected ? tokens.elevatedSurface : "transparent"
              }}
            >
              <Text style={{ color: selected ? tokens.accent : tokens.mutedText, fontSize: 13, fontWeight: "600" }}>
                {taskCopy.groups[group]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const emptyState =
    !isInitialLoading && visibleRows.length === 0 ? (
      <View
        style={{
          borderWidth: 1,
          borderColor: tokens.border,
          borderRadius: 10,
          padding: 16,
          backgroundColor: tokens.surface
        }}
      >
        <Text style={{ color: tokens.text, fontSize: 14, fontWeight: "600" }}>{copy.emptyTitle}</Text>
        <Text style={{ color: tokens.mutedText, marginTop: 8, fontSize: 12, lineHeight: 18 }}>{copy.emptyBody}</Text>
      </View>
    ) : null;

  const footer =
    hasMoreTasks || isLoadingMore ? (
      <View style={{ paddingTop: 16, paddingBottom: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isLoadingMore ? copy.loadingMore : copy.loadMore}
          disabled={isLoadingMore}
          onPress={() => {
            void handleLoadMore();
          }}
          style={({ pressed }) => ({
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: 10,
            backgroundColor: tokens.surface,
            opacity: pressed || isLoadingMore ? 0.72 : 1
          })}
        >
          {isLoadingMore ? <ActivityIndicator color={tokens.accent} /> : <Feather name="chevron-down" size={16} color={tokens.accent} />}
          <Text style={{ color: tokens.text, fontSize: 13, fontWeight: "600" }}>
            {isLoadingMore ? copy.loadingMore : copy.loadMore}
          </Text>
        </Pressable>
      </View>
    ) : null;

  return (
    <AppFrame
      title={copy.title}
      largeTitle={false}
      rightAction={<Feather name="plus" size={20} color={tokens.mutedText} />}
      rightActionLabel={copy.action}
      onRightAction={() => router.push("/import")}
      topContent={
        <UrlImportBar
          value={url}
          onChangeText={setUrl}
          onOpen={(nextUrl) => {
            router.push({ pathname: "/import/web", params: { url: nextUrl } });
          }}
          includeSafeArea={false}
          showBackButton={false}
        />
      }
    >
      <FlatList
        accessibilityRole="list"
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingBottom: 24 }}
        data={visibleRows}
        keyExtractor={(item) => `${item.source}-${item.id}`}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={emptyState}
        ListFooterComponent={footer}
        ListHeaderComponent={header}
        onEndReached={() => {
          void handleLoadMore();
        }}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => <TaskRow task={item} onPress={item.group === "failed" ? () => setActiveTask(item) : undefined} />}
        showsVerticalScrollIndicator={false}
        testID="task-list"
      />
      <TaskRetrySheet visible={activeTask !== null} task={activeTask} onClose={() => setActiveTask(null)} onRetried={handleRetried} />
    </AppFrame>
  );
}
