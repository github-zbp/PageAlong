jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();

  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      clear: jest.fn(async () => {
        store.clear();
      })
    }
  };
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getThemeTokens, loadThemeMode, saveThemeMode } from "@/lib/theme";

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(async () => {
  await AsyncStorage.clear();
});

it("returns separate day and night tokens", () => {
  expect(getThemeTokens("light").background).not.toBe(getThemeTokens("dark").background);
  expect(getThemeTokens("light").surface).not.toBe(getThemeTokens("dark").surface);
});

it("persists the selected theme mode", async () => {
  await saveThemeMode("dark");

  await expect(loadThemeMode()).resolves.toBe("dark");
});

it("falls back when persisted theme cannot be loaded", async () => {
  mockedAsyncStorage.getItem.mockRejectedValueOnce(new Error("Native module is null"));

  await expect(loadThemeMode()).resolves.toBeNull();
});

it("ignores theme persistence failures", async () => {
  mockedAsyncStorage.setItem.mockRejectedValueOnce(new Error("Native module is null"));

  await expect(saveThemeMode("dark")).resolves.toBeUndefined();
});
