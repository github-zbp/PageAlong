import { describe, expect, it } from "vitest";
import { PAGEALONG_API_BASE_URL, PAGEALONG_WEB_BASE_URL } from "../src/lib/config";

describe("extension config defaults", () => {
  it("uses the production service base urls by default", () => {
    expect(PAGEALONG_API_BASE_URL).toBe("https://web-reader.zbpblog.cn/api");
    expect(PAGEALONG_WEB_BASE_URL).toBe("https://web-reader.zbpblog.cn");
  });
});
