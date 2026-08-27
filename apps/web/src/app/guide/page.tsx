import type { Metadata } from "next";
import { ComingSoonCard } from "@/components/ComingSoonCard";
import { SiteChrome } from "@/components/SiteChrome";
import {
  importTextHref,
  marketingComingSoonCopy,
  marketingFooterLinks,
  marketingFooterNote,
  marketingHref,
  marketingNavLinks,
  marketingPageTitles
} from "@/lib/site";
import type { Locale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "指南 - 页相随 PageAlong"
};

function normalizeLocale(value: string | string[] | undefined): Locale {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "en" ? "en" : "zh";
}

export default function GuidePage({
  searchParams
}: {
  searchParams?: { lang?: string | string[] };
}) {
  const locale = normalizeLocale(searchParams?.lang);
  const pageHref = marketingHref("/guide", locale);

  return (
    <SiteChrome
      locale={locale}
      homeHref={marketingHref("/", locale)}
      brandPrimary={locale === "zh" ? "页相随" : "PageAlong"}
      brandSecondary={locale === "zh" ? "把读不完的内容，变成一路相随的课程" : "Turn long reads into courses that follow along."}
      navLinks={marketingNavLinks(locale)}
      activeNavHref={pageHref}
      localeLinks={{
        zh: marketingHref("/guide", "zh"),
        en: marketingHref("/guide", "en")
      }}
      primaryCta={{ href: importTextHref(locale), label: locale === "zh" ? "免费使用" : "Use for free" }}
      footerLinks={marketingFooterLinks(locale)}
      footerNote={marketingFooterNote[locale]}
    >
      <ComingSoonCard
        eyebrow={marketingPageTitles[locale].guide}
        title={marketingComingSoonCopy[locale].title}
        body={marketingComingSoonCopy[locale].body}
        primaryCta={locale === "zh" ? "免费使用" : "Use for free"}
        primaryCtaHref={importTextHref(locale)}
        secondaryCta={locale === "zh" ? "返回首页" : "Back to home"}
        secondaryCtaHref={marketingHref("/", locale)}
        locale={locale}
      />
    </SiteChrome>
  );
}
