import type { Locale } from "@/lib/i18n";

export type SiteLink = {
  href: string;
  label: string;
};

export type MarketingSearchParams = {
  lang?: string | string[];
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

export const marketingMetadataTitles = {
  zh: {
    guide: "指南 - 页相随 PageAlong",
    download: "下载 - 页相随 PageAlong",
    blog: "博客 - 页相随 PageAlong",
    story: "产品故事 - 页相随 PageAlong",
    privacy: "隐私政策 - 页相随 PageAlong",
    terms: "用户条款 - 页相随 PageAlong"
  },
  en: {
    guide: "Guide - PageAlong",
    download: "Download - PageAlong",
    blog: "Blog - PageAlong",
    story: "Product Story - PageAlong",
    privacy: "Privacy Policy - PageAlong",
    terms: "Terms of Use - PageAlong"
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
  zh: "PageAlong 属于你的定制化剪藏课程管理和播客。",
  en: "PageAlong, your personalized clipping course management and podcast."
} as const;

export function marketingHref(pathname: string, locale: Locale): string {
  if (locale !== "en") {
    return pathname;
  }
  return pathname === "/" ? "/en" : `/en${pathname}`;
}

export function resolveMarketingLocale(searchParams?: MarketingSearchParams): Locale {
  const rawValue = Array.isArray(searchParams?.lang) ? searchParams.lang[0] : searchParams?.lang;
  return rawValue === "en" ? "en" : "zh";
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
