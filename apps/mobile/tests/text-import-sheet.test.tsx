import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { createTextCourse } from "@/lib/api";
import { TextImportSheet } from "@/components/TextImportSheet";

const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({
    replace: mockReplace,
    back: mockBack
  }))
}));

jest.mock("@/lib/api", () => ({
  createTextCourse: jest.fn()
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
    },
    setMode: jest.fn(),
    toggleMode: jest.fn()
  })
}));

const mockedCreateTextCourse = createTextCourse as jest.MockedFunction<typeof createTextCourse>;

beforeEach(() => {
  jest.clearAllMocks();
});

it("creates a text course from the sheet", async () => {
  mockedCreateTextCourse.mockResolvedValueOnce({ id: "course-text" } as never);

  const screen = await render(<TextImportSheet visible onClose={jest.fn()} />);

  fireEvent.changeText(screen.getByPlaceholderText("标题，可选"), "通勤笔记");
  fireEvent.changeText(screen.getByPlaceholderText("粘贴要转成课程的文本"), "第一段内容。");
  await waitFor(() => {
    expect(screen.getByDisplayValue("通勤笔记")).toBeTruthy();
    expect(screen.getByDisplayValue("第一段内容。")).toBeTruthy();
  });
  fireEvent.press(screen.getByText("完成"));

  await waitFor(() => {
    expect(mockedCreateTextCourse).toHaveBeenCalledWith({
      title: "通勤笔记",
      text: "第一段内容。"
    });
  });
  expect(mockReplace).toHaveBeenCalledWith("/(tabs)/downloads");
});
