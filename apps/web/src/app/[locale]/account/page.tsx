"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { changePassword, getCurrentUser, logoutAllSessions } from "@/lib/api";
import { ConsoleShell } from "@/components/ConsoleShell";
import { dictionaries, normalizeLocale } from "@/lib/i18n";
import type { AuthUser } from "@/lib/types";

function formatDate(value: string | null, locale: string): string {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function AccountPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const dictionary = dictionaries[locale];
  const router = useRouter();
  const searchParams = useSearchParams();
  const forcePasswordChange = searchParams.get("force-password-change") === "1";
  const [user, setUser] = useState<AuthUser | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void getCurrentUser().then(setUser).catch(() => setUser(null));
  }, []);

  async function submitPasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError(locale === "zh" ? "两次密码不一致" : "The two passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setMessage(dictionary.auth.changePassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      router.replace(`/${locale}/account`);
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : "修改密码失败");
    } finally {
      setLoading(false);
    }
  }

  async function signOutAll() {
    try {
      await logoutAllSessions();
    } finally {
      router.replace(`/${locale}/login`);
    }
  }

  return (
    <ConsoleShell locale={locale}>
      <section className="space-y-4 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-5">
        <div>
          <h1 className="text-xl font-semibold text-[var(--pa-ink)]">{dictionary.auth.accountTitle}</h1>
          <p className="mt-1 text-sm text-[var(--pa-muted)]">
            {forcePasswordChange
              ? locale === "zh"
                ? "首次登录后请先修改密码。"
                : "Please change your password before continuing."
              : locale === "zh"
                ? "查看你的账号状态和登录信息。"
                : "Review your account status and sign-in details."}
          </p>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-[var(--pa-muted)]">{dictionary.auth.email}</p>
            <p className="mt-1 font-medium text-[var(--pa-ink)]">{user?.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-[var(--pa-muted)]">{dictionary.auth.role}</p>
            <p className="mt-1 font-medium text-[var(--pa-ink)]">
              {user?.role === "admin"
                ? dictionary.auth.roleAdmin
                : user?.role === "user"
                  ? dictionary.auth.roleUser
                  : "—"}
            </p>
          </div>
          <div>
            <p className="text-[var(--pa-muted)]">{dictionary.auth.status}</p>
            <p className="mt-1 font-medium text-[var(--pa-ink)]">
              {user?.status === "active"
                ? dictionary.auth.statusActive
                : user?.status === "disabled"
                  ? dictionary.auth.statusDisabled
                  : "—"}
            </p>
          </div>
          <div>
            <p className="text-[var(--pa-muted)]">{dictionary.auth.lastLoginAt}</p>
            <p className="mt-1 font-medium text-[var(--pa-ink)]">{formatDate(user?.last_login_at ?? null, locale)}</p>
          </div>
        </div>
        <div className="rounded-md border border-[var(--pa-line)] bg-[rgba(47,111,94,0.04)] p-4">
          <h2 className="text-base font-semibold text-[var(--pa-ink)]">{dictionary.auth.changePassword}</h2>
          <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={submitPasswordChange}>
            <input
              aria-label={dictionary.auth.currentPassword}
              className="h-11 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]"
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder={dictionary.auth.currentPassword}
              type="password"
              value={currentPassword}
            />
            <input
              aria-label={dictionary.auth.newPassword}
              className="h-11 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]"
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder={dictionary.auth.newPassword}
              type="password"
              value={newPassword}
            />
            <input
              aria-label={dictionary.auth.confirmPassword}
              className="h-11 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]"
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={dictionary.auth.confirmPassword}
              type="password"
              value={confirmPassword}
            />
            {error ? <p className="sm:col-span-3 text-sm text-red-600">{error}</p> : null}
            {message ? <p className="sm:col-span-3 text-sm text-[var(--pa-green)]">{message}</p> : null}
            <button
              className="pa-focus h-11 rounded-md bg-[var(--pa-green)] px-4 text-sm text-white disabled:opacity-50"
              disabled={loading}
              type="submit"
            >
              {dictionary.auth.changePassword}
            </button>
          </form>
        </div>
        <button
          className="pa-focus rounded-md border border-[var(--pa-line)] px-4 py-2 text-sm text-[var(--pa-ink)]"
          onClick={() => void signOutAll()}
          type="button"
        >
          {dictionary.auth.signOutAll}
        </button>
      </section>
    </ConsoleShell>
  );
}
