"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { deleteAdminCourse, getAdminCourse } from "@/lib/api";
import type { AdminCourseDetail } from "@/lib/types";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function resourceRows(course: AdminCourseDetail) {
  return [
    ["图片", course.resource_counts.image],
    ["音频", course.resource_counts.audio],
    ["PDF", course.resource_counts.pdf],
    ["Word", course.resource_counts.docx],
    ["Markdown", course.resource_counts.markdown]
  ] as const;
}

function DownloadLinks({ course }: { course: AdminCourseDetail }) {
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
          <span className="rounded-md border border-[var(--pa-line)] px-2 py-1 text-sm text-[var(--pa-muted)]" key={label}>
            {label}
          </span>
        ) : null
      )}
    </div>
  );
}

export default function ReaderAdminCourseDetailPage({ params }: { params: { courseId: string } }) {
  const [course, setCourse] = useState<AdminCourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleted, setDeleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCourse() {
      setLoading(true);
      setError("");
      try {
        const detail = await getAdminCourse(params.courseId);
        if (!cancelled) {
          setCourse(detail);
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

    void loadCourse();

    return () => {
      cancelled = true;
    };
  }, [params.courseId]);

  async function deleteCourse() {
    setBusy(true);
    setError("");
    try {
      await deleteAdminCourse(params.courseId);
      setDeleted(true);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除课程失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <section className="space-y-5">
        <div className="flex flex-col gap-3 border-b border-[var(--pa-line)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--pa-ink)]">课程详情</h1>
            <p className="mt-1 text-sm leading-6 text-[var(--pa-muted)]">{course ? course.title : "加载课程内容"}</p>
          </div>
          <Link className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-2 text-sm" href="/reader_admin/courses">
            返回列表
          </Link>
        </div>

        {error ? (
          <div className="rounded-md border border-[var(--pa-error)] bg-[var(--pa-error-soft)] px-4 py-3 text-sm text-[var(--pa-error)]">
            {error}
          </div>
        ) : null}
        {deleted ? (
          <div className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-muted-surface)] px-4 py-3 text-sm text-[var(--pa-muted)]">
            课程已软删除。
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4 text-sm text-[var(--pa-muted)]">
            加载中
          </div>
        ) : course ? (
          <div className="space-y-5">
            <div className="grid gap-4 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-[var(--pa-muted)]">用户邮箱</p>
                <p className="mt-1 text-sm font-medium">{course.user_email}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--pa-muted)]">状态</p>
                <p className="mt-1 text-sm font-medium">{course.status}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--pa-muted)]">来源</p>
                <p className="mt-1 text-sm font-medium">{course.source_type}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--pa-muted)]">创建时间</p>
                <p className="mt-1 text-sm font-medium">{formatDate(course.created_at)}</p>
              </div>
            </div>

            <div className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4">
              <h2 className="text-base font-semibold">资源数量</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-5">
                {resourceRows(course).map(([label, value]) => (
                  <div className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-muted-surface)] px-3 py-2" key={label}>
                    <p className="text-xs text-[var(--pa-muted)]">{label}</p>
                    <p className="mt-1 text-lg font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <DownloadLinks course={course} />
              </div>
            </div>

            <div className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-semibold">正文</h2>
                <button
                  className="pa-focus rounded-md border border-[var(--pa-error)] px-3 py-1.5 text-sm text-[var(--pa-error)] disabled:opacity-50"
                  disabled={busy || deleted}
                  onClick={() => void deleteCourse()}
                  type="button"
                >
                  删除课程
                </button>
              </div>
              <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md bg-[var(--pa-muted-surface)] p-4 text-sm leading-7 text-[var(--pa-ink)]">
                {course.content_markdown || "暂无正文"}
              </pre>
            </div>
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
