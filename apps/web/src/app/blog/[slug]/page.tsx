import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogArticleContent } from "@/components/BlogPresentation";
import { SiteChrome } from "@/components/SiteChrome";
import { getPublicBlog } from "@/lib/api";
import {
  importTextHref,
  marketingFooterLinks,
  marketingFooterNote,
  marketingHref,
  marketingMetadataTitles,
  marketingNavLinks,
  resolveMarketingLocale,
  type MarketingSearchParams
} from "@/lib/site";
import type { Locale } from "@/lib/i18n";

export function generateMetadata({
  searchParams
}: {
  searchParams?: MarketingSearchParams;
}): Metadata {
  const locale = resolveMarketingLocale(searchParams);
  return {
    title: marketingMetadataTitles[locale].blog
  };
}

export const dynamic = "force-dynamic";

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

export default async function BlogDetailPage({
  params,
  searchParams
}: {
  params: { slug: string };
  searchParams?: MarketingSearchParams;
}) {
  const locale = resolveMarketingLocale(searchParams);
  const post = await getPublicBlog(params.slug, locale).catch(() => null);
  if (!post) {
    notFound();
  }

  return (
    <SiteChrome
      locale={locale}
      homeHref={marketingHref("/", locale)}
      brandPrimary={locale === "zh" ? "页相随" : "PageAlong"}
      brandSecondary={locale === "zh" ? "把读不完的内容，变成一路相随的课程" : "Turn long reads into courses that follow along."}
      navLinks={marketingNavLinks(locale)}
      activeNavHref={marketingHref("/blog", locale)}
      localeLinks={{
        zh: marketingHref(`/blog/${post.slug}`, "zh"),
        en: marketingHref(`/blog/${post.slug}`, "en")
      }}
      primaryCta={{ href: importTextHref(locale), label: locale === "zh" ? "免费使用" : "Use for free" }}
      footerLinks={marketingFooterLinks(locale)}
      footerNote={marketingFooterNote[locale]}
    >
      <article className="mx-auto max-w-4xl px-4 py-14 sm:py-16">
        <Link className="pa-focus inline-flex text-sm text-[var(--pa-muted)] underline underline-offset-4" href={marketingHref("/blog", locale)}>
          {locale === "zh" ? "返回博客" : "Back to blog"}
        </Link>
        <header className="mt-5 max-w-2xl">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--pa-muted)]">
            {locale === "zh" ? "博客文章" : "Blog post"}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--pa-ink)] sm:text-4xl">{post.title}</h1>
          <p className="mt-3 text-sm text-[var(--pa-muted)]">{formatDate(post.published_at ?? post.created_at, locale)}</p>
          {post.summary ? <p className="mt-6 text-base leading-8 text-[var(--pa-muted)]">{post.summary}</p> : null}
        </header>

        {post.cover_image_url ? (
          <figure className="mt-10 overflow-hidden rounded-md border border-[var(--pa-line)] bg-[var(--pa-muted-surface)]">
            <img
              alt={post.title}
              className="aspect-[16/9] w-full object-cover"
              decoding="async"
              loading="eager"
              src={post.cover_image_url}
            />
          </figure>
        ) : null}

        <section className="mt-10 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-5 py-6 sm:px-8 sm:py-8">
          <BlogArticleContent html={post.body_html} />
        </section>
      </article>
    </SiteChrome>
  );
}
