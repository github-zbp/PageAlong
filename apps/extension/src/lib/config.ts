export const PAGEALONG_API_BASE_URL = import.meta.env.VITE_PAGEALONG_API_BASE_URL ?? "https://web-reader.zbpblog.cn/api";
export const PAGEALONG_WEB_BASE_URL = import.meta.env.VITE_PAGEALONG_WEB_BASE_URL ?? "https://web-reader.zbpblog.cn";

export function getExtensionVersion(): string {
  return globalThis.chrome?.runtime?.getManifest?.().version ?? "0.1.0";
}
