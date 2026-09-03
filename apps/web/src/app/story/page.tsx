import type { Metadata } from "next";

import { SiteChrome } from "@/components/SiteChrome";
import { StoryComments } from "@/components/StoryComments";
import {
  importTextHref,
  marketingFooterLinks,
  marketingFooterNote,
  marketingHref,
  marketingNavLinks
} from "@/lib/site";
import { dictionaries, type Locale } from "@/lib/i18n";
import { loadStoryMarkdown, renderStoryMarkdown } from "@/lib/story-markdown";

function normalizeLocale(value: string | string[] | undefined): Locale {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "en" ? "en" : "zh";
}

export async function generateMetadata({
  searchParams
}: {
  searchParams?: { lang?: string | string[] };
}): Promise<Metadata> {
  const locale = normalizeLocale(searchParams?.lang);
  return {
    title: locale === "zh" ? "产品故事 - 页相随" : "Product Story - PageAlong",
    description:
      locale === "zh"
        ? "页相随 PageAlong 的产品故事，直接从 markdown 文档渲染。"
        : "The product story behind PageAlong, rendered directly from markdown."
  };
}

export const dynamic = "force-dynamic";

export default async function StoryPage({
  searchParams
}: {
  searchParams?: { lang?: string | string[] };
}) {
  const locale = normalizeLocale(searchParams?.lang);
  const pageHref = marketingHref("/story", locale);
  const markdown = await loadStoryMarkdown(locale);
  const storyHtml = renderStoryMarkdown(markdown);

  return (
    <SiteChrome
      locale={locale}
      homeHref={marketingHref("/", locale)}
      brandPrimary={locale === "zh" ? "页相随" : "PageAlong"}
      brandSecondary={locale === "zh" ? "产品故事" : "Product story"}
      navLinks={marketingNavLinks(locale)}
      activeNavHref={pageHref}
      localeLinks={{
        zh: marketingHref("/story", "zh"),
        en: marketingHref("/story", "en")
      }}
      primaryCta={{ href: importTextHref(locale), label: locale === "zh" ? "免费使用" : "Use for free" }}
      footerLinks={marketingFooterLinks(locale)}
      footerNote={marketingFooterNote[locale]}
    >
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <article
          className="story-markdown min-w-0"
          dangerouslySetInnerHTML={{ __html: storyHtml }}
        />
      </main>
      <StoryComments locale={locale} copy={dictionaries[locale].comments} />
    </SiteChrome>
  );
}
