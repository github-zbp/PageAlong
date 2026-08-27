import Link from "next/link";
import type { ReactNode } from "react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { ClipboardIcon, ExtensionIcon, FileIcon, GlobeIcon, ArrowRightIcon } from "@/components/UiIcons";
import { dictionaries, normalizeLocale } from "@/lib/i18n";

function ImportChoice({
  href,
  icon,
  label
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      className="group flex min-h-36 flex-col justify-between rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-5 transition hover:border-[var(--pa-green)] hover:bg-[var(--pa-green-soft)]"
      href={href}
    >
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-green)]">
        {icon}
      </div>
      <div className="mt-6 flex items-end justify-between gap-3">
        <span className="text-base font-medium text-[var(--pa-ink)]">{label}</span>
        <ArrowRightIcon className="h-4 w-4 text-[var(--pa-muted)] transition group-hover:text-[var(--pa-green)]" />
      </div>
    </Link>
  );
}

export default function ImportHomePage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const dictionary = dictionaries[locale];

  return (
    <ConsoleShell locale={locale}>
      <section className="flex flex-col gap-3">
        <ImportChoice
          href={`/${locale}/import/text`}
          icon={<ClipboardIcon className="h-5 w-5" />}
          label={dictionary.import.pasteText}
        />
        <ImportChoice
          href={`/${locale}/import/url`}
          icon={<GlobeIcon className="h-5 w-5" />}
          label={dictionary.import.urlImport}
        />
        <ImportChoice
          href={`/${locale}/import/file`}
          icon={<FileIcon className="h-5 w-5" />}
          label={dictionary.import.fileUpload}
        />
        <ImportChoice
          href={`/${locale}/extension/import`}
          icon={<ExtensionIcon className="h-5 w-5" />}
          label={dictionary.import.extension}
        />
      </section>
    </ConsoleShell>
  );
}
