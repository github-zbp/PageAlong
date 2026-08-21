import { ConsoleShell } from "@/components/ConsoleShell";
import { PageHeader } from "@/components/PageHeader";
import { dictionaries, normalizeLocale } from "@/lib/i18n";

export default function TagsPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const dictionary = dictionaries[locale];

  return (
    <ConsoleShell locale={locale}>
      <PageHeader title={dictionary.tags.title} subtitle={dictionary.tags.subtitle} />
      <section className="rounded-md border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold">{dictionary.tags.emptyTitle}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">{dictionary.tags.emptyBody}</p>
      </section>
    </ConsoleShell>
  );
}
