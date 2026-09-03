import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppFrame } from "@/components/AppFrame";
import CourseListRow from "@/components/CourseListRow";
import { WorkbenchOnboardingSheet } from "@/components/WorkbenchOnboardingSheet";
import ProgressLine from "@/components/ProgressLine";
import { Screen } from "@/components/Screen";
import { UrlImportBar } from "@/components/UrlImportBar";
import { listCoursesPage } from "@/lib/api";
import { getWorkbenchCopy } from "@/lib/i18n";
import { courseProgress, formatCourseMeta, formatUpdatedDate } from "@/lib/library";
import {
  getCachedWorkbenchOnboardingCompleted,
  loadWorkbenchOnboardingCompleted,
  saveWorkbenchOnboardingCompleted
} from "@/lib/onboarding";
import { useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";

type GuideTarget = "import" | "continue" | "library" | "series";

export default function WorkbenchScreen() {
  const { tokens } = useTheme();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(() => getCachedWorkbenchOnboardingCompleted() === false);
  const [guideStepIndex, setGuideStepIndex] = useState(0);
  const [guideSessionKey, setGuideSessionKey] = useState(0);
  const [guideLayouts, setGuideLayouts] = useState<Record<GuideTarget, { x: number; y: number; width: number; height: number } | null>>({
    import: null,
    continue: null,
    library: null,
    series: null
  });
  const targetRefs = useRef<Record<GuideTarget, any>>({
    import: null,
    continue: null,
    library: null,
    series: null
  });
  const locale = useLocalePreference();
  const copy = getWorkbenchCopy(locale);
  const coursesQuery = useQuery({
    queryKey: ["mobile", "workbench", "courses"],
    queryFn: () => listCoursesPage({ sort: "recent", pageSize: 6 })
  });
  const courses = coursesQuery.data?.items ?? [];
  const continueCourse = courses.find((course) => courseProgress(course) > 0) ?? courses[0];
  const recentCourses = continueCourse ? courses.filter((course) => course.id !== continueCourse.id) : courses;
  const currentGuideTarget = (copy.onboarding.steps[guideStepIndex]?.target ?? copy.onboarding.steps[0]?.target) as GuideTarget;

  const measureTargetLayout = (target: GuideTarget) => {
    if (process.env.NODE_ENV === "test") {
      return;
    }

    const node = targetRefs.current[target];
    if (!node || typeof node.measureInWindow !== "function") {
      return;
    }

    node.measureInWindow((x: number, y: number, width: number, height: number) => {
      setGuideLayouts((current) => ({
        ...current,
        [target]: { x, y, width, height }
      }));
    });
  };

  const handleTargetLayout = (target: GuideTarget) => () => {
    measureTargetLayout(target);
  };

  useEffect(() => {
    if (process.env.NODE_ENV === "test") {
      return;
    }
    if (!showOnboarding) {
      return;
    }

    measureTargetLayout(currentGuideTarget);
  }, [currentGuideTarget, coursesQuery.data?.items.length, showOnboarding]);

  const openOnboarding = () => {
    setGuideStepIndex(0);
    setGuideSessionKey((current) => current + 1);
    setShowOnboarding(true);
  };

  useEffect(() => {
    if (getCachedWorkbenchOnboardingCompleted() !== null) {
      return;
    }

    let active = true;

    void loadWorkbenchOnboardingCompleted().then((completed) => {
      if (!active) {
        return;
      }
      setShowOnboarding(!completed);
    });

    return () => {
      active = false;
    };
  }, []);

  const handleCompleteOnboarding = () => {
    setShowOnboarding(false);
    setGuideStepIndex(0);
    void saveWorkbenchOnboardingCompleted();
  };

  const guideCardStyle = (active: boolean) => ({
    borderWidth: active ? 2 : 1,
    borderColor: active ? tokens.highlight : tokens.border,
    borderRadius: 12,
    backgroundColor: active ? "rgba(215, 180, 106, 0.12)" : tokens.surface,
    shadowColor: active ? tokens.highlight : "transparent",
    shadowOpacity: active ? 0.22 : 0,
    shadowRadius: active ? 12 : 0,
    shadowOffset: { width: 0, height: 0 }
  });

  return (
    <View style={{ flex: 1 }}>
      <AppFrame
        title={copy.title}
        largeTitle={false}
        topContent={
          <View style={{ paddingBottom: 12 }}>
            <View
              ref={(node) => {
                targetRefs.current.import = node;
              }}
              testID="workbench-guide-target-import"
              onLayout={handleTargetLayout("import")}
              style={{
                marginHorizontal: 16,
                ...guideCardStyle(currentGuideTarget === "import"),
                padding: currentGuideTarget === "import" ? 2 : 1
              }}
            >
              <UrlImportBar
                value={url}
                onChangeText={setUrl}
                onOpen={(nextUrl) => {
                  router.push({ pathname: "/import/web", params: { url: nextUrl } });
                }}
                includeSafeArea={false}
                showBackButton={false}
              />
            </View>
          </View>
        }
      >
        <Screen>
          <View style={{ gap: 22 }}>
            {coursesQuery.isLoading ? <Text style={{ color: tokens.mutedText }}>加载中...</Text> : null}
            {coursesQuery.isError ? <Text style={{ color: tokens.danger }}>课程加载失败</Text> : null}

            {continueCourse ? (
              <View style={{ gap: 10 }}>
                <Text style={{ color: tokens.text, fontSize: 16, fontWeight: "700" }}>{copy.continueLearning}</Text>
                <View
                  ref={(node) => {
                    targetRefs.current.continue = node;
                  }}
                  testID="workbench-guide-target-continue"
                  onLayout={handleTargetLayout("continue")}
                  style={guideCardStyle(currentGuideTarget === "continue")}
                >
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: "/courses/[courseId]", params: { courseId: continueCourse.id } })}
                    style={({ pressed }) => ({
                      gap: 12,
                      padding: 16,
                      opacity: pressed ? 0.72 : 1
                    })}
                  >
                    <Text numberOfLines={2} style={{ color: tokens.text, fontSize: 18, fontWeight: "700" }}>
                      {continueCourse.title}
                    </Text>
                    <Text style={{ color: tokens.mutedText, fontSize: 13 }}>
                      {formatCourseMeta(continueCourse, locale)}
                      {formatUpdatedDate(continueCourse.updated_at, locale) ? ` · ${formatUpdatedDate(continueCourse.updated_at, locale)}` : ""}
                    </Text>
                    <ProgressLine progress={courseProgress(continueCourse)} />
                  </Pressable>
                </View>
                {coursesQuery.data?.pagination.total !== undefined ? (
                  <Text style={{ color: tokens.mutedText, fontSize: 12 }}>
                    {locale === "en" ? `${coursesQuery.data.pagination.total} courses` : `共 ${coursesQuery.data.pagination.total} 门课程`}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View
              ref={(node) => {
                targetRefs.current.library = node;
              }}
              testID="workbench-guide-target-library"
              onLayout={handleTargetLayout("library")}
              style={{
                gap: 8,
                padding: 16,
                ...guideCardStyle(currentGuideTarget === "library")
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="book-open" size={16} color={tokens.text} />
                <Text style={{ color: tokens.text, fontSize: 16, fontWeight: "700" }}>{copy.libraryPanelTitle}</Text>
              </View>
              <Text style={{ color: tokens.mutedText, fontSize: 13, lineHeight: 19 }}>{copy.libraryPanelBody}</Text>
              <Pressable
                accessibilityLabel={copy.libraryPanelAction}
                accessibilityRole="button"
                onPress={() => router.push("/(tabs)/library")}
                style={({ pressed }) => ({
                  minHeight: 40,
                  alignSelf: "flex-start",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 10,
                  backgroundColor: tokens.accent,
                  paddingHorizontal: 12,
                  opacity: pressed ? 0.82 : 1
                })}
              >
                <Text style={{ color: tokens.surface, fontSize: 13, fontWeight: "700" }}>{copy.libraryPanelAction}</Text>
              </Pressable>
            </View>

            <View
              ref={(node) => {
                targetRefs.current.series = node;
              }}
              testID="workbench-guide-target-series"
              onLayout={handleTargetLayout("series")}
              style={{
                gap: 8,
                padding: 16,
                ...guideCardStyle(currentGuideTarget === "series")
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="layers" size={16} color={tokens.text} />
                <Text style={{ color: tokens.text, fontSize: 16, fontWeight: "700" }}>{copy.seriesPanelTitle}</Text>
              </View>
              <Text style={{ color: tokens.mutedText, fontSize: 13, lineHeight: 19 }}>{copy.seriesPanelBody}</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Pressable
                  accessibilityLabel={copy.guideButtonLabel}
                  accessibilityRole="button"
                  onPress={openOnboarding}
                  style={({ pressed }) => ({
                    minHeight: 40,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: tokens.border,
                    backgroundColor: tokens.surface,
                    paddingHorizontal: 12,
                    opacity: pressed ? 0.76 : 1
                  })}
                >
                  <Text style={{ color: tokens.text, fontSize: 13, fontWeight: "700" }}>{copy.guideButtonLabel}</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={copy.seriesPanelAction}
                  accessibilityRole="button"
                  onPress={() => router.push("/(tabs)/library")}
                  style={({ pressed }) => ({
                    minHeight: 40,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 10,
                    backgroundColor: tokens.accent,
                    paddingHorizontal: 12,
                    opacity: pressed ? 0.82 : 1
                  })}
                >
                  <Text style={{ color: tokens.surface, fontSize: 13, fontWeight: "700" }}>{copy.seriesPanelAction}</Text>
                </Pressable>
              </View>
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ color: tokens.text, fontSize: 16, fontWeight: "700" }}>{copy.recentReading}</Text>
              {recentCourses.map((course) => (
                <CourseListRow
                  key={course.id}
                  course={course}
                  onPress={(courseId) => router.push({ pathname: "/courses/[courseId]", params: { courseId } })}
                />
              ))}
            </View>
          </View>
        </Screen>
      </AppFrame>
      <WorkbenchOnboardingSheet
        key={guideSessionKey}
        anchorLayout={guideLayouts[currentGuideTarget] ?? null}
        copy={copy.onboarding}
        visible={showOnboarding}
        onComplete={handleCompleteOnboarding}
        onStepChange={setGuideStepIndex}
      />
    </View>
  );
}
