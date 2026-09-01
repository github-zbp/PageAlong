import { fireEvent, render, waitFor } from "@testing-library/react-native";
import * as DocumentPicker from "expo-document-picker";
import { createFileImportBatch } from "@/lib/api";
import { FileImportButton } from "@/components/FileImportButton";

const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({
    replace: mockReplace,
    back: mockBack
  }))
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn()
}));

jest.mock("@/lib/api", () => ({
  createFileImportBatch: jest.fn()
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

const mockedCreateFileImportBatch = createFileImportBatch as jest.MockedFunction<typeof createFileImportBatch>;
const mockedGetDocumentAsync = DocumentPicker.getDocumentAsync as jest.MockedFunction<typeof DocumentPicker.getDocumentAsync>;

beforeEach(() => {
  jest.clearAllMocks();
});

it("uploads selected files through the button", async () => {
  mockedGetDocumentAsync.mockResolvedValueOnce({
    canceled: false,
    assets: [
      {
        uri: "file:///a.md",
        name: "a.md",
        mimeType: "text/markdown",
        relativePath: "notes/a.md"
      }
    ]
  } as never);
  mockedCreateFileImportBatch.mockResolvedValueOnce({ id: "batch-1" } as never);

  const screen = await render(<FileImportButton />);

  fireEvent.press(screen.getByText("文件导入"));

  await waitFor(() => {
    expect(mockedCreateFileImportBatch).toHaveBeenCalledWith({
      files: [
        {
          uri: "file:///a.md",
          name: "a.md",
          type: "text/markdown",
          relativePath: "notes/a.md"
        }
      ],
      sourceMode: "single_file"
    });
  });
  expect(mockReplace).toHaveBeenCalledWith("/(tabs)/downloads");
});
