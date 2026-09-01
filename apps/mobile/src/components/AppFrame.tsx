import { useEffect, useState, type PropsWithChildren, type ReactNode } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { recordDashboardActivity } from "@/lib/api";
import { getImportCopy } from "@/lib/i18n";
import { bootstrapLocalePreference, useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";
import { GlobalSearchOverlay } from "@/components/GlobalSearchOverlay";
import { TopAppBar, type TopBarAction } from "@/components/TopAppBar";

type Props = PropsWithChildren<{
  title: string;
  subtitle?: string;
  largeTitle?: boolean;
  rightAction?: ReactNode;
  onRightAction?: () => void;
  rightActionLabel?: string;
  topContent?: ReactNode;
}>;

export function AppFrame({
  title,
  subtitle,
  largeTitle = true,
  rightAction,
  onRightAction,
  rightActionLabel,
  topContent,
  children
}: Props) {
  const router = useRouter();
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const importCopy = getImportCopy(locale);
  const [searchVisible, setSearchVisible] = useState(false);

  useEffect(() => {
    let active = true;
    void bootstrapLocalePreference()
      .then((locale) => {
        if (!active) {
          return;
        }
        return recordDashboardActivity(locale);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const searchLabel = locale === "en" ? "Search courses" : "搜索课程";
  const importLabel = rightActionLabel ?? importCopy.action;
  const topBarRightAction: TopBarAction | ReactNode = rightAction ?? {
    icon: "plus",
    label: importLabel,
    onPress: () => {
      router.push("/import");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      <TopAppBar
        title={title}
        subtitle={subtitle}
        largeTitle={largeTitle}
        leftAction={{
          icon: "search",
          label: searchLabel,
          onPress: () => setSearchVisible(true)
        }}
        rightAction={topBarRightAction}
        onRightAction={rightAction ? onRightAction : undefined}
        rightActionLabel={rightAction ? rightActionLabel : importLabel}
      />
      <GlobalSearchOverlay
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onOpenCourse={(courseId) => {
          setSearchVisible(false);
          router.push({ pathname: "/courses/[courseId]", params: { courseId } });
        }}
        onSubmitSearch={(query) => {
          setSearchVisible(false);
          router.push({ pathname: "/search", params: { query } });
        }}
      />
      {topContent ? <View>{topContent}</View> : null}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
