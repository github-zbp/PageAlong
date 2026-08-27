"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { dictionaries, normalizeLocale } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n";
import type { AuthUser } from "@/lib/types";
import {
  forceLogoutAdminUser,
  listAdminUsers,
  sendAdminPasswordReset,
  updateAdminUserRole,
  updateAdminUserStatus
} from "@/lib/api";

type RoleFilter = "" | "user" | "admin";
type StatusFilter = "" | "active" | "disabled";

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

function roleText(user: AuthUser, localeText: Dictionary): string {
  return user.role === "admin" ? localeText.auth.roleAdmin : localeText.auth.roleUser;
}

function statusText(user: AuthUser, localeText: Dictionary): string {
  return user.status === "active" ? localeText.auth.statusActive : localeText.auth.statusDisabled;
}

function chipClass(kind: "role" | "status", value: string): string {
  if (kind === "role") {
    return value === "admin"
      ? "border-[var(--pa-amber)] bg-[var(--pa-amber-soft)] text-[var(--pa-amber)]"
      : "border-[var(--pa-line)] bg-[var(--pa-muted-surface)] text-[var(--pa-muted)]";
  }
  return value === "active"
    ? "border-[var(--pa-green)] bg-[var(--pa-green-soft)] text-[var(--pa-green)]"
    : "border-[var(--pa-error)] bg-[var(--pa-error-soft)] text-[var(--pa-error)]";
}

export default function AdminUsersPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const dictionary = dictionaries[locale];
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [submitted, setSubmitted] = useState({ query: "", role: "" as RoleFilter, status: "" as StatusFilter });
  const [reloadToken, setReloadToken] = useState(0);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setLoading(true);
      setError("");
      try {
        const items = await listAdminUsers(submitted);
        if (!cancelled) {
          setUsers(items);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : locale === "zh" ? "加载用户失败" : "Failed to load users"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [submitted, reloadToken]);

  async function runAction(userId: string, action: () => Promise<unknown>) {
    setBusyUserId(userId);
    setError("");
    try {
      await action();
      setReloadToken((value) => value + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : locale === "zh" ? "操作失败" : "Action failed");
    } finally {
      setBusyUserId("");
    }
  }

  async function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted({
      query: query.trim(),
      role,
      status
    });
  }

  function clearFilters() {
    setQuery("");
    setRole("");
    setStatus("");
    setSubmitted({ query: "", role: "", status: "" });
  }

  return (
    <ConsoleShell locale={locale}>
      <section className="space-y-5 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--pa-ink)]">{dictionary.auth.adminUsersTitle}</h1>
            <p className="mt-1 text-sm text-[var(--pa-muted)]">
              {locale === "zh"
                ? "管理注册用户、状态和登录会话。"
                : "Manage registered users, account status, and sign-in sessions."}
            </p>
          </div>
          <p className="text-sm text-[var(--pa-muted)]">
            {loading ? dictionary.auth.loading : `${users.length} ${locale === "zh" ? "位用户" : "users"}`}
          </p>
        </div>

        <form className="grid gap-3 rounded-md border border-[var(--pa-line)] bg-[var(--pa-muted-surface)] p-4 lg:grid-cols-[minmax(0,1.4fr)_160px_160px_auto_auto]" onSubmit={submitFilters}>
          <label className="block space-y-2 text-sm">
            <span className="text-[var(--pa-muted)]">{dictionary.auth.searchUsers}</span>
            <input
              aria-label={dictionary.auth.searchUsers}
              className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={dictionary.auth.searchUsers}
              value={query}
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span className="text-[var(--pa-muted)]">{dictionary.auth.role}</span>
            <select
              aria-label={dictionary.auth.role}
              className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]"
              onChange={(event) => setRole(event.target.value as RoleFilter)}
              value={role}
            >
              <option value="">{dictionary.auth.all}</option>
              <option value="user">{dictionary.auth.roleUser}</option>
              <option value="admin">{dictionary.auth.roleAdmin}</option>
            </select>
          </label>
          <label className="block space-y-2 text-sm">
            <span className="text-[var(--pa-muted)]">{dictionary.auth.status}</span>
            <select
              aria-label={dictionary.auth.status}
              className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]"
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              value={status}
            >
              <option value="">{dictionary.auth.all}</option>
              <option value="active">{dictionary.auth.statusActive}</option>
              <option value="disabled">{dictionary.auth.statusDisabled}</option>
            </select>
          </label>
          <button
            className="pa-focus mt-7 h-11 rounded-md bg-[var(--pa-green)] px-4 text-sm font-medium text-white"
            type="submit"
          >
            {dictionary.auth.searchUsers}
          </button>
          <button
            className="pa-focus mt-7 h-11 rounded-md border border-[var(--pa-line)] px-4 text-sm text-[var(--pa-ink)]"
            onClick={clearFilters}
            type="button"
          >
            {dictionary.auth.resetFilters}
          </button>
        </form>

        {error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error === "Admin access required" ? dictionary.auth.adminAccessRequired : error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-md border border-[var(--pa-line)]">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--pa-muted-surface)] text-[var(--pa-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">{dictionary.auth.email}</th>
                <th className="px-4 py-3 font-medium">{dictionary.auth.role}</th>
                <th className="px-4 py-3 font-medium">{dictionary.auth.status}</th>
                <th className="px-4 py-3 font-medium">{dictionary.auth.lastLoginAt}</th>
                <th className="px-4 py-3 font-medium">{dictionary.auth.createdAt}</th>
                <th className="px-4 py-3 font-medium">{dictionary.auth.actions}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-[var(--pa-muted)]" colSpan={6}>
                    {dictionary.auth.loading}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-[var(--pa-muted)]" colSpan={6}>
                    {locale === "zh" ? "没有找到匹配的用户。" : "No users match these filters."}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-t border-[var(--pa-line)] align-top">
                    <td className="px-4 py-4">
                      <p className="font-medium text-[var(--pa-ink)]">{user.email}</p>
                      <p className="mt-1 text-xs text-[var(--pa-muted)]">{user.id}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${chipClass("role", user.role)}`}>
                        {roleText(user, dictionary)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${chipClass("status", user.status)}`}>
                        {statusText(user, dictionary)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[var(--pa-muted)]">{formatDate(user.last_login_at, locale)}</td>
                    <td className="px-4 py-4 text-[var(--pa-muted)]">{formatDate(user.created_at, locale)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-md border border-[var(--pa-line)] px-3 py-1.5 text-xs text-[var(--pa-ink)] disabled:opacity-50"
                          disabled={busyUserId === user.id}
                          onClick={() =>
                            void runAction(user.id, () =>
                              updateAdminUserStatus(user.id, user.status === "active" ? "disable" : "enable")
                            )
                          }
                          type="button"
                        >
                          {user.status === "active" ? dictionary.auth.disable : dictionary.auth.enable}
                        </button>
                        <button
                          className="rounded-md border border-[var(--pa-line)] px-3 py-1.5 text-xs text-[var(--pa-ink)] disabled:opacity-50"
                          disabled={busyUserId === user.id}
                          onClick={() =>
                            void runAction(user.id, () =>
                              updateAdminUserRole(user.id, user.role === "admin" ? "demote" : "promote")
                            )
                          }
                          type="button"
                        >
                          {user.role === "admin" ? dictionary.auth.demote : dictionary.auth.promote}
                        </button>
                        <button
                          className="rounded-md border border-[var(--pa-line)] px-3 py-1.5 text-xs text-[var(--pa-ink)] disabled:opacity-50"
                          disabled={busyUserId === user.id}
                          onClick={() => void runAction(user.id, () => sendAdminPasswordReset(user.id))}
                          type="button"
                        >
                          {dictionary.auth.sendReset}
                        </button>
                        <button
                          className="rounded-md border border-[var(--pa-line)] px-3 py-1.5 text-xs text-[var(--pa-ink)] disabled:opacity-50"
                          disabled={busyUserId === user.id}
                          onClick={() => void runAction(user.id, () => forceLogoutAdminUser(user.id))}
                          type="button"
                        >
                          {dictionary.auth.forceLogout}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </ConsoleShell>
  );
}
