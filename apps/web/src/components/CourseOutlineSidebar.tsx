"use client";

import type { CourseOutlineItem } from "@/lib/types";
import { CloseIcon } from "./UiIcons";

function depthClassName(depth: CourseOutlineItem["depth"]): string {
  const classes = {
    1: "pl-3 font-semibold text-[var(--pa-ink)]",
    2: "pl-6 text-[var(--pa-ink)]",
    3: "pl-9 text-[var(--pa-muted)]",
    4: "pl-12 text-[var(--pa-muted)]"
  };
  return classes[depth] ?? classes[4];
}

export function CourseOutlineSidebar({
  closeLabel,
  courseTitle,
  includeDataAttribute = true,
  onClose,
  onSelect,
  outline,
  title
}: {
  closeLabel: string;
  courseTitle: string;
  includeDataAttribute?: boolean;
  onClose: () => void;
  onSelect: (itemId: string) => void;
  outline: CourseOutlineItem[];
  title: string;
}) {
  return (
    <div
      {...(includeDataAttribute ? { "data-course-outline-sidebar": true } : {})}
      className="flex h-full min-h-0 flex-col bg-[var(--pa-muted-surface)]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--pa-line)] p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--pa-ink)]">{title}</p>
          <p className="mt-1 truncate text-xs text-[var(--pa-muted)]">{courseTitle}</p>
        </div>
        <button
          aria-label={closeLabel}
          className="pa-focus inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-muted)] hover:text-[var(--pa-ink)]"
          onClick={onClose}
          type="button"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
      <nav aria-label={title} className="min-h-0 flex-1 space-y-1 overflow-auto p-3">
        {outline.map((item) => (
          <button
            className={[
              "pa-focus block min-h-9 w-full rounded-md py-2 pr-3 text-left text-sm leading-5 transition hover:bg-[var(--pa-surface)] hover:text-[var(--pa-green)]",
              depthClassName(item.depth)
            ].join(" ")}
            key={item.id}
            onClick={() => onSelect(item.id)}
            title={item.title}
            type="button"
          >
            <span className="block truncate">{item.title}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export function CourseOutlineDrawer({
  closeLabel,
  courseTitle,
  mobileOnly = true,
  onClose,
  onSelect,
  open,
  outline,
  title
}: {
  closeLabel: string;
  courseTitle: string;
  mobileOnly?: boolean;
  onClose: () => void;
  onSelect: (itemId: string) => void;
  open: boolean;
  outline: CourseOutlineItem[];
  title: string;
}) {
  if (!open || outline.length === 0) {
    return null;
  }

  return (
    <div
      aria-label={title}
      aria-modal="true"
      className={["fixed inset-0 z-50 bg-black/30", mobileOnly ? "md:hidden" : ""].join(" ")}
      onMouseDown={onClose}
      role="dialog"
    >
      <div
        className="mr-auto flex h-full w-[86vw] max-w-sm flex-col shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <CourseOutlineSidebar
          closeLabel={closeLabel}
          courseTitle={courseTitle}
          includeDataAttribute={false}
          onClose={onClose}
          onSelect={(itemId) => {
            onSelect(itemId);
            onClose();
          }}
          outline={outline}
          title={title}
        />
      </div>
    </div>
  );
}
