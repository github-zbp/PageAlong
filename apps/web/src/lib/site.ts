import type { Locale } from "@/lib/i18n";

export type SiteLink = {
  href: string;
  label: string;
};

const marketingNavBase = {
  zh: [
    { path: "/guide", label: "指南" },
    { path: "/download", label: "下载" },
    { path: "/blog", label: "博客" },
    { path: "/story", label: "产品故事" }
  ],
  en: [
    { path: "/guide", label: "Guide" },
    { path: "/download", label: "Download" },
    { path: "/blog", label: "Blog" },
    { path: "/story", label: "Product Story" }
  ]
} as const;

const marketingFooterBase = {
  zh: [
    { path: "/privacy", label: "隐私政策" },
    { path: "/terms", label: "用户条款" }
  ],
  en: [
    { path: "/privacy", label: "Privacy Policy" },
    { path: "/terms", label: "Terms of Use" }
  ]
} as const;

export const marketingPageTitles = {
  zh: {
    guide: "指南",
    download: "下载",
    blog: "博客",
    story: "产品故事",
    privacy: "隐私政策",
    terms: "用户条款"
  },
  en: {
    guide: "Guide",
    download: "Download",
    blog: "Blog",
    story: "Product Story",
    privacy: "Privacy Policy",
    terms: "Terms of Use"
  }
} as const;

export const marketingComingSoonCopy = {
  zh: {
    eyebrow: "即将开放",
    title: "这一页还在准备中",
    body: "我们会在后续迭代补上完整内容，先保留最小可访问入口。"
  },
  en: {
    eyebrow: "Coming soon",
    title: "This page is still being prepared",
    body: "We will fill it out in a later iteration and keep the entry point available for now."
  }
} as const;

export const marketingFooterNote = {
  zh: "PageAlong 仍在迭代中，真实 TTS、文件上传、OCR 和生产认证还未开放。",
  en: "PageAlong is still in progress; real TTS, file upload, OCR, and production auth are not live yet."
} as const;

export function marketingHref(pathname: string, locale: Locale): string {
  return locale === "en" ? `${pathname}?lang=en` : pathname;
}

export function marketingNavLinks(locale: Locale): SiteLink[] {
  return marketingNavBase[locale].map((item) => ({
    href: marketingHref(item.path, locale),
    label: item.label
  }));
}

export function marketingFooterLinks(locale: Locale): SiteLink[] {
  return marketingFooterBase[locale].map((item) => ({
    href: marketingHref(item.path, locale),
    label: item.label
  }));
}

export function importTextHref(locale: Locale): string {
  return locale === "en" ? "/en/import/text" : "/zh/import/text";
}
