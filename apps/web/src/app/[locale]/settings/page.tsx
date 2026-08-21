import Link from "next/link";
import { ConsoleShell } from "@/components/ConsoleShell";
import { PageHeader } from "@/components/PageHeader";
import { alternateLocale, dictionaries, normalizeLocale } from "@/lib/i18n";

export default function SettingsPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const nextLocale = alternateLocale(locale);
  const dictionary = dictionaries[locale];

  return (
    <ConsoleShell locale={locale}>
      <PageHeader title={dictionary.settings.title} subtitle={dictionary.settings.subtitle} />
      <section className="rounded-md border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold">{dictionary.settings.language}</h2>
        <p className="mt-2 text-sm text-neutral-600">
          {dictionary.settings.current}: {locale === "zh" ? "简体中文" : "English"}
        </p>
        <Link
          className="mt-4 inline-flex rounded-md border border-neutral-300 px-3 py-2 text-sm"
          href={`/${nextLocale}/settings`}
        >
          {dictionary.languageSwitch}
        </Link>
      </section>
    </ConsoleShell>
  );
}
