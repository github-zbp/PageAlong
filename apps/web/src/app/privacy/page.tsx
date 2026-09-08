import type { Metadata } from "next";
import { SiteChrome } from "@/components/SiteChrome";
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

export function generateMetadata({
  searchParams
}: {
  searchParams?: MarketingSearchParams;
}): Metadata {
  const locale = resolveMarketingLocale(searchParams);
  return {
    title: marketingMetadataTitles[locale].privacy
  };
}

export const dynamic = "force-dynamic";

const privacyCopy = {
  zh: {
    eyebrow: "隐私政策",
    title: "隐私政策草案",
    intro: "这是一份当前公开站点的最小草案，后续会随着真实账户、导入和下载流程继续完善。",
    sections: [
      {
        title: "我们会处理什么",
        body: "你主动提交的内容、课程标题、导入记录和账号信息会被用于提供 PageAlong 的现有功能。"
      },
      {
        title: "我们怎么使用这些内容",
        body: "这些内容只会用于生成课程、保存进度、支持下载和回答与你的使用有关的问题。"
      },
      {
        title: "联系",
        body: "如果你希望我们补充完整的正式版本，可以直接联系 juhuatang@outlook.com。"
      }
    ]
  },
  en: {
    eyebrow: "Privacy policy",
    title: "Privacy policy draft",
    intro: "This is the minimum draft for the current public site and will be expanded as account, import, and download flows mature.",
    sections: [
      {
        title: "What we process",
        body: "Content you submit, course titles, import records, and account details are used to provide the current PageAlong features."
      },
      {
        title: "How we use it",
        body: "That information is used to generate courses, save progress, support downloads, and answer questions about your usage."
      },
      {
        title: "Contact",
        body: "If you want the full formal version, reach out at juhuatang@outlook.com."
      }
    ]
  }
} as const;

export default function PrivacyPage({
  searchParams
}: {
  searchParams?: MarketingSearchParams;
}) {
  const locale = resolveMarketingLocale(searchParams);
  const copy = privacyCopy[locale];
  const pageHref = marketingHref("/privacy", locale);

  return (
    <SiteChrome
      locale={locale}
      homeHref={marketingHref("/", locale)}
      brandPrimary={locale === "zh" ? "页相随" : "PageAlong"}
      brandSecondary={locale === "zh" ? "把读不完的内容，变成一路相随的课程" : "Turn long reads into courses that follow along."}
      navLinks={marketingNavLinks(locale)}
      activeNavHref={pageHref}
      localeLinks={{
        zh: marketingHref("/privacy", "zh"),
        en: marketingHref("/privacy", "en")
      }}
      primaryCta={{ href: importTextHref(locale), label: locale === "zh" ? "免费使用" : "Use for free" }}
      footerLinks={marketingFooterLinks(locale)}
      footerNote={marketingFooterNote[locale]}
    >
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-8">
          <p className="text-sm font-medium text-[var(--pa-green)]">{copy.eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight text-[var(--pa-ink)] sm:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--pa-muted)] sm:text-base">{copy.intro}</p>
          <div className="mt-8 space-y-6">
            {copy.sections.map((section) => (
              <div key={section.title} className="border-t border-[var(--pa-line)] pt-6 first:border-t-0 first:pt-0">
                <h2 className="text-base font-semibold text-[var(--pa-ink)]">{section.title}</h2>
                <p className="mt-2 text-sm leading-7 text-[var(--pa-muted)]">{section.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
