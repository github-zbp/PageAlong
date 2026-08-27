import { redirect } from "next/navigation";

export default function SeriesPage({
  params
}: {
  params: { locale: string; seriesId: string };
}) {
  redirect(`/${params.locale}/series/${params.seriesId}/courses`);
}
