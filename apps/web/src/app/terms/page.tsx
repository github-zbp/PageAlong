import type { Metadata } from "next";
import { SiteChrome } from "@/components/SiteChrome";
import {
  importTextHref,
  marketingFooterLinks,
  marketingFooterNote,
  marketingHref,
  marketingNavLinks
} from "@/lib/site";
import type { Locale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "用户条款 - 页相随 PageAlong"
};

const termsCopy = {
  zh: {
    eyebrow: "用户条款",
    title: "用户条款草案",
    intro: "这是一份当前公开站点的最小条款草案，后续会随着产品能力和正式发布节奏继续完善。",
    sections: [
      {
        title: "当前可用范围",
        body: "当前公开站点主要提供文本导入、课程生成、播放进度保存和下载入口。"
      },
      {
        title: "尚未开放的能力",
        body: "真实 TTS、文件上传、OCR、认证和生产级监控仍在迭代中，不应被当作已经正式提供的功能。"
      },
      {
        title: "内容责任",
        body: "请只提交你有权使用的内容，并在理解当前草案仍会变化的前提下使用这个站点。"
      }
    ]
  },
  en: {
    eyebrow: "Terms of use",
    title: "Terms of use draft",
    intro: "This is the minimum draft for the current public site and will be expanded as product capabilities and release timing mature.",
    sections: [
      {
        title: "Current scope",
        body: "The public site currently focuses on text import, course generation, playback progress, and download entry points."
      },
      {
        title: "Not yet live",
        body: "Real TTS, file upload, OCR, authentication, and production-grade observability are still in progress and should not be treated as live."
      },
      {
        title: "Content responsibility",
        body: "Only submit content you have the right to use, and treat this draft as something that will continue to change."
      }
    ]
  }
} as const;

function normalizeLocale(value: string | string[] | undefined): Locale {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "en" ? "en" : "zh";
}

export default function TermsPage({
  searchParams
}: {
  searchParams?: { lang?: string | string[] };
}) {
  const locale = normalizeLocale(searchParams?.lang);
  const copy = termsCopy[locale];
  const pageHref = marketingHref("/terms", locale);

  return (
    <SiteChrome
      locale={locale}
      homeHref={marketingHref("/", locale)}
      brandPrimary={locale === "zh" ? "页相随" : "PageAlong"}
      brandSecondary={locale === "zh" ? "把读不完的内容，变成一路相随的课程" : "Turn long reads into courses that follow along."}
      navLinks={marketingNavLinks(locale)}
      activeNavHref={pageHref}
      localeLinks={{
        zh: marketingHref("/terms", "zh"),
        en: marketingHref("/terms", "en")
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
