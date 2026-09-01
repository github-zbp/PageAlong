import type { AuthUser } from "@/lib/api";
import type { LocalePreference } from "@/lib/preferences";
import { useTheme } from "@/providers/ThemeProvider";
import { Text, View } from "react-native";

type Props = {
  user: AuthUser;
  locale?: LocalePreference;
};

function getInitials(email: string): string {
  const localPart = email.split("@")[0]?.trim() ?? "";
  const letters = localPart.replace(/[^a-zA-Z0-9]/g, "");
  if (!letters) {
    return "PA";
  }
  return letters.slice(0, 2).toUpperCase();
}

function formatLastLogin(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function AccountSummaryCard({ user, locale = "zh" }: Props) {
  const { tokens } = useTheme();
  const statusLabel =
    locale === "en" ? (user.status === "active" ? "Active" : "Disabled") : user.status === "active" ? "正常" : "已停用";
  const roleLabel = locale === "en" ? (user.role === "admin" ? "Admin" : "User") : user.role === "admin" ? "管理员" : "普通用户";
  const lastLoginLabel = locale === "en" ? "Last login" : "上次登录";

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: tokens.border,
        borderRadius: 8,
        padding: 16,
        backgroundColor: tokens.surface,
        gap: 12
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: tokens.accent
          }}
        >
          <Text style={{ color: tokens.surface, fontSize: 16, fontWeight: "700" }}>{getInitials(user.email)}</Text>
        </View>

        <View style={{ flex: 1, gap: 6 }}>
          <Text numberOfLines={1} style={{ color: tokens.text, fontSize: 16, fontWeight: "600" }}>
            {user.email}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Text style={{ color: tokens.mutedText, fontSize: 12 }}>{statusLabel}</Text>
            <Text style={{ color: tokens.mutedText, fontSize: 12 }}>{roleLabel}</Text>
          </View>
        </View>
      </View>

      {user.last_login_at ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ color: tokens.mutedText, fontSize: 13 }}>{lastLoginLabel}</Text>
          <Text style={{ color: tokens.text, fontSize: 13, flexShrink: 1, textAlign: "right" }}>
            {locale === "en"
              ? new Intl.DateTimeFormat("en-US", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit"
                }).format(new Date(user.last_login_at))
              : formatLastLogin(user.last_login_at)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default AccountSummaryCard;
