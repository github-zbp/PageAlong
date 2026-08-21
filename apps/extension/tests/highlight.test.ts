import { describe, expect, it } from "vitest";
import { clearHighlight, highlightTextInDocument } from "../src/lib/highlight";

describe("highlightTextInDocument", () => {
  it("wraps and clears matched text", () => {
    document.body.innerHTML = "<main><p>第一句。第二句。</p></main>";

    const highlighted = highlightTextInDocument(document, "第二句。", "amber", false);

    expect(highlighted).toBe(true);
    expect(document.querySelector(".pa-ext-current-sentence")?.textContent).toBe("第二句。");
    clearHighlight(document);
    expect(document.querySelector(".pa-ext-current-sentence")).toBeNull();
    expect(document.body.textContent).toContain("第一句。第二句。");
  });
});
