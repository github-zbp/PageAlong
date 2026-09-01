import type { Metadata } from "next";
import { SiteChrome } from "@/components/SiteChrome";
import { BlogCard } from "@/components/BlogPresentation";
import { listPublicBlogs } from "@/lib/api";
import {
  importTextHref,
  marketingFooterLinks,
  marketingFooterNote,
  marketingHref,
  marketingNavLinks
} from "@/lib/site";
import type { Locale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "博客 - 页相随 PageAlong"
};

export const dynamic = "force-dynamic";

function normalizeLocale(value: string | string[] | undefined): Locale {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "en" ? "en" : "zh";
}

function formatDate(value: string | null, locale: Locale): string {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

export default async function BlogPage({
  searchParams
}: {
  searchParams?: { lang?: string | string[] };
}) {
  const locale = normalizeLocale(searchParams?.lang);
  const pageHref = marketingHref("/blog", locale);
  const response = await listPublicBlogs(locale).catch(() => ({ items: [], pagination: null }));

  return (
    <SiteChrome
      locale={locale}
      homeHref={marketingHref("/", locale)}
      brandPrimary={locale === "zh" ? "页相随" : "PageAlong"}
      brandSecondary={locale === "zh" ? "把读不完的内容，变成一路相随的课程" : "Turn long reads into courses that follow along."}
      navLinks={marketingNavLinks(locale)}
      activeNavHref={pageHref}
      localeLinks={{
        zh: marketingHref("/blog", "zh"),
        en: marketingHref("/blog", "en")
      }}
      primaryCta={{ href: importTextHref(locale), label: locale === "zh" ? "免费使用" : "Use for free" }}
      footerLinks={marketingFooterLinks(locale)}
      footerNote={marketingFooterNote[locale]}
    >
      <section className="mx-auto max-w-5xl px-4 py-14 sm:py-16">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--pa-muted)]">
            {locale === "zh" ? "博客" : "Blog"}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--pa-ink)] sm:text-4xl">
            {locale === "zh" ? "博客" : "Blog"}
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--pa-muted)]">
            {locale === "zh" ? "产品进展、阅读工作流和移动学习记录。" : "Product notes, reading workflows, and mobile learning records."}
          </p>
        </div>

        <div className="mt-10 space-y-5">
          {response.items.length === 0 ? (
            <div className="rounded-md border border-dashed border-[var(--pa-line)] bg-[var(--pa-surface)] p-5 text-sm text-[var(--pa-muted)]">
              {locale === "zh" ? "暂无已发布博客。" : "No published posts yet."}
            </div>
          ) : (
            response.items.map((post) => (
              <BlogCard
                key={post.id}
                href={marketingHref(`/blog/${post.slug}`, locale)}
                title={post.title}
                summary={post.summary}
                coverImageUrl={post.cover_image_url}
                metaLabel={formatDate(post.published_at ?? post.created_at, locale)}
                metaDateTime={post.published_at ?? post.created_at}
              />
            ))
          )}
        </div>
      </section>
    </SiteChrome>
  );
}
