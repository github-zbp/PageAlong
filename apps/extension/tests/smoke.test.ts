import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import manifest from "../manifest.json";

describe("extension manifest", () => {
  it("uses manifest v3 with side panel and tts permission", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toContain("sidePanel");
    expect(manifest.permissions).toContain("tts");
    expect(manifest.permissions).toContain("cookies");
    expect(manifest.side_panel.default_path).toBe("sidepanel.html");
    expect(manifest.host_permissions).toEqual(["https://web-reader.zbpblog.cn/*"]);
  });

  it("declares toolbar and extension icons", () => {
    const expectedIcons = {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    };

    expect(manifest.action.default_icon).toEqual(expectedIcons);
    expect(manifest.icons).toEqual(expectedIcons);

    for (const iconPath of Object.values(expectedIcons)) {
      expect(existsSync(resolve(__dirname, "..", "public", iconPath))).toBe(true);
    }
  });

  it("opens the toolbar action as a popup", () => {
    expect(manifest.action.default_popup).toBe("popup.html");
    expect(existsSync(resolve(__dirname, "..", "popup.html"))).toBe(true);
  });
});
