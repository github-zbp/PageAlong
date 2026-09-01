import { Text, View } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { TaskRow } from "@/components/TaskRow";
import type { TaskRowModel } from "@/lib/tasks";

type Props = {
  title: string;
  rows: TaskRowModel[];
  onPressRow?: (task: TaskRowModel) => void;
};

export function TaskGroup({ title, rows, onPressRow }: Props) {
  const { tokens } = useTheme();
  if (rows.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 }}>
        <Text style={{ color: tokens.text, fontSize: 14, fontWeight: "600" }}>{title}</Text>
        <Text style={{ color: tokens.mutedText, fontSize: 12 }}>{rows.length}</Text>
      </View>
      <View style={{ gap: 8 }}>
        {rows.map((task) => (
          <TaskRow key={task.id} task={task} onPress={onPressRow ? () => onPressRow(task) : undefined} />
        ))}
      </View>
    </View>
  );
}

export default TaskGroup;
