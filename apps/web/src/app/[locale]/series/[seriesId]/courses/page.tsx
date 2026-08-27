import { SeriesCoursesPage } from "@/components/SeriesCoursesPage";
import { normalizeLocale } from "@/lib/i18n";

export default function SeriesCoursesRoutePage({
  params
}: {
  params: { locale: string; seriesId: string };
}) {
  return <SeriesCoursesPage locale={normalizeLocale(params.locale)} seriesId={params.seriesId} />;
}
