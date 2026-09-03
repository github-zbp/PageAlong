import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { WorkbenchOnboardingSheet } from "@/components/WorkbenchOnboardingSheet";

jest.mock("@/providers/ThemeProvider", () => ({
  useTheme: () => ({
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

const onboardingCopy = {
  title: "工作台引导",
  subtitle: "快速了解工作台的四个步骤",
  steps: [
    { key: "import", target: "import", title: "先导入内容", body: "把文本、网页或文件导进来。" },
    { key: "continue", target: "continue", title: "回到工作台继续", body: "从最近进度接着学。" },
    { key: "library", target: "library", title: "去课程库整理", body: "按系列和标签管理内容。" },
    { key: "series", target: "series", title: "了解系列课程", body: "把相关课程放在一起按顺序学。" }
  ],
  next: "下一步",
  complete: "完成",
  stepLabel: (current: number, total: number) => `${current}/${total}`
};

it("renders a precise anchored hole and advances through four steps", async () => {
  const screen = await render(
    <WorkbenchOnboardingSheet
      anchorLayout={{ x: 24, y: 96, width: 320, height: 44 }}
      copy={onboardingCopy}
      visible
      onComplete={jest.fn()}
    />
  );

  expect(screen.getByText("先导入内容")).toBeTruthy();
  expect(StyleSheet.flatten(screen.getByTestId("workbench-guide-target-import").props.style)).toEqual(
    expect.objectContaining({
      top: 96,
      left: 24,
      width: 320,
      height: 44,
      borderColor: "#D7B46A"
    })
  );

  await screen.findByText("先导入内容");

  const pressNext = async () => {
    fireEvent.press(screen.getByRole("button", { name: "下一步" }));
    await new Promise((resolve) => setTimeout(resolve, 80));
  };

  await pressNext();
  await screen.findByText("回到工作台继续");

  await pressNext();
  await screen.findByText("去课程库整理");

  await pressNext();
  await screen.findByText("了解系列课程");
});
