import Link from "next/link";
import { ConsoleShell } from "@/components/ConsoleShell";
import { PageHeader } from "@/components/PageHeader";
import { dictionaries, normalizeLocale } from "@/lib/i18n";

export default function JobsPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const dictionary = dictionaries[locale];

  return (
    <ConsoleShell locale={locale}>
      <PageHeader title={dictionary.jobs.title} subtitle={dictionary.jobs.subtitle} />
      <section className="rounded-md border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold">{dictionary.jobs.emptyTitle}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">{dictionary.jobs.emptyBody}</p>
        <div className="mt-4 flex gap-2">
          <Link className="rounded-md border border-neutral-300 px-3 py-2 text-sm" href={`/${locale}/library`}>
            {dictionary.nav.fragmentedCourses}
          </Link>
          <Link className="rounded-md bg-neutral-950 px-3 py-2 text-sm text-white" href={`/${locale}/import`}>
            {dictionary.nav.courseImport}
          </Link>
        </div>
      </section>
    </ConsoleShell>
  );
}
