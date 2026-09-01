import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeWebUrl } from "@/lib/url";

const PENDING_SHARE_KEY = "pagealong.pending.share";

export type PendingShare = {
  url: string;
  title?: string;
};

type IncomingShareCandidate = {
  value?: string | null;
  text?: string | null;
  contentUri?: string | null;
  title?: string | null;
};

function stripWrappingPunctuation(value: string): string {
  return value.replace(/^[\s<(\["'`]+/, "").replace(/[\s>)}\]"'`,.!?;:]+$/g, "");
}

function extractNormalizedUrlFromText(text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  if (!trimmed) {
    return null;
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  const candidates = lines.length > 0 ? lines : [trimmed];

  for (const candidate of candidates) {
    const cleaned = stripWrappingPunctuation(candidate);
    const normalized = normalizeWebUrl(cleaned);
    if (normalized) {
      return normalized;
    }

    for (const token of cleaned.split(/\s+/)) {
      const tokenNormalized = normalizeWebUrl(stripWrappingPunctuation(token));
      if (tokenNormalized) {
        return tokenNormalized;
      }
    }
  }

  return null;
}

function normalizePendingShare(share: PendingShare | null | undefined): PendingShare | null {
  if (!share) {
    return null;
  }

  const url = normalizeWebUrl(share.url);
  if (!url) {
    return null;
  }

  const title = share.title?.trim();
  return title ? { url, title } : { url };
}

export function extractSharedUrl(payloads: IncomingShareCandidate[] | null | undefined): PendingShare | null {
  for (const payload of payloads ?? []) {
    const candidateValues = [payload.contentUri, payload.value, payload.text];
    for (const candidate of candidateValues) {
      const normalized = extractNormalizedUrlFromText(candidate);
      if (normalized) {
        const title = payload.title?.trim();
        return title ? { url: normalized, title } : { url: normalized };
      }
    }
  }

  return null;
}

export async function savePendingShare(share: PendingShare): Promise<void> {
  const normalized = normalizePendingShare(share);
  if (!normalized) {
    throw new Error("Invalid shared URL");
  }
  await AsyncStorage.setItem(PENDING_SHARE_KEY, JSON.stringify(normalized));
}

export async function loadPendingShare(): Promise<PendingShare | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_SHARE_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    const candidate = parsed as { url?: unknown; title?: unknown };
    const url = typeof candidate.url === "string" ? candidate.url : "";
    const title = typeof candidate.title === "string" ? candidate.title : undefined;
    return normalizePendingShare({ url, title });
  } catch {
    return null;
  }
}

export async function clearPendingShare(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_SHARE_KEY);
}

export async function getPostLoginRedirect(): Promise<"/share/receive" | "/(tabs)/workbench"> {
  const pendingShare = await loadPendingShare();
  return pendingShare ? "/share/receive" : "/(tabs)/workbench";
}

export function resolveIncomingSharePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return "/share/receive";
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed, "pagealong://pagealong");
    if (parsed.hostname === "expo-sharing") {
      return "/share/receive";
    }
    const route = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return route || "/share/receive";
  } catch {
    return "/share/receive";
  }
}
