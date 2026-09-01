import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { retryFailedCourseJob, retryFileImportBatch } from "@/lib/api";
import { getTaskCopy } from "@/lib/i18n";
import { useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";
import { TaskStatusPill } from "@/components/TaskStatusPill";
import type { TaskRowModel } from "@/lib/tasks";

type Props = {
  visible: boolean;
  task: TaskRowModel | null;
  onClose: () => void;
  onRetried: () => void;
};

export function TaskRetrySheet({ visible, task, onClose, onRetried }: Props) {
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const copy = getTaskCopy(locale);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) {
      setLoading(false);
      setError("");
    }
  }, [visible]);

  async function handleRetry() {
    if (!task || loading) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (task.source === "job") {
        if (!task.courseId) {
          throw new Error(copy.retrySheet.missingCourseInfo);
        }
        await retryFailedCourseJob(task.courseId);
      } else {
        await retryFileImportBatch(task.id);
      }
      onRetried();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : copy.retrySheet.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)" }}
          onPress={onClose}
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
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={{ color: tokens.text, fontSize: 16, fontWeight: "600" }}>{task?.title ?? copy.retrySheet.title}</Text>
              <TaskStatusPill status={task?.status ?? "failed"} />
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10}>
              <Feather name="x" size={18} color={tokens.mutedText} />
            </Pressable>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ color: tokens.mutedText, fontSize: 12 }}>{task?.typeLabel ?? ""}</Text>
            <Text style={{ color: tokens.text, fontSize: 14, lineHeight: 22 }}>{task?.errorMessage || copy.retrySheet.noFailureReason}</Text>
          </View>

          {error ? <Text style={{ color: tokens.danger, fontSize: 12, lineHeight: 18 }}>{error}</Text> : null}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: tokens.border,
                borderRadius: 10,
                paddingVertical: 12,
                backgroundColor: tokens.surface,
                opacity: loading ? 0.7 : 1
              }}
            >
              <Text style={{ color: tokens.text, fontSize: 14, fontWeight: "600" }}>{copy.retrySheet.close}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={loading || !task}
              onPress={handleRetry}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderRadius: 10,
                paddingVertical: 12,
                backgroundColor: tokens.accent,
                opacity: loading || !task ? 0.6 : 1
              }}
            >
              {loading ? <ActivityIndicator color={tokens.surface} /> : null}
              <Text style={{ color: tokens.surface, fontSize: 14, fontWeight: "600" }}>{copy.retrySheet.retry}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default TaskRetrySheet;
