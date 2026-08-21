import Link from "next/link";
import { notFound } from "next/navigation";
import { ConsoleShell } from "@/components/ConsoleShell";
import { ImportFileForm } from "@/components/ImportFileForm";
import { ImportTextForm } from "@/components/ImportTextForm";
import { ImportUrlForm } from "@/components/ImportUrlForm";
import { PageHeader } from "@/components/PageHeader";
import { dictionaries, normalizeLocale, type Dictionary, type Locale } from "@/lib/i18n";

const importTabs = ["text", "url", "file", "extension"] as const;

type ImportTab = (typeof importTabs)[number];

function isImportTab(value: string): value is ImportTab {
  return importTabs.includes(value as ImportTab);
}

function tabLabel(dictionary: Dictionary, tab: ImportTab): string {
  if (tab === "text") {
    return dictionary.import.pasteText;
  }
  if (tab === "url") {
    return dictionary.import.urlImport;
  }
  if (tab === "file") {
    return dictionary.import.fileUpload;
  }
  return dictionary.import.extension;
}

function ImportTabs({
  activeTab,
  dictionary,
  locale
}: {
  activeTab: ImportTab;
  dictionary: Dictionary;
  locale: Locale;
}) {
  return (
    <nav aria-label={dictionary.import.tabsLabel} className="mb-5 grid gap-2 sm:grid-cols-4">
      {importTabs.map((tab) => {
        const active = tab === activeTab;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={[
              "pa-focus rounded-md border px-3 py-2 text-center text-sm font-medium transition",
              active
                ? "border-[#2f6f5e] bg-[#2f6f5e] text-white"
                : "border-[#ddd2c1] bg-[#fffdf8] text-[#70685e] hover:border-[#2f6f5e] hover:text-[#245447]"
            ].join(" ")}
            href={`/${locale}/import/${tab}`}
            key={tab}
          >
            {tabLabel(dictionary, tab)}
          </Link>
        );
      })}
    </nav>
  );
}

function ComingSoonPanel({
  body,
  dictionary,
  title
}: {
  body: string;
  dictionary: Dictionary;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-[#ddd2c1] bg-[#fffdf8] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#1f1a14]">{title}</h2>
        <span className="rounded-full bg-[#f3ede2] px-2.5 py-1 text-xs text-[#70685e]">
          {dictionary.import.comingSoon}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#70685e]">{body}</p>
    </section>
  );
}

function renderImportTab(tab: ImportTab, dictionary: Dictionary, locale: Locale) {
  if (tab === "text") {
    return (
      <section className="max-w-3xl space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[#1f1a14]">{dictionary.import.pasteText}</h2>
          <p className="mt-1 text-sm leading-6 text-[#70685e]">{dictionary.import.textIntro}</p>
        </div>
        <ImportTextForm dictionary={dictionary} locale={locale} />
      </section>
    );
  }

  if (tab === "url") {
    return (
      <section className="max-w-4xl space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[#1f1a14]">{dictionary.import.urlImport}</h2>
          <p className="mt-1 text-sm leading-6 text-[#70685e]">{dictionary.import.urlIntro}</p>
        </div>
        <ImportUrlForm dictionary={dictionary} locale={locale} />
      </section>
    );
  }

  if (tab === "file") {
    return (
      <section className="max-w-4xl space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[#1f1a14]">{dictionary.import.fileUpload}</h2>
          <p className="mt-1 text-sm leading-6 text-[#70685e]">{dictionary.import.fileUploadBody}</p>
        </div>
        <ImportFileForm dictionary={dictionary} locale={locale} />
      </section>
    );
  }

  return (
    <div className="max-w-3xl">
      <ComingSoonPanel
        body={dictionary.import.extensionBody}
        dictionary={dictionary}
        title={dictionary.import.extension}
      />
    </div>
  );
}

export default function ImportTabPage({ params }: { params: { locale: string; tab: string } }) {
  const locale = normalizeLocale(params.locale);
  const dictionary = dictionaries[locale];
  if (!isImportTab(params.tab)) {
    notFound();
  }

  return (
    <ConsoleShell locale={locale}>
      <PageHeader
        title={dictionary.import.title}
        subtitle={dictionary.import.subtitle}
        action={
          <Link
            className="pa-focus rounded-md border border-[#ddd2c1] bg-[#fffdf8] px-4 py-2 text-sm font-medium text-[#245447]"
            href={`/${locale}/jobs`}
          >
            {dictionary.import.taskList}
          </Link>
        }
      />
      <ImportTabs activeTab={params.tab} dictionary={dictionary} locale={locale} />
      {renderImportTab(params.tab, dictionary, locale)}
    </ConsoleShell>
  );
}
