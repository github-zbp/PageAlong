import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import type { SiteLink } from "@/lib/site";

type LocaleLinks = Record<Locale, string>;

function LocaleTabs({
  locale,
  localeLinks
}: {
  locale: Locale;
  localeLinks: LocaleLinks;
}) {
  const tabBase =
    "pa-focus rounded-[6px] px-3 py-1.5 text-sm font-medium transition sm:px-3.5";

  return (
    <div className="inline-flex rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-1" aria-label={locale === "zh" ? "语言切换" : "Language switch"}>
      <Link
        className={[
          tabBase,
          locale === "zh"
            ? "bg-[var(--pa-ink)] text-white"
            : "text-[var(--pa-muted)] hover:text-[var(--pa-green)]"
        ].join(" ")}
        href={localeLinks.zh}
        aria-current={locale === "zh" ? "page" : undefined}
      >
        中文
      </Link>
      <Link
        className={[
          tabBase,
          locale === "en"
            ? "bg-[var(--pa-ink)] text-white"
            : "text-[var(--pa-muted)] hover:text-[var(--pa-green)]"
        ].join(" ")}
        href={localeLinks.en}
        aria-current={locale === "en" ? "page" : undefined}
      >
        English
      </Link>
    </div>
  );
}

export function SiteChrome({
  locale,
  homeHref,
  brandPrimary,
  brandSecondary,
  navLinks,
  activeNavHref,
  localeLinks,
  primaryCta,
  footerLinks,
  footerNote,
  children
}: {
  locale: Locale;
  homeHref: string;
  brandPrimary: string;
  brandSecondary: string;
  navLinks: SiteLink[];
  activeNavHref?: string;
  localeLinks: LocaleLinks;
  primaryCta: SiteLink;
  footerLinks: SiteLink[];
  footerNote: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--pa-bg)] text-[var(--pa-ink)]">
      <header className="sticky top-0 z-30 border-b border-[var(--pa-line)] bg-[var(--pa-surface)] backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
            <Link href={homeHref} className="pa-focus min-w-0">
              <span className="block text-sm font-semibold text-[var(--pa-ink)]">{brandPrimary}</span>
              <span className="mt-0.5 block truncate text-[11px] text-[var(--pa-muted)]">{brandSecondary}</span>
            </Link>

            <nav className="hidden items-center justify-center gap-2 lg:flex" aria-label={locale === "zh" ? "主导航" : "Primary navigation"}>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "pa-focus rounded-full border px-3 py-1.5 text-sm transition",
                    activeNavHref === link.href
                      ? "border-[var(--pa-green)] bg-[var(--pa-green-soft)] text-[var(--pa-ink)]"
                      : "border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-muted)] hover:border-[var(--pa-green)] hover:text-[var(--pa-green)]"
                  ].join(" ")}
                  aria-current={activeNavHref === link.href ? "page" : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <LocaleTabs locale={locale} localeLinks={localeLinks} />
              <Link
                href={primaryCta.href}
                className="pa-focus rounded-md bg-[var(--pa-green)] px-4 py-2 text-sm font-medium text-white shadow-[0_6px_18px_rgba(17,17,17,0.12)]"
              >
                {primaryCta.label}
              </Link>
            </div>
          </div>

          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label={locale === "zh" ? "主导航" : "Primary navigation"}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "pa-focus shrink-0 rounded-full border px-3 py-1.5 text-xs transition",
                  activeNavHref === link.href
                    ? "border-[var(--pa-green)] bg-[var(--pa-green-soft)] text-[var(--pa-ink)]"
                    : "border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-muted)]"
                ].join(" ")}
                aria-current={activeNavHref === link.href ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 overflow-x-hidden">{children}</main>

      <footer className="border-t border-[var(--pa-line)] bg-[var(--pa-surface)]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-md">
              <p className="text-sm font-semibold text-[var(--pa-ink)]">{brandPrimary}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--pa-muted)]">{brandSecondary}</p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              {footerLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="pa-focus text-[var(--pa-muted)] transition hover:text-[var(--pa-green)]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <p className="mt-6 text-xs leading-5 text-[var(--pa-muted)]">{footerNote}</p>
        </div>
      </footer>
    </div>
  );
}
