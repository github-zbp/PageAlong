"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { AdminMarkdownEditor } from "@/components/AdminMarkdownEditor";
import { getAdminBlog, updateAdminBlog } from "@/lib/api";
import type { AdminBlogDetail } from "@/lib/types";

type Language = "zh" | "en";

export default function EditAdminBlogPage({ params }: { params: { blogId: string } }) {
  const [blog, setBlog] = useState<AdminBlogDetail | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [language, setLanguage] = useState<Language>("zh");
  const [summary, setSummary] = useState("");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadBlog() {
      setLoading(true);
      setError("");
      try {
        const detail = await getAdminBlog(params.blogId);
        if (cancelled) {
          return;
        }
        setBlog(detail);
        setTitle(detail.title);
        setSlug(detail.slug);
        setLanguage(detail.language);
        setSummary(detail.summary);
        setBodyMarkdown(detail.body_markdown);
        setSeoTitle(detail.seo_title);
        setSeoDescription(detail.seo_description);
        setPreviewHtml(detail.body_html);
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

    void loadBlog();

    return () => {
      cancelled = true;
    };
  }, [params.blogId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = await updateAdminBlog(params.blogId, {
        title,
        slug,
        language,
        summary,
        body_markdown: bodyMarkdown,
        seo_title: seoTitle,
        seo_description: seoDescription
      });
      setBlog(saved);
      setPreviewHtml(saved.body_html);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存博客失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <section className="space-y-5">
        <div className="flex flex-col gap-3 border-b border-[var(--pa-line)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--pa-ink)]">编辑博客</h1>
            <p className="mt-1 text-sm leading-6 text-[var(--pa-muted)]">
              {blog ? `${blog.title} · ${blog.status}` : "加载博客内容"}
            </p>
          </div>
          <Link className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-2 text-sm" href="/reader_admin/blogs">
            返回列表
          </Link>
        </div>

        {error ? (
          <div className="rounded-md border border-[var(--pa-error)] bg-[var(--pa-error-soft)] px-4 py-3 text-sm text-[var(--pa-error)]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4 text-sm text-[var(--pa-muted)]">
            加载中
          </div>
        ) : (
          <form className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]" onSubmit={save}>
            <div className="space-y-4">
              <label className="block space-y-2 text-sm">
                <span className="text-[var(--pa-muted)]">标题</span>
                <input className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]" onChange={(event) => setTitle(event.target.value)} required value={title} />
              </label>
              <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                <label className="block space-y-2 text-sm">
                  <span className="text-[var(--pa-muted)]">Slug</span>
                  <input className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]" onChange={(event) => setSlug(event.target.value)} required value={slug} />
                </label>
                <label className="block space-y-2 text-sm">
                  <span className="text-[var(--pa-muted)]">语言</span>
                  <select className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]" onChange={(event) => setLanguage(event.target.value as Language)} value={language}>
                    <option value="zh">中文</option>
                    <option value="en">English</option>
                  </select>
                </label>
              </div>
              <label className="block space-y-2 text-sm">
                <span className="text-[var(--pa-muted)]">摘要</span>
                <textarea className="min-h-20 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 outline-none focus:border-[var(--pa-green)]" onChange={(event) => setSummary(event.target.value)} value={summary} />
              </label>
              <AdminMarkdownEditor value={bodyMarkdown} onChange={setBodyMarkdown} />
            </div>

            <aside className="space-y-4">
              <label className="block space-y-2 text-sm">
                <span className="text-[var(--pa-muted)]">SEO 标题</span>
                <input className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]" onChange={(event) => setSeoTitle(event.target.value)} value={seoTitle} />
              </label>
              <label className="block space-y-2 text-sm">
                <span className="text-[var(--pa-muted)]">SEO 描述</span>
                <textarea className="min-h-24 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 outline-none focus:border-[var(--pa-green)]" onChange={(event) => setSeoDescription(event.target.value)} value={seoDescription} />
              </label>
              <button className="pa-focus h-11 w-full rounded-md bg-[var(--pa-green)] text-sm font-medium text-white disabled:opacity-50" disabled={saving} type="submit">
                保存
              </button>
              <div className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4">
                <h2 className="text-sm font-semibold text-[var(--pa-ink)]">HTML 预览</h2>
                <div className="prose prose-sm mt-3 max-w-none text-[var(--pa-ink)]" dangerouslySetInnerHTML={{ __html: previewHtml || "<p>保存后显示服务端 HTML。</p>" }} />
              </div>
            </aside>
          </form>
        )}
      </section>
    </AdminShell>
  );
}
