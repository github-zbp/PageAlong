import { PageHeader } from "@/components/PageHeader";
import { MobileExtensionImportForm } from "@/components/MobileExtensionImportForm";
import { dictionaries, normalizeLocale } from "@/lib/i18n";

export default function ExtensionImportPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const dictionary = dictionaries[locale];

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-6">
      <PageHeader title={dictionary.extensionImport.title} subtitle={dictionary.extensionImport.subtitle} />
      <MobileExtensionImportForm dictionary={dictionary} locale={locale} />
    </main>
  );
}
