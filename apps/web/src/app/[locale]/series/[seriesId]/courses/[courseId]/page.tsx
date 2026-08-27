import { SeriesCourseReadingView } from "@/components/SeriesCourseReadingView";
import { normalizeLocale } from "@/lib/i18n";

export default function SeriesCourseDetailPage({
  params
}: {
  params: { locale: string; seriesId: string; courseId: string };
}) {
  return (
    <SeriesCourseReadingView
      courseId={params.courseId}
      locale={normalizeLocale(params.locale)}
      seriesId={params.seriesId}
    />
  );
}
