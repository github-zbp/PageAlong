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
import {
  defaultReaderPreferences,
  loadLocalePreference,
  loadReaderPreferences,
  saveReaderPreferences,
  saveLocalePreference
} from "@/lib/preferences";

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(async () => {
  await AsyncStorage.clear();
});

it("persists reader preferences", async () => {
  await saveReaderPreferences({ fontSize: "large", lineHeight: "loose", playbackRate: 1.25 });

  await expect(loadReaderPreferences()).resolves.toEqual({
    fontSize: "large",
    lineHeight: "loose",
    playbackRate: 1.25
  });
});

it("falls back to defaults for malformed reader preferences", async () => {
  await AsyncStorage.setItem("pagealong.reader.preferences", "not-json");

  await expect(loadReaderPreferences()).resolves.toEqual(defaultReaderPreferences);
});

it("ignores invalid locale preference", async () => {
  await AsyncStorage.setItem("pagealong.locale", "fr");

  await expect(loadLocalePreference()).resolves.toBeNull();
});

it("persists a supported locale preference", async () => {
  await saveLocalePreference("en");

  await expect(loadLocalePreference()).resolves.toBe("en");
});

it("falls back when preference storage fails", async () => {
  mockedAsyncStorage.getItem.mockRejectedValueOnce(new Error("Native module is null"));
  await expect(loadReaderPreferences()).resolves.toEqual(defaultReaderPreferences);

  mockedAsyncStorage.setItem.mockRejectedValueOnce(new Error("Native module is null"));
  await expect(saveReaderPreferences(defaultReaderPreferences)).resolves.toBeUndefined();
});
