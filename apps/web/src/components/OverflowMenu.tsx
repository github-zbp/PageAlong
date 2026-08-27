"use client";

import { useEffect, useRef, useState } from "react";
import { EllipsisVerticalIcon } from "./UiIcons";

export type OverflowMenuItem = {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

export function OverflowMenu({
  ariaLabel,
  items
}: {
  ariaLabel: string;
  items: OverflowMenuItem[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const root = rootRef.current;
      if (root && !root.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        className="pa-focus inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-muted)] hover:border-[var(--pa-muted)] hover:text-[var(--pa-ink)]"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <EllipsisVerticalIcon className="h-5 w-5" />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+0.35rem)] z-20 min-w-48 overflow-hidden rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-1 shadow-lg"
          role="menu"
        >
          {items.map((item) => (
            <button
              className={[
                "pa-focus flex w-full items-center rounded-md px-3 py-2 text-left text-sm",
                item.disabled
                  ? "cursor-not-allowed text-[var(--pa-muted)] opacity-40"
                  : item.destructive
                    ? "text-[var(--pa-error)] hover:bg-[var(--pa-error-soft)]"
                    : "text-[var(--pa-ink)] hover:bg-[var(--pa-muted-surface)]"
              ].join(" ")}
              disabled={item.disabled}
              key={item.label}
              onClick={() => {
                if (item.disabled) {
                  return;
                }
                setOpen(false);
                item.onSelect();
              }}
              role="menuitem"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
