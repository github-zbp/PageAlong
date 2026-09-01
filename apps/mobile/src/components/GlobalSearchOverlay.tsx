import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { searchCoursesByTitle, type CourseSummary } from "@/lib/api";
import { useTheme } from "@/providers/ThemeProvider";
import SearchResultRow from "@/components/SearchResultRow";

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenCourse: (courseId: string) => void;
  onSubmitSearch?: (query: string) => void;
};

function SkeletonRow({ color }: { color: string }) {
  return (
    <View style={{ minHeight: 68, justifyContent: "center", gap: 9, borderBottomWidth: 1, borderBottomColor: color, paddingHorizontal: 16 }}>
      <View style={{ width: "78%", height: 14, borderRadius: 4, backgroundColor: color }} />
      <View style={{ width: "52%", height: 10, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

export function GlobalSearchOverlay({ visible, onClose, onOpenCourse, onSubmitSearch }: Props) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const currentRequestId = ++requestId.current;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      void searchCoursesByTitle(trimmed)
        .then((nextResults) => {
          if (currentRequestId === requestId.current) setResults(nextResults);
        })
        .catch((nextError: unknown) => {
          if (currentRequestId === requestId.current) {
            setResults([]);
            setError(nextError instanceof Error ? nextError.message : "搜索失败");
          }
        })
        .finally(() => {
          if (currentRequestId === requestId.current) setLoading(false);
        });
    }, 1000);

    return () => clearTimeout(timer);
  }, [query, visible]);

  useEffect(() => {
    if (visible) {
      return;
    }
    requestId.current += 1;
    setQuery("");
    setResults([]);
    setLoading(false);
    setError("");
  }, [visible]);

  const handleOpenCourse = (courseId: string) => {
    onOpenCourse(courseId);
    onClose();
  };

  const clearSearch = () => {
    requestId.current += 1;
    setQuery("");
    setResults([]);
    setLoading(false);
    setError("");
  };

  const submitSearch = () => {
    const trimmed = query.trim();
    if (!trimmed || !onSubmitSearch) {
      return;
    }
    requestId.current += 1;
    setLoading(false);
    setError("");
    onSubmitSearch(trimmed);
    onClose();
  };

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: tokens.background }}>
        <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: tokens.surface }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: tokens.border, borderRadius: 8, backgroundColor: tokens.elevatedSurface, paddingHorizontal: 11 }}>
              <Feather name="search" size={17} color={tokens.mutedText} />
              <TextInput
                autoFocus
                accessibilityLabel="搜索课程"
                placeholder="搜索课程"
                placeholderTextColor={tokens.mutedText}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={submitSearch}
                returnKeyType="search"
                style={{ flex: 1, minHeight: 44, color: tokens.text, fontSize: 15 }}
              />
              {loading ? <ActivityIndicator size="small" color={tokens.mutedText} /> : null}
              {query.trim() ? (
                <Pressable accessibilityRole="button" accessibilityLabel="清空搜索" onPress={clearSearch} hitSlop={8}>
                  <Feather name="x-circle" size={18} color={tokens.mutedText} />
                </Pressable>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="关闭" onPress={onClose} hitSlop={10}>
              <Feather name="x" size={22} color={tokens.mutedText} />
            </Pressable>
          </View>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
          {loading ? [0, 1, 2].map((key) => <SkeletonRow key={key} color={tokens.border} />) : null}
          {!loading && error ? <Text style={{ color: tokens.danger, fontSize: 13, padding: 20 }}>{error}</Text> : null}
          {!loading && !error && query.trim() && results.length === 0 ? (
            <Text style={{ color: tokens.mutedText, fontSize: 13, padding: 20 }}>没有找到相关课程</Text>
          ) : null}
          {!loading && !error ? results.map((course) => <SearchResultRow key={course.id} course={course} onPress={() => handleOpenCourse(course.id)} />) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default GlobalSearchOverlay;
