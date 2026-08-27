import { SeriesManagementPage } from "@/components/SeriesManagementPage";
import { normalizeLocale } from "@/lib/i18n";

export default function SeriesPage({ params }: { params: { locale: string } }) {
  return <SeriesManagementPage locale={normalizeLocale(params.locale)} />;
}
