"use client";

import { useEffect, useMemo, useState } from "react";
import { ConsoleShell } from "@/components/ConsoleShell";
import { FloatingPanel } from "@/components/FloatingPanel";
import { TagChip } from "@/components/TagChip";
import { createCourseTag, deleteCourseTag, listCourseTags, updateCourseTag } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { dictionaries, type Locale } from "@/lib/i18n";
import { pickTagColor, tagColorPalette } from "@/lib/tag-colors";
import type { TagRead } from "@/lib/types";

type TagDraft = {
  name: string;
  color: string;
};

function emptyDraft(seed = 0): TagDraft {
  return {
    name: "",
    color: pickTagColor(seed)
  };
}

export function TagManagementPage({
  locale
}: {
  locale: Locale;
}) {
  const dictionary = dictionaries[locale];
  const [tags, setTags] = useState<TagRead[]>([]);
  const [query, setQuery] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [isCreating, setCreating] = useState(false);
  const [draft, setDraft] = useState<TagDraft>(() => emptyDraft());
  const [error, setError] = useState("");
  const [isSaving, setSaving] = useState(false);

  const selectedTag = useMemo(
    () => tags.find((tag) => tag.id === selectedTagId) ?? null,
    [selectedTagId, tags]
  );

  const visibleTags = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return tags;
    }
    return tags.filter((tag) => tag.name.toLowerCase().includes(normalizedQuery));
  }, [query, tags]);

  async function refresh() {
    const items = await listCourseTags();
    setTags(items);
    setSelectedTagId((current) => {
      if (!current) {
        return current;
      }
      return items.some((tag) => tag.id === current) ? current : null;
    });
    setCreating((current) => (current && items.length > 0 ? current : false));
  }

  useEffect(() => {
    void refresh().catch(() => {
      setTags([]);
    });
  }, []);

  useEffect(() => {
    if (!selectedTag) {
      return;
    }
    setDraft({
      name: selectedTag.name,
      color: selectedTag.color
    });
  }, [selectedTag]);

  function openTag(tag: TagRead) {
    setError("");
    setCreating(false);
    setSelectedTagId(tag.id);
    setDraft({
      name: tag.name,
      color: tag.color
    });
  }

  function openCreate() {
    setError("");
    setSelectedTagId(null);
    setCreating(true);
    setDraft(emptyDraft(tags.length));
  }

  async function saveTag() {
    const name = draft.name.trim();
    if (!name) {
      setError(dictionary.tags.nameRequired);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const next = selectedTag
        ? await updateCourseTag({ tagId: selectedTag.id, name, color: draft.color })
        : await createCourseTag({ name, color: draft.color });
      await refresh();
      setSelectedTagId(next.id);
      setCreating(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : dictionary.tags.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function removeTag() {
    if (!selectedTag) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await deleteCourseTag(selectedTag.id);
      setSelectedTagId(null);
      setCreating(false);
      setDraft(emptyDraft(tags.length));
      await refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : dictionary.tags.deleteError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ConsoleShell locale={locale}>
      <section className="mb-4 flex flex-col gap-3 border-b border-[var(--pa-line)] pb-4 sm:flex-row sm:items-center">
        <input
          aria-label={dictionary.tags.search}
          className="h-10 min-w-0 flex-1 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 text-sm outline-none focus:border-[var(--pa-ink)]"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={dictionary.tags.search}
          type="search"
          value={query}
        />
        <button
          className="rounded-md border border-[var(--pa-line)] px-3 py-2 text-sm text-[var(--pa-ink)]"
          onClick={openCreate}
          type="button"
        >
          {dictionary.tags.newTag}
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleTags.map((tag) => (
          <button
            key={tag.id}
            className={[
              "rounded-md border p-4 text-left transition",
              selectedTagId === tag.id
                ? "border-[var(--pa-ink)] bg-[var(--pa-surface)] shadow-sm"
                : "border-[var(--pa-line)] bg-[var(--pa-surface)] hover:border-[var(--pa-muted)]"
            ].join(" ")}
            onClick={() => openTag(tag)}
            type="button"
          >
            <div className="flex items-center justify-between gap-3">
              <TagChip tag={tag} />
              <span className="text-xs text-[var(--pa-muted)]">
                {tag.usage_count} {dictionary.tags.usageCount}
              </span>
            </div>
            <p className="mt-3 text-xs text-[var(--pa-muted)]">
              {dictionary.tags.updatedAt}: {formatDateTime(tag.updated_at, locale)}
            </p>
          </button>
        ))}
        {visibleTags.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--pa-line)] bg-[var(--pa-surface)] p-4 text-sm text-[var(--pa-muted)]">
            {dictionary.tags.emptyBody}
          </div>
        ) : null}
      </section>

      <FloatingPanel
        closeLabel={dictionary.common.close}
        onClose={() => {
          setSelectedTagId(null);
          setCreating(false);
          setError("");
        }}
        open={Boolean(selectedTag || isCreating)}
        position="right"
        title={selectedTag ? dictionary.tags.editTitle : dictionary.tags.createTitle}
      >
        {selectedTag || isCreating ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-[var(--pa-ink)]">
                {selectedTag ? dictionary.tags.editTitle : dictionary.tags.createTitle}
              </p>
              <p className="mt-1 text-xs text-[var(--pa-muted)]">
                {selectedTag ? `${selectedTag.usage_count} ${dictionary.tags.usageCount}` : dictionary.tags.createBody}
              </p>
            </div>

            <label className="block space-y-2 text-sm">
              <span className="text-[var(--pa-muted)]">{dictionary.tags.nameLabel}</span>
              <input
                aria-label={dictionary.tags.nameLabel}
                className="h-11 w-full rounded-md border border-[var(--pa-line)] px-3 outline-none focus:border-[var(--pa-ink)]"
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                value={draft.name}
              />
            </label>

            <div className="space-y-2">
              <span className="text-sm text-[var(--pa-muted)]">{dictionary.tags.colorLabel}</span>
              <div className="flex flex-wrap gap-2">
                {tagColorPalette.map((color) => (
                  <button
                    aria-label={color}
                    className={[
                      "h-8 w-8 rounded-full border-2",
                      draft.color === color ? "border-[var(--pa-ink)]" : "border-transparent"
                    ].join(" ")}
                    key={color}
                    onClick={() => setDraft((current) => ({ ...current, color }))}
                    style={{ backgroundColor: color }}
                    type="button"
                  />
                ))}
              </div>
            </div>

            {error ? <p className="text-sm text-[var(--pa-error)]">{error}</p> : null}

            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-md bg-[var(--pa-green)] px-3 py-2 text-sm text-white disabled:opacity-50"
                disabled={isSaving}
                onClick={saveTag}
                type="button"
              >
                {dictionary.tags.save}
              </button>
              {selectedTag ? (
                <button
                  className="rounded-md border border-[var(--pa-error)] px-3 py-2 text-sm text-[var(--pa-error)] disabled:opacity-50"
                  disabled={isSaving}
                  onClick={removeTag}
                  type="button"
                >
                  {dictionary.tags.delete}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="text-sm leading-6 text-[var(--pa-muted)]">{dictionary.tags.emptySelectionBody}</div>
        )}
      </FloatingPanel>
    </ConsoleShell>
  );
}
