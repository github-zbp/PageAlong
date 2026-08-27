import {
  ChevronLeft,
  ChevronRight,
  CircleStop,
  CloudUpload,
  ExternalLink,
  PanelLeft,
  PanelRight,
  Pause,
  Play,
  Settings
} from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { PageAlongClient } from "../lib/api";
import type { ContentRequestMessage, ContentResponseMessage } from "../lib/messages";
import { readPanelState, writePanelState } from "../lib/session";
import { defaultSettings, readSettings, writeSettings } from "../lib/settings";
import { createTtsController } from "../lib/ttsController";
import type { ExtensionSettings, ExtractedArticle } from "../lib/types";
import { initialPanelState, panelReducer, type SyncState, type SyncedCourseSummary } from "./state";

type ViewMode = "sidepanel" | "page" | "popup";
type SourceContext = {
  tabId: number;
  url: string;
  title: string;
};

const rateOptions = [0.75, 1, 1.25, 1.5, 2];
const colorOptions: ExtensionSettings["highlightColor"][] = ["amber", "green", "blue", "purple", "coral"];

function parseViewMode(): ViewMode {
  const view = new URLSearchParams(window.location.search).get("view");
  if (view === "page") {
    return "page";
  }
  if (view === "popup" || window.location.pathname.endsWith("popup.html")) {
    return "popup";
  }
  return "sidepanel";
}

function parseTabId(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isUnsupportedSourceUrl(url: string): boolean {
  if (!url) {
    return false;
  }
  return /^(chrome|edge|about|view-source|devtools|chrome-extension|moz-extension):/i.test(url) || /chrome\.google\.com\/webstore/i.test(url);
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function buildPageModeUrl(context: SourceContext): string {
  const url = new URL(chrome.runtime.getURL("sidepanel.html"));
  url.searchParams.set("view", "page");
  url.searchParams.set("sourceTabId", String(context.tabId));
  if (context.url) {
    url.searchParams.set("sourceUrl", context.url);
  }
  if (context.title) {
    url.searchParams.set("sourceTitle", context.title);
  }
  return url.toString();
}

function isAuthError(message: string): boolean {
  return message.includes("未登录") || message.includes("Authentication") || message.includes("401");
}

function courseStatusToSyncState(status: string): SyncState {
  if (status === "audio_generating") {
    return "audio_generating";
  }
  if (status === "ready" || status === "text_ready") {
    return "ready";
  }
  return "extracting_text";
}

function syncStatusCopy(syncState: SyncState, course: SyncedCourseSummary | null): string {
  if (syncState === "checking_auth") {
    return "正在检测 PageAlong 登录态。";
  }
  if (syncState === "submitting") {
    return "正在提交同步任务。";
  }
  if (syncState === "audio_generating") {
    return "正文已保存，正在生成音频。";
  }
  if (syncState === "extracting_text") {
    return "已提交，正在提取正文并生成音频。";
  }
  if (syncState === "ready") {
    if (course?.status === "text_ready") {
      return "正文已保存，音频生成未开始。";
    }
    if (course?.status === "audio_generating") {
      return "正文已保存，正在生成音频。";
    }
    return "课程已同步完成。";
  }
  if (syncState === "failed") {
    return "同步失败，请重试。";
  }
  return "收藏后可免费在 PageAlong 反复听、下载音频/PDF/Markdown、按句回放、整理为课程、生成AI笔记";
}

function currentSourceLabel(article: ExtractedArticle | null, sourceContext: SourceContext | null): string {
  if (article?.title) {
    return article.title;
  }
  if (sourceContext?.title) {
    return sourceContext.title;
  }
  return "正在剪藏当前网页";
}

function currentSourceDomain(article: ExtractedArticle | null, sourceContext: SourceContext | null): string {
  if (article?.sourceDomain) {
    return article.sourceDomain;
  }
  if (sourceContext?.url) {
    return hostnameFromUrl(sourceContext.url);
  }
  return "";
}

async function sendToContent<T extends ContentResponseMessage>(tabId: number, message: ContentRequestMessage): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message) as Promise<T>;
}

export function App() {
  const viewMode = useMemo(parseViewMode, []);
  const [state, dispatch] = useReducer(panelReducer, initialPanelState);
  const [settings, setSettings] = useState(defaultSettings);
  const [sourceContext, setSourceContext] = useState<SourceContext | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const pageAlongClient = useMemo(() => new PageAlongClient(), []);
  const tts = useMemo(() => {
    try {
      return createTtsController();
    } catch {
      return null;
    }
  }, []);
  const playbackSessionRef = useRef(0);
  const sourceContextRef = useRef<SourceContext | null>(null);

  async function resolveSourceContext(): Promise<SourceContext> {
    const searchParams = new URLSearchParams(window.location.search);
    const sourceTabId = parseTabId(searchParams.get("sourceTabId"));
    const sourceUrl = searchParams.get("sourceUrl") ?? "";
    const sourceTitle = searchParams.get("sourceTitle") ?? "";
    if (sourceTabId !== null) {
      return {
        tabId: sourceTabId,
        url: sourceUrl,
        title: sourceTitle
      };
    }
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    const tabId = tab?.id;
    if (typeof tabId !== "number") {
      throw new Error("无法读取当前标签页");
    }
    return {
      tabId,
      url: tab.url ?? sourceUrl,
      title: tab.title ?? sourceTitle
    };
  }

  async function ensureContentScript(tabId: number): Promise<void> {
    try {
      await sendToContent(tabId, { type: "PA_PING" });
      return;
    } catch {
      // fall through to injection
    }
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["contentScript.js"]
    });
    await sendToContent(tabId, { type: "PA_PING" }).catch(() => undefined);
  }

  async function clearPageHighlight(): Promise<void> {
    const tabId = sourceContextRef.current?.tabId;
    if (typeof tabId !== "number") {
      return;
    }
    await sendToContent(tabId, { type: "PA_CLEAR_HIGHLIGHT" }).catch(() => undefined);
  }

  async function highlightSentence(text: string): Promise<void> {
    const tabId = sourceContextRef.current?.tabId;
    if (typeof tabId !== "number") {
      return;
    }
    await sendToContent(tabId, {
      type: "PA_HIGHLIGHT_SENTENCE",
      text,
      color: settings.highlightColor,
      autoScroll: settings.autoScroll
    }).catch(() => undefined);
  }

  async function clipCurrentPage(context = sourceContextRef.current): Promise<void> {
    const resolvedContext = context ?? (await resolveSourceContext());
    sourceContextRef.current = resolvedContext;
    setSourceContext(resolvedContext);

    if (isUnsupportedSourceUrl(resolvedContext.url)) {
      dispatch({
        type: "HYDRATE",
        state: {
          article: null,
          playbackState: "idle",
          activeSentenceIndex: -1,
          syncState: "idle",
          error: "当前页面无法剪藏，请使用收藏按钮让 PageAlong 尝试抓取。",
          lastSyncedCourse: null
        }
      });
      return;
    }

    try {
      await ensureContentScript(resolvedContext.tabId);
      const response = await sendToContent<ContentResponseMessage>(resolvedContext.tabId, { type: "PA_EXTRACT_ARTICLE" });
      if (response.type !== "PA_ARTICLE_EXTRACTED") {
        throw new Error(response.message);
      }
      dispatch({ type: "ARTICLE_LOADED", article: response.article });
    } catch (error) {
      dispatch({
        type: "HYDRATE",
        state: {
          article: null,
          playbackState: "idle",
          activeSentenceIndex: -1,
          syncState: "idle",
          error: error instanceof Error ? error.message : "当前页面无法剪藏",
          lastSyncedCourse: null
        }
      });
    }
  }

  async function startPlayback(startIndex: number): Promise<void> {
    const article = state.article;
    if (!tts) {
      dispatch({ type: "FAILED", message: "Chrome TTS 不可用", scope: "playback" });
      return;
    }
    if (!article || article.sentences.length === 0) {
      dispatch({ type: "FAILED", message: "当前页面没有可朗读的正文", scope: "playback" });
      return;
    }
    const normalizedIndex = Math.max(0, Math.min(startIndex, article.sentences.length - 1));
    const queue = article.sentences.slice(normalizedIndex);
    if (queue.length === 0) {
      dispatch({ type: "FAILED", message: "当前页面没有可朗读的正文", scope: "playback" });
      return;
    }

    playbackSessionRef.current += 1;
    const sessionId = playbackSessionRef.current;
    tts.stop();
    await clearPageHighlight();
    dispatch({ type: "PLAYING", index: queue[0].index });

    await tts.play(queue, {
      rate: settings.playbackRate,
      onActiveIndex: (index) => {
        if (sessionId !== playbackSessionRef.current) {
          return;
        }
        dispatch({ type: "PLAYING", index });
        const sentence = article.sentences.find((item) => item.index === index);
        if (sentence) {
          void highlightSentence(sentence.text);
        }
      },
      onFinished: () => {
        if (sessionId !== playbackSessionRef.current) {
          return;
        }
        dispatch({ type: "STOPPED" });
        void clearPageHighlight();
      },
      onError: (message) => {
        if (sessionId !== playbackSessionRef.current) {
          return;
        }
        dispatch({ type: "FAILED", message, scope: "playback" });
      }
    });
  }

  async function togglePlayback(): Promise<void> {
    if (!tts) {
      dispatch({ type: "FAILED", message: "Chrome TTS 不可用", scope: "playback" });
      return;
    }
    if (state.playbackState === "playing") {
      await pausePlayback();
      return;
    }
    if (state.playbackState === "paused") {
      tts.resume();
      dispatch({ type: "PLAYING", index: state.activeSentenceIndex >= 0 ? state.activeSentenceIndex : 0 });
      return;
    }
    const startIndex = state.activeSentenceIndex >= 0 ? state.activeSentenceIndex : 0;
    await startPlayback(startIndex);
  }

  async function pausePlayback(): Promise<void> {
    if (!tts || state.playbackState !== "playing") {
      return;
    }
    tts.pause();
    dispatch({ type: "PAUSED" });
  }

  async function stopPlayback(): Promise<void> {
    playbackSessionRef.current += 1;
    tts?.stop();
    await clearPageHighlight();
    dispatch({ type: "STOPPED" });
  }

  async function seekPlayback(direction: -1 | 1): Promise<void> {
    const article = state.article;
    if (!article || article.sentences.length === 0) {
      dispatch({ type: "FAILED", message: "当前页面没有可朗读的正文", scope: "playback" });
      return;
    }
    const currentIndex = state.activeSentenceIndex >= 0 ? state.activeSentenceIndex : 0;
    const nextIndex = Math.max(0, Math.min(article.sentences.length - 1, currentIndex + direction));
    await startPlayback(nextIndex);
  }

  async function updateSettings(next: Partial<ExtensionSettings>): Promise<void> {
    const updated = await writeSettings({ ...settings, ...next });
    setSettings(updated);
  }

  async function syncToPageAlong(): Promise<void> {
    const context = sourceContextRef.current;
    const sourceUrl = context?.url ?? state.article?.url ?? "";
    const sourceTitle = context?.title ?? state.article?.title ?? "";
    if (!sourceUrl) {
      dispatch({ type: "FAILED", message: "当前页面缺少可同步的 URL", scope: "sync" });
      return;
    }

    try {
      dispatch({ type: "SYNC_STATE", syncState: "checking_auth" });
      await pageAlongClient.me();
      dispatch({ type: "SYNC_STATE", syncState: "submitting" });
      const course = await pageAlongClient.syncUrl(sourceUrl, sourceTitle);
      dispatch({ type: "SYNC_SUCCESS", course });
      dispatch({ type: "SYNC_STATE", syncState: courseStatusToSyncState(course.status) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步到 PageAlong 失败";
      if (isAuthError(message)) {
        dispatch({ type: "FAILED", message: "未登录 PageAlong，即将打开登录页。", scope: "sync" });
        await chrome.tabs.create({ url: pageAlongClient.loginUrl(sourceUrl) });
        return;
      }
      dispatch({ type: "FAILED", message, scope: "sync" });
    }
  }

  async function openCourse(): Promise<void> {
    const course = state.lastSyncedCourse;
    if (!course) {
      return;
    }
    await chrome.tabs.create({ url: pageAlongClient.courseUrl(course.id) });
  }

  async function openStandalonePage(): Promise<void> {
    const context = sourceContextRef.current;
    if (!context) {
      return;
    }
    await chrome.tabs.create({ url: buildPageModeUrl(context) });
  }

  async function openSidePanel(): Promise<void> {
    const context = sourceContextRef.current;
    if (!context) {
      return;
    }
    await chrome.sidePanel.setOptions({
      tabId: context.tabId,
      path: "sidepanel.html",
      enabled: true
    });
    await chrome.sidePanel.open({ tabId: context.tabId });
  }

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const [snapshot, storedSettings, context] = await Promise.all([readPanelState(), readSettings(), resolveSourceContext()]);
        if (cancelled) {
          return;
        }
        setSettings(storedSettings);
        sourceContextRef.current = context;
        setSourceContext(context);
        if (snapshot) {
          dispatch({ type: "HYDRATE", state: snapshot });
        }
        if (isUnsupportedSourceUrl(context.url)) {
          dispatch({
            type: "HYDRATE",
            state: {
              article: null,
              playbackState: "idle",
              activeSentenceIndex: -1,
              syncState: "idle",
              error: "当前页面无法剪藏，请使用收藏按钮让 PageAlong 尝试抓取。",
              lastSyncedCourse: null
            }
          });
          return;
        }
        await clipCurrentPage(context);
      } catch (error) {
        if (!cancelled) {
          dispatch({ type: "FAILED", message: error instanceof Error ? error.message : "无法读取当前标签页", scope: "playback" });
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
      playbackSessionRef.current += 1;
      tts?.stop();
      void clearPageHighlight();
    };
  }, [tts]);

  useEffect(() => {
    if (bootstrapping) {
      return;
    }
    void writePanelState(state);
  }, [bootstrapping, state]);

  const article = state.article;
  const sourceLabel = currentSourceLabel(article, sourceContext);
  const sourceDomain = currentSourceDomain(article, sourceContext);
  const playbackButtonLabel =
    state.playbackState === "playing"
      ? "暂停"
      : state.playbackState === "paused"
        ? "继续"
        : state.playbackState === "failed"
          ? "重试"
          : "播放";
  const syncButtonLabel = "收藏至PageAlong平台";
  const syncCopy = syncStatusCopy(state.syncState, state.lastSyncedCourse);
  const hasSentences = Boolean(article?.sentences.length);

  return (
    <main
      className={
        viewMode === "page"
          ? "pa-extension pa-extension-page"
          : viewMode === "popup"
            ? "pa-extension pa-extension-popup"
            : "pa-extension pa-extension-panel"
      }
    >
      <header className="pa-header">
        <div className="pa-header-top">
          <div className="pa-brand-block">
            <p className="pa-brand">页相随 PageAlong</p>
            <p className="pa-subtitle">把当前网页变成一路相随的课程。</p>
          </div>
          <div className="pa-header-actions">
            {viewMode !== "page" ? (
              <button
                className="pa-icon-button pa-mode-button"
                onClick={() => void openStandalonePage()}
                title="打开独立页"
                type="button"
              >
                <PanelRight size={16} />
                <span>独立页</span>
              </button>
            ) : null}
            {viewMode !== "sidepanel" ? (
              <button
                className="pa-icon-button pa-mode-button"
                onClick={() => void openSidePanel()}
                title="打开侧边栏"
                type="button"
              >
                <PanelLeft size={16} />
                <span>侧边栏</span>
              </button>
            ) : null}
          </div>
        </div>
        <p className="pa-source-line">
          <span className="pa-source-title">{sourceLabel}</span>
          {sourceDomain ? <span className="pa-source-domain">{sourceDomain}</span> : null}
        </p>
      </header>

      {bootstrapping ? <p className="pa-banner">正在读取当前标签页。</p> : null}

      {state.error ? (
        <section className="pa-banner pa-banner-error">
          <p>{state.error}</p>
          <div className="pa-banner-actions">
            {viewMode !== "page" ? (
              <button className="pa-secondary" onClick={() => void openStandalonePage()} type="button">
                打开独立页
              </button>
            ) : null}
            {viewMode !== "sidepanel" ? (
              <button className="pa-secondary" onClick={() => void openSidePanel()} type="button">
                打开侧边栏
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="pa-reader">
        <div className="pa-reader-meta">
          <span>{article?.sentences.length ? `${article.sentences.length} 句` : "尚未解析出正文"}</span>
          <span>
            {state.playbackState === "playing"
              ? "正在朗读"
              : state.playbackState === "paused"
                ? "已暂停"
                : state.playbackState === "failed"
                  ? "播放失败"
                  : "待播放"}
          </span>
        </div>

        <div className="pa-sentences">
          {(article?.sentences || []).map((sentence) => (
            <button
              className={sentence.index === state.activeSentenceIndex ? "pa-sentence pa-sentence-active" : "pa-sentence"}
              key={sentence.index}
              onClick={() => void startPlayback(sentence.index)}
              type="button"
            >
              {sentence.text}
            </button>
          ))}
          {!article?.sentences.length ? <p className="pa-empty">当前页面还没有可朗读的正文。</p> : null}
        </div>
      </section>

      <section className="pa-settings">
        <div className="pa-setting-block">
          <p className="pa-setting-label">高亮颜色</p>
          <div className="pa-swatches">
            {colorOptions.map((color) => (
              <button
                aria-label={`高亮颜色 ${color}`}
                className={`pa-swatch pa-swatch-${color} ${settings.highlightColor === color ? "pa-swatch-active" : ""}`}
                key={color}
                onClick={() => void updateSettings({ highlightColor: color })}
                title={`高亮颜色 ${color}`}
                type="button"
              />
            ))}
          </div>
        </div>

        <label className="pa-toggle">
          <span>自动滚动当前句</span>
          <input
            checked={settings.autoScroll}
            onChange={(event) => void updateSettings({ autoScroll: event.currentTarget.checked })}
            type="checkbox"
          />
        </label>

        <div className="pa-setting-block">
          <p className="pa-setting-label">播放器倍速</p>
          <div className="pa-rate-row">
            {rateOptions.map((rate) => (
              <button
                className={settings.playbackRate === rate ? "pa-rate-chip pa-rate-chip-active" : "pa-rate-chip"}
                key={rate}
                onClick={() => void updateSettings({ playbackRate: rate })}
                type="button"
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>
      </section>

      <footer className="pa-dock">
        <p className="pa-current">{state.activeSentenceIndex >= 0 ? article?.sentences.find((sentence) => sentence.index === state.activeSentenceIndex)?.text || "准备播放" : "准备播放"}</p>
        <button className="pa-primary pa-sync-button" onClick={() => void syncToPageAlong()} type="button">
          <CloudUpload size={16} />
          {syncButtonLabel}
        </button>
        <p className="pa-copy pa-dock-copy">{syncCopy}</p>
        {state.lastSyncedCourse ? (
          <button className="pa-link-button" onClick={() => void openCourse()} type="button">
            <ExternalLink size={16} />
            打开课程
          </button>
        ) : null}
        <div className="pa-controls">
          <button aria-label="停止" className="pa-icon-button" disabled={!tts} onClick={() => void stopPlayback()} title="停止" type="button">
            <CircleStop size={18} />
          </button>
          <button
            aria-label="上一句"
            className="pa-icon-button"
            disabled={!hasSentences}
            onClick={() => void seekPlayback(-1)}
            title="上一句"
            type="button"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            aria-label={playbackButtonLabel}
            className="pa-icon-button pa-play-button"
            disabled={!tts || !hasSentences}
            onClick={() => void togglePlayback()}
            title={playbackButtonLabel}
            type="button"
          >
            {state.playbackState === "playing" ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            aria-label="下一句"
            className="pa-icon-button"
            disabled={!hasSentences}
            onClick={() => void seekPlayback(1)}
            title="下一句"
            type="button"
          >
            <ChevronRight size={18} />
          </button>
          <label className="pa-rate">
            <Settings size={14} />
            <select
              onChange={(event) => void updateSettings({ playbackRate: Number(event.currentTarget.value) })}
              value={settings.playbackRate}
            >
              {rateOptions.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}x
                </option>
              ))}
            </select>
          </label>
          {viewMode === "sidepanel" ? (
            <button className="pa-icon-button" onClick={() => void openStandalonePage()} title="打开独立页" type="button">
              <PanelRight size={18} />
            </button>
          ) : (
            <button className="pa-icon-button" onClick={() => void openSidePanel()} title="打开侧边栏" type="button">
              <PanelLeft size={18} />
            </button>
          )}
        </div>
      </footer>
    </main>
  );
}
