import type { ReactNode } from "react";
import { normalizeTagColor, normalizeTagName } from "@/lib/tag-colors";
import type { TagRead } from "@/lib/types";

export function TagChip({
  tag,
  active,
  onRemove,
  className = ""
}: {
  tag: TagRead | string;
  active?: boolean;
  onRemove?: () => void;
  className?: string;
}) {
  const name = normalizeTagName(tag);
  const color = normalizeTagColor(tag);
  const content: ReactNode = onRemove ? (
    <span className="inline-flex items-center gap-1">
      <span>{name}</span>
      <span aria-hidden="true">×</span>
    </span>
  ) : (
    name
  );

  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-[0.68rem] font-medium",
        active ? "ring-1 ring-inset ring-white/40" : "",
        className
      ].join(" ")}
      style={{ backgroundColor: color, color: "#fff" }}
    >
      {content}
    </span>
  );
}

