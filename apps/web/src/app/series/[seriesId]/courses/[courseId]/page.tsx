import { redirect } from "next/navigation";

export default function SeriesCourseDetailPage({
  params
}: {
  params: { seriesId: string; courseId: string };
}) {
  redirect(`/zh/series/${params.seriesId}/courses/${params.courseId}`);
}
