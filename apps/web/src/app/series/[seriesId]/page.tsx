import { redirect } from "next/navigation";

export default function SeriesPage({
  params
}: {
  params: { seriesId: string };
}) {
  redirect(`/zh/series/${params.seriesId}/courses`);
}
