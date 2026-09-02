import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
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

export default function WorkbenchScreen() {
  const { tokens } = useTheme();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(() => getCachedWorkbenchOnboardingCompleted() === false);
  const locale = useLocalePreference();
  const copy = getWorkbenchCopy(locale);
  const coursesQuery = useQuery({
    queryKey: ["mobile", "workbench", "courses"],
    queryFn: () => listCoursesPage({ sort: "recent", pageSize: 6 })
  });
  const courses = coursesQuery.data?.items ?? [];
  const continueCourse = courses.find((course) => courseProgress(course) > 0) ?? courses[0];
  const recentCourses = continueCourse ? courses.filter((course) => course.id !== continueCourse.id) : courses;

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
    void saveWorkbenchOnboardingCompleted();
  };

  return (
    <View style={{ flex: 1 }}>
      <AppFrame
        title={copy.title}
        largeTitle={false}
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
        <Screen>
          <View style={{ gap: 22 }}>
            {coursesQuery.isLoading ? <Text style={{ color: tokens.mutedText }}>加载中...</Text> : null}
            {coursesQuery.isError ? <Text style={{ color: tokens.danger }}>课程加载失败</Text> : null}
            {continueCourse ? (
              <View style={{ gap: 10 }}>
                <Text style={{ color: tokens.text, fontSize: 16, fontWeight: "700" }}>{copy.continueLearning}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: "/courses/[courseId]", params: { courseId: continueCourse.id } })}
                  style={({ pressed }) => ({
                    gap: 12,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: tokens.border,
                    borderRadius: 10,
                    backgroundColor: tokens.surface,
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
                {coursesQuery.data?.pagination.total !== undefined ? (
                  <Text style={{ color: tokens.mutedText, fontSize: 12 }}>
                    {locale === "en" ? `${coursesQuery.data.pagination.total} courses` : `共 ${coursesQuery.data.pagination.total} 门课程`}
                  </Text>
                ) : null}
              </View>
            ) : null}

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
      <WorkbenchOnboardingSheet copy={copy.onboarding} visible={showOnboarding} onComplete={handleCompleteOnboarding} />
    </View>
  );
}
