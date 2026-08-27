import Link from "next/link";
import type { Locale } from "@/lib/i18n";

export function ComingSoonCard({
  eyebrow,
  title,
  body,
  primaryCta,
  primaryCtaHref,
  secondaryCta,
  secondaryCtaHref,
  locale
}: {
  eyebrow: string;
  title: string;
  body: string;
  primaryCta: string;
  primaryCtaHref: string;
  secondaryCta: string;
  secondaryCtaHref: string;
  locale: Locale;
}) {
  return (
    <section className="mx-auto flex min-h-full w-full max-w-3xl items-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-8">
        <p className="text-sm font-medium text-[var(--pa-green)]">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight text-[var(--pa-ink)] sm:text-4xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--pa-muted)] sm:text-base">{body}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            className="pa-focus rounded-md bg-[var(--pa-green)] px-5 py-3 text-center text-sm font-medium text-white"
            href={primaryCtaHref}
          >
            {primaryCta}
          </Link>
          <Link
            className="pa-focus rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-5 py-3 text-center text-sm font-medium text-[var(--pa-ink)]"
            href={secondaryCtaHref}
          >
            {secondaryCta}
          </Link>
        </div>
        <p className="mt-5 text-xs text-[var(--pa-muted)]">
          {locale === "zh" ? "页面内容会在后续迭代继续补齐。" : "The page content will be filled out in a later iteration."}
        </p>
      </div>
    </section>
  );
}
