"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/AdminShell";
import {
  bulkAdminBlogs,
  deleteAdminBlog,
  listAdminBlogs,
  offlineAdminBlog,
  publishAdminBlog
} from "@/lib/api";
import type { AdminBlogListItem, Pagination } from "@/lib/types";

const PAGE_SIZE = 20;

type StatusFilter = "" | "draft" | "published" | "offline";
type LanguageFilter = "" | "zh" | "en";

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

function statusText(status: AdminBlogListItem["status"]): string {
  if (status === "published") {
    return "已发布";
  }
  if (status === "offline") {
    return "已下架";
  }
  if (status === "deleted") {
    return "已删除";
  }
  return "草稿";
}

export default function ReaderAdminBlogsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [language, setLanguage] = useState<LanguageFilter>("");
  const [submitted, setSubmitted] = useState({ query: "", status: "" as StatusFilter, language: "" as LanguageFilter });
  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState<AdminBlogListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadPosts() {
      setLoading(true);
      setError("");
      try {
        const response = await listAdminBlogs({
          query: submitted.query,
          status: submitted.status,
          language: submitted.language,
          page,
          pageSize: PAGE_SIZE
        });
        if (!cancelled) {
          setPosts(response.items);
          setPagination(response.pagination);
          setSelectedIds([]);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "加载博客失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPosts();

    return () => {
      cancelled = true;
    };
  }, [page, reloadToken, submitted]);

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSubmitted({ query: query.trim(), status, language });
  }

  function toggleSelected(postId: string) {
    setSelectedIds((ids) => (ids.includes(postId) ? ids.filter((id) => id !== postId) : [...ids, postId]));
  }

  async function runAction(action: () => Promise<unknown>, busyLabel: string) {
    setBusy(busyLabel);
    setError("");
    try {
      await action();
      setReloadToken((value) => value + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "操作失败");
    } finally {
      setBusy("");
    }
  }

  const selectedCount = selectedIds.length;

  return (
    <AdminShell>
      <section className="space-y-5">
        <div className="flex flex-col gap-3 border-b border-[var(--pa-line)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--pa-ink)]">博客管理</h1>
            <p className="mt-1 text-sm leading-6 text-[var(--pa-muted)]">维护公开博客内容，列表不加载正文。</p>
          </div>
          <Link className="pa-focus rounded-md bg-[var(--pa-green)] px-4 py-2 text-sm font-medium text-white" href="/reader_admin/blogs/new">
            新增博客
          </Link>
        </div>

        <form
          className="grid gap-3 rounded-md border border-[var(--pa-line)] bg-[var(--pa-muted-surface)] p-4 lg:grid-cols-[minmax(0,1fr)_150px_150px_auto]"
          onSubmit={submitFilters}
          role="search"
        >
          <input
            aria-label="按标题搜索"
            className="h-11 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none placeholder:text-[var(--pa-muted)] focus:border-[var(--pa-green)]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="按标题搜索"
            type="search"
            value={query}
          />
          <select
            aria-label="状态"
            className="h-11 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]"
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            value={status}
          >
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="offline">已下架</option>
          </select>
          <select
            aria-label="语言"
            className="h-11 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]"
            onChange={(event) => setLanguage(event.target.value as LanguageFilter)}
            value={language}
          >
            <option value="">全部语言</option>
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
          <button className="pa-focus h-11 rounded-md bg-[var(--pa-green)] px-5 text-sm font-medium text-white" type="submit">
            搜索
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          <button
            className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            disabled={selectedCount === 0 || Boolean(busy)}
            onClick={() => void runAction(() => bulkAdminBlogs(selectedIds, "publish"), "bulk-publish")}
            type="button"
          >
            批量发布
          </button>
          <button
            className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            disabled={selectedCount === 0 || Boolean(busy)}
            onClick={() => void runAction(() => bulkAdminBlogs(selectedIds, "offline"), "bulk-offline")}
            type="button"
          >
            批量下架
          </button>
          <button
            className="pa-focus rounded-md border border-[var(--pa-error)] px-3 py-1.5 text-sm text-[var(--pa-error)] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={selectedCount === 0 || Boolean(busy)}
            onClick={() => void runAction(() => bulkAdminBlogs(selectedIds, "delete"), "bulk-delete")}
            type="button"
          >
            批量删除
          </button>
          <span className="py-1.5 text-sm text-[var(--pa-muted)]">已选 {selectedCount} 项</span>
        </div>

        {error ? (
          <div className="rounded-md border border-[var(--pa-error)] bg-[var(--pa-error-soft)] px-4 py-3 text-sm text-[var(--pa-error)]">
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)]">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-[var(--pa-muted-surface)] text-[var(--pa-muted)]">
              <tr>
                <th className="w-10 px-4 py-3 font-medium">选</th>
                <th className="px-4 py-3 font-medium">标题</th>
                <th className="px-4 py-3 font-medium">语言</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">创建时间</th>
                <th className="px-4 py-3 font-medium">更新时间</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-[var(--pa-muted)]" colSpan={7}>
                    加载中
                  </td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-[var(--pa-muted)]" colSpan={7}>
                    暂无博客
                  </td>
                </tr>
              ) : (
                posts.map((post) => (
                  <tr key={post.id} className="border-t border-[var(--pa-line)] align-top">
                    <td className="px-4 py-4">
                      <input
                        aria-label={`选择 ${post.title}`}
                        checked={selectedIds.includes(post.id)}
                        onChange={() => toggleSelected(post.id)}
                        type="checkbox"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-[var(--pa-ink)]">{post.title}</p>
                      <p className="mt-1 text-xs text-[var(--pa-muted)]">/{post.slug}</p>
                    </td>
                    <td className="px-4 py-4 text-[var(--pa-muted)]">{post.language === "zh" ? "中文" : "English"}</td>
                    <td className="px-4 py-4 text-[var(--pa-muted)]">{statusText(post.status)}</td>
                    <td className="px-4 py-4 text-[var(--pa-muted)]">{formatDate(post.created_at)}</td>
                    <td className="px-4 py-4 text-[var(--pa-muted)]">{formatDate(post.updated_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-1.5 text-xs" href={`/reader_admin/blogs/${post.id}`}>
                          编辑
                        </Link>
                        <button
                          className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-1.5 text-xs disabled:opacity-50"
                          disabled={Boolean(busy)}
                          onClick={() => void runAction(() => publishAdminBlog(post.id), `publish-${post.id}`)}
                          type="button"
                        >
                          发布
                        </button>
                        <button
                          className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-1.5 text-xs disabled:opacity-50"
                          disabled={Boolean(busy)}
                          onClick={() => void runAction(() => offlineAdminBlog(post.id), `offline-${post.id}`)}
                          type="button"
                        >
                          下架
                        </button>
                        <button
                          className="pa-focus rounded-md border border-[var(--pa-error)] px-3 py-1.5 text-xs text-[var(--pa-error)] disabled:opacity-50"
                          disabled={Boolean(busy)}
                          onClick={() => void runAction(() => deleteAdminBlog(post.id), `delete-${post.id}`)}
                          type="button"
                        >
                          删除
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
