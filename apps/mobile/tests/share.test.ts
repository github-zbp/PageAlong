jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();

  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      clear: jest.fn(async () => {
        store.clear();
      })
    }
  };
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeWebUrl } from "@/lib/url";
import {
  clearPendingShare,
  extractSharedUrl,
  getPostLoginRedirect,
  loadPendingShare,
  resolveIncomingSharePath,
  savePendingShare
} from "@/lib/share";

beforeEach(async () => {
  await AsyncStorage.clear();
});

it("normalizes web urls for shared import handling", () => {
  expect(normalizeWebUrl("pagealong.app/article")).toBe("https://pagealong.app/article");
  expect(normalizeWebUrl("  https://example.com/a  ")).toBe("https://example.com/a");
  expect(normalizeWebUrl("mailto:test@example.com")).toBeNull();
});

it("extracts the first valid shared url", () => {
  expect(
    extractSharedUrl([
      { value: "not a link" },
      { value: "https://example.com/article" }
    ])
  ).toEqual({ url: "https://example.com/article" });
});

it("persists and clears pending shares across login", async () => {
  await savePendingShare({ url: "https://example.com/article" });

  await expect(loadPendingShare()).resolves.toEqual({ url: "https://example.com/article" });
  await expect(getPostLoginRedirect()).resolves.toBe("/share/receive");

  await clearPendingShare();

  await expect(loadPendingShare()).resolves.toBeNull();
  await expect(getPostLoginRedirect()).resolves.toBe("/(tabs)/workbench");
});

it("redirects expo sharing intents to the share handler", () => {
  expect(resolveIncomingSharePath("exp://expo-sharing?foo=1")).toBe("/share/receive");
  expect(resolveIncomingSharePath("/courses/abc")).toBe("/courses/abc");
});
