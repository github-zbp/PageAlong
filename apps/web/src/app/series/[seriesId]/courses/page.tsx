import { redirect } from "next/navigation";

export default function SeriesCoursesPage({
  params
}: {
  params: { seriesId: string };
}) {
  redirect(`/zh/series/${params.seriesId}/courses`);
}
