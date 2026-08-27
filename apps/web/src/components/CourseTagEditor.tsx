"use client";

import { useEffect, useMemo, useState } from "react";
import { createCourseTag, listCourseTags, updateCourseLibrary } from "@/lib/api";
import { dictionaries, type Locale } from "@/lib/i18n";
import { pickTagColor } from "@/lib/tag-colors";
import type { Course, TagRead } from "@/lib/types";
import { TagChip } from "./TagChip";

export function CourseTagEditor({
  course,
  embedded = false,
  locale,
  onCourseChange
}: {
  course: Course;
  embedded?: boolean;
  locale: Locale;
  onCourseChange: (course: Course) => void;
}) {
  const dictionary = dictionaries[locale];
  const [allTags, setAllTags] = useState<TagRead[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setSaving] = useState(false);

  useEffect(() => {
    void listCourseTags()
      .then((items) => setAllTags(items))
      .catch(() => setAllTags([]));
  }, []);

  const selectedTagIds = useMemo(() => new Set(course.tags.map((tag) => tag.id)), [course.tags]);
  const queryValue = query.trim();
  const matchingTags = useMemo(() => {
    if (!queryValue) {
      return [];
    }
    const normalizedQuery = queryValue.toLowerCase();
    return allTags
      .filter((tag) => !selectedTagIds.has(tag.id) && tag.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 8);
  }, [allTags, queryValue, selectedTagIds]);
  const exactMatch = useMemo(
    () =>
      queryValue
        ? allTags.find((tag) => tag.name.trim().toLowerCase() === queryValue.toLowerCase()) ?? null
        : null,
    [allTags, queryValue]
  );

  async function refreshTags() {
    try {
      setAllTags(await listCourseTags());
    } catch {
      setAllTags([]);
    }
  }

  async function updateTagIds(nextTagIds: string[]) {
    setSaving(true);
    setError("");
    try {
      const updated = await updateCourseLibrary({
        courseId: course.id,
        tagIds: nextTagIds
      });
      onCourseChange(updated);
      await refreshTags();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : dictionary.tags.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function addTagByName(name: string) {
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError(dictionary.tags.nameRequired);
      return;
    }

    const existing = allTags.find((tag) => tag.name.trim().toLowerCase() === normalizedName.toLowerCase());
    if (existing) {
      if (selectedTagIds.has(existing.id)) {
        setQuery("");
        return;
      }
      await updateTagIds([...course.tags.map((tag) => tag.id), existing.id]);
      setQuery("");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const created = await createCourseTag({
        name: normalizedName,
        color: pickTagColor(allTags.length)
      });
      await updateTagIds([...course.tags.map((tag) => tag.id), created.id]);
      setQuery("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : dictionary.tags.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function removeTag(tagId: string) {
    await updateTagIds(course.tags.filter((tag) => tag.id !== tagId).map((tag) => tag.id));
  }

  return (
    <div className={embedded ? "space-y-4" : "mb-5 rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4"}>
      {!embedded ? (
        <div>
          <h2 className="text-base font-semibold text-[var(--pa-ink)]">{dictionary.detail.tagsTitle}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--pa-muted)]">{dictionary.detail.tagsSubtitle}</p>
        </div>
      ) : null}

      <div className={embedded ? "space-y-4" : "mt-4 space-y-4"}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1">
            <input
              aria-label={dictionary.detail.tagSearchPlaceholder}
              className="h-10 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 text-sm outline-none focus:border-[var(--pa-green)]"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void addTagByName(queryValue);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setQuery("");
                }
              }}
              placeholder={dictionary.detail.tagSearchPlaceholder}
              value={query}
            />
          </div>
          <button
            className="pa-focus rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm text-[var(--pa-green)] disabled:opacity-50"
            disabled={isSaving || !queryValue}
            onClick={() => void addTagByName(queryValue)}
            type="button"
          >
            {dictionary.detail.addTag}
          </button>
        </div>

        {queryValue ? (
          <div className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-2">
            <div className="space-y-1">
              {matchingTags.map((tag) => (
                <button
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm text-[var(--pa-ink)] hover:bg-[var(--pa-muted-surface)]"
                  key={tag.id}
                  onClick={() => void addTagByName(tag.name)}
                  type="button"
                >
                  <TagChip tag={tag} />
                </button>
              ))}
              {queryValue && !exactMatch ? (
                <button
                  className="mt-1 flex w-full items-center justify-between gap-3 rounded-md border border-dashed border-[var(--pa-line)] px-2 py-2 text-left text-sm text-[var(--pa-green)] hover:border-[var(--pa-green)]"
                  onClick={() => void addTagByName(queryValue)}
                  type="button"
                >
                  <span>{dictionary.detail.createTag}</span>
                  <span className="text-xs text-[var(--pa-muted)]">{queryValue}</span>
                </button>
              ) : null}
              {matchingTags.length === 0 && exactMatch ? (
                <p className="px-2 py-2 text-sm text-[var(--pa-muted)]">{dictionary.detail.noTags}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {course.tags.length > 0 ? (
            course.tags.map((tag) => (
              <button
                aria-label={`${dictionary.detail.removeTag} ${tag.name}`}
                className="inline-flex"
                key={tag.id}
                onClick={() => void removeTag(tag.id)}
                type="button"
              >
                <TagChip tag={tag} onRemove={() => undefined} />
              </button>
            ))
          ) : (
            <p className="text-sm leading-6 text-[var(--pa-muted)]">{dictionary.detail.noTags}</p>
          )}
        </div>

        {error ? <p className="text-sm text-[var(--pa-error)]">{error}</p> : null}
      </div>
    </div>
  );
}
