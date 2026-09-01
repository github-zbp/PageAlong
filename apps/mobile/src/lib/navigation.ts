import type { ComponentProps } from "react";
import { Feather } from "@expo/vector-icons";
import type { LocalePreference } from "@/lib/preferences";

export type TabRouteName = "workbench" | "library" | "downloads" | "me";
export type TabIconName = ComponentProps<typeof Feather>["name"];

export type TabRoute = {
  name: TabRouteName;
  title: string;
  icon: TabIconName;
};

export function getTabRoutes(locale: LocalePreference): TabRoute[] {
  if (locale === "en") {
    return [
      { name: "workbench", title: "Workbench", icon: "home" },
      { name: "library", title: "Library", icon: "book-open" },
      { name: "downloads", title: "Downloads", icon: "download" },
      { name: "me", title: "Me", icon: "user" }
    ];
  }

  return [
    { name: "workbench", title: "工作台", icon: "home" },
    { name: "library", title: "课程库", icon: "book-open" },
    { name: "downloads", title: "下载资源", icon: "download" },
    { name: "me", title: "我的", icon: "user" }
  ];
}

export const TAB_ROUTES = getTabRoutes("zh");

export function getAppNavigatorScreenOptions(backgroundColor: string) {
  return {
    headerShown: false,
    contentStyle: { backgroundColor }
  };
}
