import type { Metadata } from "next";

import { SiteChrome } from "@/components/SiteChrome";
import { StoryComments } from "@/components/StoryComments";
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
import { dictionaries } from "@/lib/i18n";
import { loadStoryMarkdown, renderStoryMarkdown } from "@/lib/story-markdown";

export async function generateMetadata({
  searchParams
}: {
  searchParams?: MarketingSearchParams;
}): Promise<Metadata> {
  const locale = resolveMarketingLocale(searchParams);
  return {
    title: marketingMetadataTitles[locale].story,
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
  searchParams?: MarketingSearchParams;
}) {
  const locale = resolveMarketingLocale(searchParams);
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
