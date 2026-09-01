import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppFrame } from "@/components/AppFrame";
import { EmptyState } from "@/components/EmptyState";
import SearchResultRow from "@/components/SearchResultRow";
import { searchCoursesByTitle, type CourseSummary } from "@/lib/api";
import { useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";

function toSingleValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function searchCopy(locale: "zh" | "en") {
  if (locale === "en") {
    return {
      title: "Search results",
      subtitle: (query: string) => `Course title: ${query}`,
      emptyQuery: "Enter a keyword to search courses.",
      empty: "No related courses found.",
      loading: "Searching courses...",
      error: "Search failed"
    };
  }

  return {
    title: "搜索结果",
    subtitle: (query: string) => `搜索课程：${query}`,
    emptyQuery: "输入关键词后搜索课程。",
    empty: "没有找到相关课程",
    loading: "正在搜索课程...",
    error: "搜索失败"
  };
}

export default function SearchScreen() {
  const { tokens } = useTheme();
  const router = useRouter();
  const locale = useLocalePreference();
  const copy = searchCopy(locale);
  const params = useLocalSearchParams<{ query?: string | string[] }>();
  const query = toSingleValue(params.query).trim();
  const [results, setResults] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!query) {
      setResults([]);
      setLoading(false);
      setError("");
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError("");
    void searchCoursesByTitle(query)
      .then((nextResults) => {
        if (active) {
          setResults(nextResults);
        }
      })
      .catch(() => {
        if (active) {
          setResults([]);
          setError(copy.error);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [copy.error, query]);

  return (
    <AppFrame title={copy.title} subtitle={query ? copy.subtitle(query) : undefined} largeTitle={false}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
        {loading ? <EmptyState title={copy.loading} loading /> : null}
        {!loading && error ? <Text style={{ color: tokens.danger, fontSize: 13, padding: 20 }}>{error}</Text> : null}
        {!loading && !error && !query ? <EmptyState title={copy.emptyQuery} icon="search" /> : null}
        {!loading && !error && query && results.length === 0 ? <EmptyState title={copy.empty} icon="search" /> : null}
        {!loading && !error
          ? results.map((course) => (
              <SearchResultRow
                key={course.id}
                course={course}
                onPress={() => router.push({ pathname: "/courses/[courseId]", params: { courseId: course.id } })}
              />
            ))
          : null}
      </ScrollView>
    </AppFrame>
  );
}
