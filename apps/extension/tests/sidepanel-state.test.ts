import { describe, expect, it } from "vitest";
import { initialPanelState, panelReducer } from "../src/sidepanel/state";

describe("panelReducer", () => {
  it("tracks article, playback, sync, and errors", () => {
    const loaded = panelReducer(initialPanelState, {
      type: "ARTICLE_LOADED",
      article: {
        url: "https://example.com/a",
        title: "标题",
        sourceDomain: "example.com",
        articleHtml: "<p>第一句。</p>",
        textExcerpt: "第一句。",
        images: [],
        sentences: [{ index: 0, text: "第一句。" }]
      }
    });
    const playing = panelReducer(loaded, { type: "PLAYING", index: 0 });
    const syncing = panelReducer(playing, { type: "SYNC_STATE", syncState: "audio_generating" });

    expect(syncing.article?.title).toBe("标题");
    expect(syncing.playbackState).toBe("playing");
    expect(syncing.activeSentenceIndex).toBe(0);
    expect(syncing.syncState).toBe("audio_generating");
  });

  it("keeps unrelated status when a scoped failure occurs", () => {
    const playbackState = panelReducer(
      {
        ...initialPanelState,
        playbackState: "playing",
        syncState: "submitting"
      },
      {
        type: "FAILED",
        scope: "sync",
        message: "同步失败"
      }
    );

    expect(playbackState.playbackState).toBe("playing");
    expect(playbackState.syncState).toBe("failed");
    expect(playbackState.error).toBe("同步失败");
  });
});
