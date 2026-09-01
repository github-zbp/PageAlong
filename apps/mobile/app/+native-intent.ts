import type { NativeIntent } from "expo-router";
import { resolveIncomingSharePath } from "@/lib/share";

export function redirectSystemPath({ path }: Parameters<NonNullable<NativeIntent["redirectSystemPath"]>>[0]): string {
  if (!path) {
    return "/share/receive";
  }

  return resolveIncomingSharePath(path);
}
