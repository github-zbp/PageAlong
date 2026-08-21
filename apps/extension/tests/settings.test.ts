import { describe, expect, it } from "vitest";
import { defaultSettings, normalizeSettings } from "../src/lib/settings";

describe("normalizeSettings", () => {
  it("keeps supported values and falls back for invalid values", () => {
    expect(normalizeSettings({ highlightColor: "green", playbackRate: 1.25 })).toMatchObject({
      highlightColor: "green",
      playbackRate: 1.25,
      sidebarEnabled: true,
      autoScroll: true
    });
    expect(normalizeSettings({ highlightColor: "neon", playbackRate: 9 })).toEqual(defaultSettings);
  });
});
