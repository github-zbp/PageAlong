"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { createAdminImpersonation, listReaderAdminUsers, storeAuthToken, updateAdminUserRole } from "@/lib/api";
import type { AdminUser, Pagination } from "@/lib/types";

const PAGE_SIZE = 20;

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function languageText(value: AdminUser["last_dashboard_locale"]): string {
  if (value === "zh") {
    return "中文";
  }
  if (value === "en") {
    return "English";
  }
  return "—";
}

function roleText(value: AdminUser["role"]): string {
  return value === "admin" ? "管理员" : "用户";
}

export default function ReaderAdminUsersPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState("");
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setLoading(true);
      setError("");
      try {
        const response = await listReaderAdminUsers({ query: submittedQuery, page, pageSize: PAGE_SIZE });
        if (!cancelled) {
          setUsers(response.items);
          setPagination(response.pagination);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "加载用户失败");
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
  }, [page, reloadToken, submittedQuery]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSubmittedQuery(query.trim());
  }

  async function promoteUser(user: AdminUser) {
    setBusyUserId(user.id);
    setError("");
    try {
      await updateAdminUserRole(user.id, "promote");
      setReloadToken((value) => value + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "设置管理员失败");
    } finally {
      setBusyUserId("");
    }
  }

  async function enterUserPage(user: AdminUser) {
    setBusyUserId(user.id);
    setError("");
    try {
      const result = await createAdminImpersonation(user.id);
      const adminToken = window.localStorage.getItem("pagealong_auth_token");
      if (adminToken) {
        window.localStorage.setItem("pagealong_admin_auth_token", adminToken);
      }
      window.localStorage.setItem("pagealong_impersonation_return", window.location.pathname + window.location.search);
      storeAuthToken(result.token);
      router.push(`/${result.target_user.last_dashboard_locale || "zh"}/dashboard`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "进入用户页面失败");
      setBusyUserId("");
    }
  }

  return (
    <AdminShell>
      <section className="space-y-5">
        <div className="flex flex-col gap-2 border-b border-[var(--pa-line)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--pa-ink)]">用户管理</h1>
            <p className="mt-1 text-sm leading-6 text-[var(--pa-muted)]">
              查看注册用户、dashboard 活跃记录和后台身份。
            </p>
          </div>
          <p className="text-sm text-[var(--pa-muted)]">
            {loading ? "加载中" : `${pagination?.total ?? users.length} 位用户`}
          </p>
        </div>

        <form
          className="grid gap-3 rounded-md border border-[var(--pa-line)] bg-[var(--pa-muted-surface)] p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={submitSearch}
          role="search"
        >
          <label className="block space-y-2 text-sm">
            <span className="text-[var(--pa-muted)]">邮箱</span>
            <input
              aria-label="搜索邮箱"
              className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none transition placeholder:text-[var(--pa-muted)] focus:border-[var(--pa-green)]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索邮箱"
              type="search"
              value={query}
            />
          </label>
          <button
            className="pa-focus h-11 rounded-md bg-[var(--pa-green)] px-5 text-sm font-medium text-white sm:mt-7"
            type="submit"
          >
            搜索
          </button>
        </form>

        {error ? (
          <div className="rounded-md border border-[var(--pa-error)] bg-[var(--pa-error-soft)] px-4 py-3 text-sm text-[var(--pa-error)]">
            {error === "Admin access required" ? "需要管理员权限" : error}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)]">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-[var(--pa-muted-surface)] text-[var(--pa-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">邮箱</th>
                <th className="px-4 py-3 font-medium">角色</th>
                <th className="px-4 py-3 font-medium">最近活跃</th>
                <th className="px-4 py-3 font-medium">使用语言</th>
                <th className="px-4 py-3 font-medium">注册时间</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-[var(--pa-muted)]" colSpan={6}>
                    加载中
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-[var(--pa-muted)]" colSpan={6}>
                    暂无用户
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
                      <span className="inline-flex rounded-full border border-[var(--pa-line)] bg-[var(--pa-muted-surface)] px-2 py-1 text-xs text-[var(--pa-muted)]">
                        {roleText(user.role)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[var(--pa-muted)]">{formatDate(user.last_dashboard_at)}</td>
                    <td className="px-4 py-4 text-[var(--pa-muted)]">{languageText(user.last_dashboard_locale)}</td>
                    <td className="px-4 py-4 text-[var(--pa-muted)]">{formatDate(user.created_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-1.5 text-xs text-[var(--pa-ink)] disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={busyUserId === user.id || user.role === "admin"}
                          onClick={() => void promoteUser(user)}
                          type="button"
                        >
                          {user.role === "admin" ? "已是管理员" : "设置为管理员"}
                        </button>
                        <button
                          className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-1.5 text-xs text-[var(--pa-ink)] disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={busyUserId === user.id}
                          onClick={() => void enterUserPage(user)}
                          type="button"
                        >
                          进入用户页面
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination ? (
          <div className="flex flex-col gap-3 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm text-[var(--pa-muted)] sm:flex-row sm:items-center sm:justify-between">
            <p>
              第 {pagination.page} / {pagination.total_pages} 页，共 {pagination.total} 条
            </p>
            <div className="flex gap-2">
              <button
                className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-1.5 text-[var(--pa-ink)] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!pagination.has_previous || loading}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                type="button"
              >
                上一页
              </button>
              <button
                className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-1.5 text-[var(--pa-ink)] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!pagination.has_next || loading}
                onClick={() => setPage((value) => value + 1)}
                type="button"
              >
                下一页
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
