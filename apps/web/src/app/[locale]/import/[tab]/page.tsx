import { notFound, redirect } from "next/navigation";
import { ConsoleShell } from "@/components/ConsoleShell";
import { ImportFileForm } from "@/components/ImportFileForm";
import { ImportTextForm } from "@/components/ImportTextForm";
import { ImportUrlForm } from "@/components/ImportUrlForm";
import { dictionaries, normalizeLocale } from "@/lib/i18n";

function renderImportTab(locale: string, tab: string) {
  const dictionary = dictionaries[normalizeLocale(locale)];

  if (tab === "text") {
    return <ImportTextForm dictionary={dictionary} locale={normalizeLocale(locale)} />;
  }

  if (tab === "url") {
    return <ImportUrlForm dictionary={dictionary} locale={normalizeLocale(locale)} />;
  }

  if (tab === "file") {
    return <ImportFileForm dictionary={dictionary} locale={normalizeLocale(locale)} />;
  }

  if (tab === "extension") {
    redirect(`/${normalizeLocale(locale)}/extension/import`);
  }

  notFound();
}

export default function ImportTabPage({ params }: { params: { locale: string; tab: string } }) {
  const locale = normalizeLocale(params.locale);

  return <ConsoleShell locale={locale}>{renderImportTab(params.locale, params.tab)}</ConsoleShell>;
}
