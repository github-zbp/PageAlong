"use client";

import { useEffect } from "react";

const RELOAD_MARKER_KEY = "pagealong:chunk-reload-at";
const RELOAD_COOLDOWN_MS = 30_000;
const TRIGGER_COOLDOWN_MS = 2_000;

function isChunkLoadFailure(cause: unknown): boolean {
  if (!cause) return false;
  if (typeof cause === "string") {
    return /Loading chunk|ChunkLoadError|dynamically imported module|Importing a module script failed/i.test(cause);
  }
  const error = cause as { name?: unknown; message?: unknown };
  const name = typeof error.name === "string" ? error.name : "";
  const message = typeof error.message === "string" ? error.message : "";
  if (name === "ChunkLoadError") return true;
  return /ChunkLoadError|Loading chunk \d+ failed|Loading CSS chunk|failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|dynamically imported module (couldn't|could not) be loaded/i.test(
    `${name} ${message}`
  );
}

let overlayShown = false;

function showReloadOverlay() {
  if (overlayShown) return;
  overlayShown = true;

  const isEnglish = String(document.documentElement.lang || "").toLowerCase().startsWith("en");
  const title = isEnglish ? "Page update needed" : "页面资源加载失败";
  const description = isEnglish
    ? "A new version of the app was just released. Please refresh to continue."
    : "可能应用刚刚发布了新版本，请刷新页面后继续使用。";
  const buttonLabel = isEnglish ? "Refresh now" : "刷新页面";

  const overlay = document.createElement("div");
  overlay.setAttribute(
    "style",
    "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;"
  );
  const panel = document.createElement("div");
  panel.setAttribute(
    "style",
    "max-width:360px;margin:24px;padding:32px 24px;text-align:center;background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.08);"
  );
  const heading = document.createElement("div");
  heading.textContent = title;
  heading.setAttribute("style", "font-size:18px;font-weight:600;color:#1f2329;");
  const copy = document.createElement("div");
  copy.textContent = description;
  copy.setAttribute("style", "margin-top:10px;font-size:14px;line-height:1.6;color:#646a73;");
  const button = document.createElement("button");
  button.textContent = buttonLabel;
  button.setAttribute("type", "button");
  button.setAttribute(
    "style",
    "margin-top:20px;padding:8px 28px;border:none;border-radius:999px;background:#1668dc;color:#fff;font-size:15px;cursor:pointer;"
  );
  button.addEventListener("click", () => {
    window.location.reload();
  });

  panel.append(heading, copy, button);
  overlay.append(panel);
  document.body.append(overlay);
}

let lastTriggerAt = 0;

function recoverFromChunkLoadFailure() {
  const now = Date.now();
  if (now - lastTriggerAt < TRIGGER_COOLDOWN_MS || overlayShown) return;
  lastTriggerAt = now;

  let lastReloadAt = 0;
  try {
    lastReloadAt = Number(sessionStorage.getItem(RELOAD_MARKER_KEY)) || 0;
  } catch {
    window.location.reload();
    return;
  }

  if (now - lastReloadAt < RELOAD_COOLDOWN_MS) {
    showReloadOverlay();
    return;
  }

  try {
    sessionStorage.setItem(RELOAD_MARKER_KEY, String(now));
  } catch {
    // session storage unavailable: fall back to overlay instead of looping
    showReloadOverlay();
    return;
  }
  window.location.reload();
}

export function ChunkLoadRecovery() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (isChunkLoadFailure(event.message) || isChunkLoadFailure(event.error)) {
        recoverFromChunkLoadFailure();
      }
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadFailure(event.reason)) {
        recoverFromChunkLoadFailure();
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
