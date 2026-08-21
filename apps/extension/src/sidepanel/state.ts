import type { ExtractedArticle } from "../lib/types";

export type PanelTab = "reader" | "sync" | "settings";
export type PlaybackState = "idle" | "playing" | "paused" | "failed";
export type SyncState = "idle" | "checking_auth" | "submitting" | "extracting_text" | "audio_generating" | "ready" | "failed";
export type SyncedCourseSummary = {
  id: string;
  status: string;
  title?: string;
};

export type PanelState = {
  tab: PanelTab;
  article: ExtractedArticle | null;
  playbackState: PlaybackState;
  activeSentenceIndex: number;
  syncState: SyncState;
  error: string;
  lastSyncedCourse: SyncedCourseSummary | null;
};

export const initialPanelState: PanelState = {
  tab: "reader",
  article: null,
  playbackState: "idle",
  activeSentenceIndex: -1,
  syncState: "idle",
  error: "",
  lastSyncedCourse: null
};

export type PanelAction =
  | { type: "HYDRATE"; state: Partial<PanelState> }
  | { type: "ARTICLE_LOADED"; article: ExtractedArticle }
  | { type: "PLAYING"; index: number }
  | { type: "PAUSED" }
  | { type: "STOPPED" }
  | { type: "SYNC_STATE"; syncState: SyncState }
  | { type: "SYNC_SUCCESS"; course: SyncedCourseSummary }
  | { type: "FAILED"; message: string; scope?: "playback" | "sync" }
  | { type: "TAB"; tab: PanelTab };

export function panelReducer(state: PanelState, action: PanelAction): PanelState {
  if (action.type === "HYDRATE") {
    return { ...state, ...action.state };
  }
  if (action.type === "ARTICLE_LOADED") {
    return {
      ...state,
      article: action.article,
      playbackState: "idle",
      activeSentenceIndex: -1,
      syncState: "idle",
      error: "",
      lastSyncedCourse: null
    };
  }
  if (action.type === "PLAYING") {
    return { ...state, playbackState: "playing", activeSentenceIndex: action.index };
  }
  if (action.type === "PAUSED") {
    return { ...state, playbackState: "paused" };
  }
  if (action.type === "STOPPED") {
    return { ...state, playbackState: "idle", activeSentenceIndex: -1 };
  }
  if (action.type === "SYNC_STATE") {
    return { ...state, syncState: action.syncState, error: "" };
  }
  if (action.type === "SYNC_SUCCESS") {
    return { ...state, lastSyncedCourse: action.course, error: "" };
  }
  if (action.type === "FAILED") {
    return {
      ...state,
      playbackState: action.scope === "sync" ? state.playbackState : "failed",
      syncState: action.scope === "playback" ? state.syncState : "failed",
      error: action.message
    };
  }
  return { ...state, tab: action.tab };
}
