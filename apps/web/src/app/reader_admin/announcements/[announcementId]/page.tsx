"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/AdminShell";
import { AdminMarkdownEditor } from "@/components/AdminMarkdownEditor";
import { getAdminAnnouncement, updateAdminAnnouncement } from "@/lib/api";
import type { AdminAnnouncementDetail } from "@/lib/types";

type Language = "zh" | "en";
type RoadmapStatus = "planned" | "in_progress" | "shipped";
type DisplayPosition = "dashboard" | "announcement_page" | "global_banner";

export default function EditAnnouncementPage({ params }: { params: { announcementId: string } }) {
  const [announcement, setAnnouncement] = useState<AdminAnnouncementDetail | null>(null);
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<Language>("zh");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [roadmapStatus, setRoadmapStatus] = useState<RoadmapStatus>("planned");
  const [displayPosition, setDisplayPosition] = useState<DisplayPosition>("dashboard");
  const [sortOrder, setSortOrder] = useState(0);
  const [isPinned, setPinned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAnnouncement() {
      setLoading(true);
      setError("");
      try {
        const detail = await getAdminAnnouncement(params.announcementId);
        if (cancelled) {
          return;
        }
        setAnnouncement(detail);
        setTitle(detail.title);
        setLanguage(detail.language);
        setBodyMarkdown(detail.body_markdown);
        setBodyHtml(detail.body_html);
        setRoadmapStatus(detail.roadmap_status);
        setDisplayPosition(detail.display_position);
        setSortOrder(detail.sort_order);
        setPinned(detail.is_pinned);
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

    void loadAnnouncement();

    return () => {
      cancelled = true;
    };
  }, [params.announcementId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = await updateAdminAnnouncement(params.announcementId, {
        title,
        language,
        body_markdown: bodyMarkdown,
        roadmap_status: roadmapStatus,
        display_position: displayPosition,
        sort_order: sortOrder,
        is_pinned: isPinned
      });
      setAnnouncement(saved);
      setBodyHtml(saved.body_html);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存公告失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <section className="space-y-5">
        <div className="flex flex-col gap-3 border-b border-[var(--pa-line)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--pa-ink)]">编辑公告</h1>
            <p className="mt-1 text-sm text-[var(--pa-muted)]">{announcement ? `${announcement.title} · ${announcement.status}` : "加载公告"}</p>
          </div>
          <Link className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-2 text-sm" href="/reader_admin/announcements">
            返回列表
          </Link>
        </div>
        {error ? <div className="rounded-md border border-[var(--pa-error)] bg-[var(--pa-error-soft)] px-4 py-3 text-sm text-[var(--pa-error)]">{error}</div> : null}
        {loading ? (
          <div className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4 text-sm text-[var(--pa-muted)]">加载中</div>
        ) : (
          <form className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]" onSubmit={save}>
            <div className="space-y-4">
              <label className="block space-y-2 text-sm">
                <span className="text-[var(--pa-muted)]">标题</span>
                <input className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]" onChange={(event) => setTitle(event.target.value)} required value={title} />
              </label>
              <AdminMarkdownEditor value={bodyMarkdown} onChange={setBodyMarkdown} />
              <div className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4">
                <h2 className="text-sm font-semibold text-[var(--pa-ink)]">HTML 预览</h2>
                <div className="mt-3 text-sm leading-7 text-[var(--pa-ink)]" dangerouslySetInnerHTML={{ __html: bodyHtml || "<p>保存后显示服务端 HTML。</p>" }} />
              </div>
            </div>
            <aside className="space-y-4">
              <label className="block space-y-2 text-sm">
                <span className="text-[var(--pa-muted)]">语言</span>
                <select className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3" onChange={(event) => setLanguage(event.target.value as Language)} value={language}>
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className="block space-y-2 text-sm">
                <span className="text-[var(--pa-muted)]">路线状态</span>
                <select className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3" onChange={(event) => setRoadmapStatus(event.target.value as RoadmapStatus)} value={roadmapStatus}>
                  <option value="planned">planned</option>
                  <option value="in_progress">in_progress</option>
                  <option value="shipped">shipped</option>
                </select>
              </label>
              <label className="block space-y-2 text-sm">
                <span className="text-[var(--pa-muted)]">展示位置</span>
                <select className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3" onChange={(event) => setDisplayPosition(event.target.value as DisplayPosition)} value={displayPosition}>
                  <option value="dashboard">dashboard</option>
                  <option value="announcement_page">announcement_page</option>
                  <option value="global_banner">global_banner</option>
                </select>
              </label>
              <label className="block space-y-2 text-sm">
                <span className="text-[var(--pa-muted)]">排序</span>
                <input className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3" onChange={(event) => setSortOrder(Number(event.target.value))} type="number" value={sortOrder} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input checked={isPinned} onChange={(event) => setPinned(event.target.checked)} type="checkbox" />
                <span>置顶</span>
              </label>
              <button className="pa-focus h-11 w-full rounded-md bg-[var(--pa-green)] text-sm font-medium text-white disabled:opacity-50" disabled={saving} type="submit">
                保存
              </button>
            </aside>
          </form>
        )}
      </section>
    </AdminShell>
  );
}
