import { redirect } from "next/navigation";
import { normalizeLocale } from "@/lib/i18n";

export default function ImportPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  redirect(`/${locale}/import/text`);
}
