import Link from "next/link";
import type { ReactNode } from "react";
import { SiteChrome } from "@/components/SiteChrome";
import type { Locale } from "@/lib/i18n";
import type { SiteLink } from "@/lib/site";

export function AuthPageShell({
  locale,
  homeHref,
  brandPrimary,
  brandSecondary,
  navLinks,
  localeLinks,
  primaryCta,
  footerLinks,
  footerNote,
  backHref,
  backLabel,
  children
}: {
  locale: Locale;
  homeHref: string;
  brandPrimary: string;
  brandSecondary: string;
  navLinks: SiteLink[];
  localeLinks: Record<Locale, string>;
  primaryCta: SiteLink;
  footerLinks: SiteLink[];
  footerNote: string;
  backHref: string;
  backLabel: string;
  children: ReactNode;
}) {
  return (
    <SiteChrome
      locale={locale}
      homeHref={homeHref}
      brandPrimary={brandPrimary}
      brandSecondary={brandSecondary}
      navLinks={navLinks}
      localeLinks={localeLinks}
      primaryCta={primaryCta}
      footerLinks={footerLinks}
      footerNote={footerNote}
    >
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-8">
        <Link
          className="pa-focus mb-4 inline-flex w-fit rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm font-medium text-[var(--pa-muted)] shadow-sm transition hover:border-[var(--pa-green)] hover:text-[var(--pa-green)]"
          href={backHref}
        >
          {backLabel}
        </Link>
        {children}
      </div>
    </SiteChrome>
  );
}
