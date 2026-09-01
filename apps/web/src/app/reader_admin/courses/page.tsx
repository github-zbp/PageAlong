"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/AdminShell";
import { bulkDeleteAdminCourses, deleteAdminCourse, listAdminCourses } from "@/lib/api";
import type { AdminCourseListItem, Pagination } from "@/lib/types";

const PAGE_SIZE = 20;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function resourceSummary(course: AdminCourseListItem): string {
  const counts = course.resource_counts;
  return `图片 ${counts.image} · 音频 ${counts.audio} · PDF ${counts.pdf} · Word ${counts.docx} · Markdown ${counts.markdown}`;
}

function DownloadLinks({ course }: { course: AdminCourseListItem }) {
  const links = [
    ["音频", course.audio_download_url],
    ["PDF", course.pdf_download_url],
    ["Word", course.docx_download_url],
    ["Markdown", course.markdown_download_url]
  ] as const;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map(([label, href]) =>
        href ? (
          <span className="rounded-md border border-[var(--pa-line)] px-2 py-1 text-xs text-[var(--pa-muted)]" key={label}>
            {label}
          </span>
        ) : null
      )}
    </div>
  );
}

export default function ReaderAdminCoursesPage() {
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState({ query: "", email: "" });
  const [page, setPage] = useState(1);
  const [courses, setCourses] = useState<AdminCourseListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadCourses() {
      setLoading(true);
      setError("");
      try {
        const response = await listAdminCourses({
          query: submitted.query,
          email: submitted.email,
          page,
          pageSize: PAGE_SIZE
        });
        if (!cancelled) {
          setCourses(response.items);
          setPagination(response.pagination);
          setSelectedIds([]);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "加载课程失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCourses();

    return () => {
      cancelled = true;
    };
  }, [page, reloadToken, submitted]);

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSubmitted({ query: query.trim(), email: email.trim() });
  }

  function toggleSelected(courseId: string) {
    setSelectedIds((ids) => (ids.includes(courseId) ? ids.filter((id) => id !== courseId) : [...ids, courseId]));
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

  return (
    <AdminShell>
      <section className="space-y-5">
        <div className="border-b border-[var(--pa-line)] pb-4">
          <h1 className="text-xl font-semibold text-[var(--pa-ink)]">课程管理</h1>
          <p className="mt-1 text-sm leading-6 text-[var(--pa-muted)]">跨用户查看课程和资源数量，列表不加载正文。</p>
        </div>

        <form
          className="grid gap-3 rounded-md border border-[var(--pa-line)] bg-[var(--pa-muted-surface)] p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
          onSubmit={submitFilters}
          role="search"
        >
          <input
            aria-label="按课程标题搜索"
            className="h-11 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none placeholder:text-[var(--pa-muted)] focus:border-[var(--pa-green)]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="按课程标题搜索"
            type="search"
            value={query}
          />
          <input
            aria-label="按用户邮箱搜索"
            className="h-11 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none placeholder:text-[var(--pa-muted)] focus:border-[var(--pa-green)]"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="按用户邮箱搜索"
            type="search"
            value={email}
          />
          <button className="pa-focus h-11 rounded-md bg-[var(--pa-green)] px-5 text-sm font-medium text-white" type="submit">
            搜索
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="pa-focus rounded-md border border-[var(--pa-error)] px-3 py-1.5 text-sm text-[var(--pa-error)] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={selectedIds.length === 0 || Boolean(busy)}
            onClick={() => void runAction(() => bulkDeleteAdminCourses(selectedIds), "bulk-delete")}
            type="button"
          >
            批量删除
          </button>
          <span className="text-sm text-[var(--pa-muted)]">已选 {selectedIds.length} 项</span>
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
                <th className="w-10 px-4 py-3 font-medium">选</th>
                <th className="px-4 py-3 font-medium">课程</th>
                <th className="px-4 py-3 font-medium">用户邮箱</th>
                <th className="px-4 py-3 font-medium">创建时间</th>
                <th className="px-4 py-3 font-medium">资源数量</th>
                <th className="px-4 py-3 font-medium">下载</th>
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
              ) : courses.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-[var(--pa-muted)]" colSpan={7}>
                    暂无课程
                  </td>
                </tr>
              ) : (
                courses.map((course) => (
                  <tr key={course.id} className="border-t border-[var(--pa-line)] align-top">
                    <td className="px-4 py-4">
                      <input
                        aria-label={`选择 ${course.title}`}
                        checked={selectedIds.includes(course.id)}
                        onChange={() => toggleSelected(course.id)}
                        type="checkbox"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-[var(--pa-ink)]">{course.title}</p>
                      <p className="mt-1 text-xs text-[var(--pa-muted)]">{course.status}</p>
                    </td>
                    <td className="px-4 py-4 text-[var(--pa-muted)]">{course.user_email}</td>
                    <td className="px-4 py-4 text-[var(--pa-muted)]">{formatDate(course.created_at)}</td>
                    <td className="px-4 py-4 text-[var(--pa-muted)]">{resourceSummary(course)}</td>
                    <td className="px-4 py-4">
                      <DownloadLinks course={course} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-1.5 text-xs" href={`/reader_admin/courses/${course.id}`}>
                          查看
                        </Link>
                        <button
                          className="pa-focus rounded-md border border-[var(--pa-error)] px-3 py-1.5 text-xs text-[var(--pa-error)] disabled:opacity-50"
                          disabled={Boolean(busy)}
                          onClick={() => void runAction(() => deleteAdminCourse(course.id), `delete-${course.id}`)}
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
