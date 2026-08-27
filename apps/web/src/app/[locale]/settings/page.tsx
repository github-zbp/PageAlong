import Link from "next/link";
import { ConsoleShell } from "@/components/ConsoleShell";
import { PageHeader } from "@/components/PageHeader";
import { ThemeSettingsPanel } from "@/components/ThemeSettingsPanel";
import { alternateLocale, dictionaries, normalizeLocale } from "@/lib/i18n";

export default function SettingsPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const nextLocale = alternateLocale(locale);
  const dictionary = dictionaries[locale];

  return (
    <ConsoleShell locale={locale}>
      <PageHeader title={dictionary.settings.title} subtitle={dictionary.settings.subtitle} />
      <div className="space-y-4">
        <section className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--pa-ink)]">{dictionary.settings.language}</h2>
              <p className="mt-2 text-sm text-[var(--pa-muted)]">
                {dictionary.settings.current}: {locale === "zh" ? "简体中文" : "English"}
              </p>
            </div>
            <Link
              className="inline-flex rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm text-[var(--pa-ink)]"
              href={`/${nextLocale}/settings`}
            >
              {dictionary.languageSwitch}
            </Link>
          </div>
        </section>

        <ThemeSettingsPanel dictionary={dictionary} locale={locale} />
      </div>
    </ConsoleShell>
  );
}
