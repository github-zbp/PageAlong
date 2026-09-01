"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { AdminMarkdownEditor } from "@/components/AdminMarkdownEditor";
import { createAdminAnnouncement } from "@/lib/api";

type Language = "zh" | "en";
type RoadmapStatus = "planned" | "in_progress" | "shipped";
type DisplayPosition = "dashboard" | "announcement_page" | "global_banner";

export default function NewAnnouncementPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<Language>("zh");
  const [bodyMarkdown, setBodyMarkdown] = useState("公告正文");
  const [roadmapStatus, setRoadmapStatus] = useState<RoadmapStatus>("planned");
  const [displayPosition, setDisplayPosition] = useState<DisplayPosition>("dashboard");
  const [sortOrder, setSortOrder] = useState(0);
  const [isPinned, setPinned] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await createAdminAnnouncement({
        title,
        language,
        body_markdown: bodyMarkdown,
        roadmap_status: roadmapStatus,
        display_position: displayPosition,
        sort_order: sortOrder,
        is_pinned: isPinned
      });
      router.push(`/reader_admin/announcements/${created.id}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存公告失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <section className="space-y-5">
        <div className="border-b border-[var(--pa-line)] pb-4">
          <h1 className="text-xl font-semibold text-[var(--pa-ink)]">新增公告</h1>
          <p className="mt-1 text-sm text-[var(--pa-muted)]">用于 dashboard 和后续功能路线公示。</p>
        </div>
        {error ? <div className="rounded-md border border-[var(--pa-error)] bg-[var(--pa-error-soft)] px-4 py-3 text-sm text-[var(--pa-error)]">{error}</div> : null}
        <form className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]" onSubmit={save}>
          <div className="space-y-4">
            <label className="block space-y-2 text-sm">
              <span className="text-[var(--pa-muted)]">标题</span>
              <input className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]" onChange={(event) => setTitle(event.target.value)} required value={title} />
            </label>
            <AdminMarkdownEditor value={bodyMarkdown} onChange={setBodyMarkdown} />
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
      </section>
    </AdminShell>
  );
}
