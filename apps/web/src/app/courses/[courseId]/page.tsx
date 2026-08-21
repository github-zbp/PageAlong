import { redirect } from "next/navigation";

export default async function CourseDetailPage({ params }: { params: { courseId: string } }) {
  redirect(`/zh/courses/${params.courseId}`);
}
