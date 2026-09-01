import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { TaskRow } from "@/components/TaskRow";
import type { TaskRowModel } from "@/lib/tasks";

jest.mock("@/lib/api", () => ({
  resolveApiUrl: jest.fn((value: string) => value)
}));

jest.mock("@/lib/locale", () => ({
  useLocalePreference: jest.fn(() => "zh"),
  resetLocalePreferenceForTests: jest.fn()
}));

jest.mock("@/providers/ThemeProvider", () => ({
  useTheme: () => ({
    mode: "light",
    tokens: {
      background: "#F7F4ED",
      surface: "#FFFDF8",
      elevatedSurface: "#FFFFFF",
      border: "#E5DED2",
      text: "#171717",
      mutedText: "#6B6760",
      accent: "#2F6F5E",
      highlight: "#D7B46A",
      danger: "#A33A2B"
    }
  })
}));

const taskFixture: TaskRowModel = {
  id: "task-1",
  source: "job",
  title: "课程标题",
  subtitle: "PDF 导出",
  typeLabel: "PDF 导出",
  status: "succeeded",
  group: "completed",
  progress: 1,
  errorMessage: null,
  updatedAt: "2026-08-27T00:00:00.000Z",
  downloadUrl: "https://media.pagealong.test/downloads/course.pdf",
  courseId: "course-1"
};

it("renders completed tasks as a circular download action", async () => {
  const screen = await render(<TaskRow task={taskFixture} />);

  expect(screen.queryByText("已完成")).toBeNull();
  const button = screen.getByRole("button", { name: "下载 课程标题" });
  expect(StyleSheet.flatten(button.props.style)).toEqual(
    expect.objectContaining({
      width: 32,
      height: 32,
      borderRadius: 16
    })
  );
});
