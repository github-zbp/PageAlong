"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/AdminShell";
import {
  deleteAdminAnnouncement,
  listAdminAnnouncements,
  offlineAdminAnnouncement,
  publishAdminAnnouncement,
  reorderAdminAnnouncements
} from "@/lib/api";
import type { AdminAnnouncementListItem, Pagination } from "@/lib/types";

const PAGE_SIZE = 20;

type StatusFilter = "" | "draft" | "published" | "offline";
type LanguageFilter = "" | "zh" | "en";

function statusText(status: AdminAnnouncementListItem["status"]): string {
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

export default function ReaderAdminAnnouncementsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [language, setLanguage] = useState<LanguageFilter>("");
  const [submitted, setSubmitted] = useState({ query: "", status: "" as StatusFilter, language: "" as LanguageFilter });
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminAnnouncementListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [sortOrders, setSortOrders] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      setLoading(true);
      setError("");
      try {
        const response = await listAdminAnnouncements({
          query: submitted.query,
          status: submitted.status,
          language: submitted.language,
          page,
          pageSize: PAGE_SIZE
        });
        if (!cancelled) {
          setItems(response.items);
          setPagination(response.pagination);
          setSortOrders(Object.fromEntries(response.items.map((item) => [item.id, item.sort_order])));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "加载公告失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadItems();

    return () => {
      cancelled = true;
    };
  }, [page, reloadToken, submitted]);

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSubmitted({ query: query.trim(), status, language });
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

  async function saveOrder() {
    await runAction(
      () =>
        reorderAdminAnnouncements(
          items.map((item) => ({
            id: item.id,
            sort_order: sortOrders[item.id] ?? item.sort_order
          }))
        ),
      "reorder"
    );
  }

  return (
    <AdminShell>
      <section className="space-y-5">
        <div className="flex flex-col gap-3 border-b border-[var(--pa-line)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--pa-ink)]">公告板</h1>
            <p className="mt-1 text-sm leading-6 text-[var(--pa-muted)]">管理 dashboard 公告和产品路线状态。</p>
          </div>
          <Link className="pa-focus rounded-md bg-[var(--pa-green)] px-4 py-2 text-sm font-medium text-white" href="/reader_admin/announcements/new">
            新增公告
          </Link>
        </div>

        <form
          className="grid gap-3 rounded-md border border-[var(--pa-line)] bg-[var(--pa-muted-surface)] p-4 lg:grid-cols-[minmax(0,1fr)_150px_150px_auto]"
          onSubmit={submitFilters}
          role="search"
        >
          <input
            aria-label="搜索公告"
            className="h-11 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none placeholder:text-[var(--pa-muted)] focus:border-[var(--pa-green)]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索公告"
            type="search"
            value={query}
          />
          <select className="h-11 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]" onChange={(event) => setStatus(event.target.value as StatusFilter)} value={status}>
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="offline">已下架</option>
          </select>
          <select className="h-11 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]" onChange={(event) => setLanguage(event.target.value as LanguageFilter)} value={language}>
            <option value="">全部语言</option>
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
          <button className="pa-focus h-11 rounded-md bg-[var(--pa-green)] px-5 text-sm font-medium text-white" type="submit">
            搜索
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          <button className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-1.5 text-sm disabled:opacity-40" disabled={items.length === 0 || Boolean(busy)} onClick={() => void saveOrder()} type="button">
            保存排序
          </button>
        </div>

        {error ? (
          <div className="rounded-md border border-[var(--pa-error)] bg-[var(--pa-error-soft)] px-4 py-3 text-sm text-[var(--pa-error)]">
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)]">
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead className="bg-[var(--pa-muted-surface)] text-[var(--pa-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">标题</th>
                <th className="px-4 py-3 font-medium">语言</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">路线</th>
                <th className="px-4 py-3 font-medium">位置</th>
                <th className="px-4 py-3 font-medium">排序</th>
                <th className="px-4 py-3 font-medium">置顶</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-[var(--pa-muted)]" colSpan={8}>
                    加载中
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-[var(--pa-muted)]" colSpan={8}>
                    暂无公告
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-[var(--pa-line)] align-top">
                    <td className="px-4 py-4 font-medium text-[var(--pa-ink)]">{item.title}</td>
                    <td className="px-4 py-4 text-[var(--pa-muted)]">{item.language === "zh" ? "中文" : "English"}</td>
                    <td className="px-4 py-4 text-[var(--pa-muted)]">{statusText(item.status)}</td>
                    <td className="px-4 py-4 text-[var(--pa-muted)]">{item.roadmap_status}</td>
                    <td className="px-4 py-4 text-[var(--pa-muted)]">{item.display_position}</td>
                    <td className="px-4 py-4">
                      <input
                        aria-label={`${item.title} 排序`}
                        className="h-9 w-20 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-2 outline-none focus:border-[var(--pa-green)]"
                        onChange={(event) => setSortOrders((orders) => ({ ...orders, [item.id]: Number(event.target.value) }))}
                        type="number"
                        value={sortOrders[item.id] ?? item.sort_order}
                      />
                    </td>
                    <td className="px-4 py-4 text-[var(--pa-muted)]">{item.is_pinned ? "是" : "否"}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-1.5 text-xs" href={`/reader_admin/announcements/${item.id}`}>
                          编辑
                        </Link>
                        <button className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-1.5 text-xs disabled:opacity-50" disabled={Boolean(busy)} onClick={() => void runAction(() => publishAdminAnnouncement(item.id), `publish-${item.id}`)} type="button">
                          发布
                        </button>
                        <button className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-1.5 text-xs disabled:opacity-50" disabled={Boolean(busy)} onClick={() => void runAction(() => offlineAdminAnnouncement(item.id), `offline-${item.id}`)} type="button">
                          下架
                        </button>
                        <button className="pa-focus rounded-md border border-[var(--pa-error)] px-3 py-1.5 text-xs text-[var(--pa-error)] disabled:opacity-50" disabled={Boolean(busy)} onClick={() => void runAction(() => deleteAdminAnnouncement(item.id), `delete-${item.id}`)} type="button">
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
              <button className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-1.5 text-[var(--pa-ink)] disabled:cursor-not-allowed disabled:opacity-40" disabled={!pagination.has_previous || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">
                上一页
              </button>
              <button className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-1.5 text-[var(--pa-ink)] disabled:cursor-not-allowed disabled:opacity-40" disabled={!pagination.has_next || loading} onClick={() => setPage((value) => value + 1)} type="button">
                下一页
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
