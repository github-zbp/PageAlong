"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ConsoleShell } from "@/components/ConsoleShell";
import { CourseCard } from "@/components/CourseCard";
import { PageHeader } from "@/components/PageHeader";
import { deleteCourse, listCourseTags, listCourses, updateCourseLibrary } from "@/lib/api";
import { dictionaries, normalizeLocale } from "@/lib/i18n";
import type { CourseSummary } from "@/lib/types";

export default function LibraryPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const dictionary = dictionaries[locale];
  const searchParams = useSearchParams();
  const query = searchParams.get("query")?.trim() ?? "";
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);

  async function refresh() {
    const nextCourses = await listCourses({
      libraryType: "fragmented",
      query,
      tag: selectedTag || undefined,
      starred: starredOnly || undefined
    });
    setCourses(nextCourses);
  }

  async function refreshTags() {
    try {
      setTags(await listCourseTags());
    } catch {
      setTags([]);
    }
  }

  async function removeCourse(courseId: string) {
    await deleteCourse(courseId);
    await refresh();
  }

  async function toggleStar(course: CourseSummary) {
    await updateCourseLibrary({ courseId: course.id, isStarred: !course.is_starred });
    await refresh();
  }

  useEffect(() => {
    void refresh();
  }, [query, selectedTag, starredOnly]);

  useEffect(() => {
    void refreshTags();
  }, []);

  return (
    <ConsoleShell locale={locale}>
      <PageHeader title={dictionary.library.title} subtitle={dictionary.library.subtitle} />
      <section className="mb-4 flex flex-col gap-3 rounded-lg border border-[#ddd2c1] bg-[#fffdf8] p-3 sm:flex-row sm:items-center">
        <select
          className="h-10 rounded-md border border-[#ddd2c1] bg-[#fffdf8] px-3 text-sm outline-none focus:border-[#2f6f5e]"
          value={selectedTag}
          onChange={(event) => setSelectedTag(event.target.value)}
          aria-label={dictionary.library.tags}
        >
          <option value="">{dictionary.library.allTags}</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-[#70685e]">
          <input
            checked={starredOnly}
            className="h-4 w-4 accent-[#2f6f5e]"
            onChange={(event) => setStarredOnly(event.target.checked)}
            type="checkbox"
          />
          {dictionary.library.starredOnly}
        </label>
      </section>
      {courses.length > 0 ? (
        <section className="space-y-3">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              locale={locale}
              onDelete={removeCourse}
              onToggleStar={toggleStar}
            />
          ))}
        </section>
      ) : (
        <div className="rounded-lg border border-dashed border-[#ddd2c1] bg-[#fffdf8] p-5 text-sm text-[#70685e]">
          {query ? dictionary.library.emptySearch : dictionary.library.empty}
        </div>
      )}
    </ConsoleShell>
  );
}
