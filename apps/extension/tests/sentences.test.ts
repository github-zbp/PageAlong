import { describe, expect, it } from "vitest";
import { splitIntoSentences } from "../src/lib/sentences";

describe("splitIntoSentences", () => {
  it("splits Chinese and English text into stable sentence units", () => {
    expect(splitIntoSentences("第一句。第二句！What next? Done.")).toEqual([
      "第一句。",
      "第二句！",
      "What next?",
      "Done."
    ]);
  });
});
