import type { TagRead } from "./types";

export const tagColorPalette = ["#f97316", "#14b8a6", "#8b5cf6", "#ef4444", "#10b981"] as const;
export const fallbackTagColor = "#cbd5e1";

export function normalizeTagName(tag: TagRead | string): string {
  return typeof tag === "string" ? tag : tag.name;
}

export function normalizeTagColor(tag: TagRead | string): string {
  return typeof tag === "string" ? fallbackTagColor : tag.color || fallbackTagColor;
}

export function pickTagColor(index: number = 0): string {
  return tagColorPalette[Math.abs(index) % tagColorPalette.length];
}

