"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { CloseIcon } from "./UiIcons";

export function FloatingPanel({
  children,
  closeLabel,
  onClose,
  open,
  position = "center",
  title
}: {
  children: ReactNode;
  closeLabel: string;
  onClose: () => void;
  open: boolean;
  position?: "center" | "right";
  title: string;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const isDrawer = position === "right";

  return (
    <div
      aria-label={title}
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/40"
      onMouseDown={onClose}
      role="dialog"
    >
      <div
        className={
          isDrawer
            ? "ml-auto flex h-full w-full max-w-md items-stretch"
            : "flex min-h-full items-center justify-center p-4"
        }
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className={
            isDrawer
              ? "flex h-full w-full flex-col border-l border-[var(--pa-line)] bg-[var(--pa-surface)] shadow-2xl"
              : "flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] shadow-2xl"
          }
        >
          <div className="flex items-start justify-between gap-3 border-b border-[var(--pa-line)] p-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[var(--pa-ink)]">{title}</h2>
            </div>
            <button
              aria-label={closeLabel}
              className="pa-focus inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--pa-line)] text-[var(--pa-muted)] hover:text-[var(--pa-ink)]"
              onClick={onClose}
              type="button"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
