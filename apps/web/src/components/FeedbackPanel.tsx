"use client";

import { FormEvent, useEffect, useState } from "react";
import { submitFeedback } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n";
import type { FeedbackCategory } from "@/lib/types";
import { FloatingPanel } from "./FloatingPanel";

const feedbackCategories: Array<{ value: FeedbackCategory; labelKey: keyof Dictionary["feedback"]["categories"] }> = [
  { value: "suggestion", labelKey: "suggestion" },
  { value: "bug", labelKey: "bug" },
  { value: "feature", labelKey: "feature" }
];

export function FeedbackPanel({
  currentEmail,
  currentPath,
  dictionary,
  onClose,
  open
}: {
  currentEmail: string;
  currentPath: string;
  dictionary: Dictionary;
  onClose: () => void;
  open: boolean;
}) {
  const [category, setCategory] = useState<FeedbackCategory>("suggestion");
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackState, setFeedbackState] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setFeedbackState(null);
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedSummary = summary.trim();
    const trimmedMessage = message.trim();
    if (!trimmedSummary || !trimmedMessage) {
      return;
    }

    setIsSubmitting(true);
    setFeedbackState(null);
    try {
      await submitFeedback({
        category,
        summary: trimmedSummary,
        message: trimmedMessage,
        pagePath: currentPath
      });
      setFeedbackState({ kind: "success", message: dictionary.feedback.success });
      setCategory("suggestion");
      setSummary("");
      setMessage("");
    } catch (error) {
      setFeedbackState({
        kind: "error",
        message: error instanceof Error ? error.message : dictionary.feedback.error
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FloatingPanel
      closeLabel={dictionary.common.close}
      onClose={onClose}
      open={open}
      position="right"
      title={dictionary.feedback.title}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm leading-6 text-[var(--pa-muted)]">{dictionary.feedback.description}</p>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-normal text-[var(--pa-muted)]">{dictionary.feedback.categoryLabel}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {feedbackCategories.map((item) => {
              const active = category === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={active}
                  className={[
                    "pa-focus rounded-md border px-3 py-2 text-left text-sm transition",
                    active
                      ? "border-[var(--pa-green)] bg-[var(--pa-green-soft)] text-[var(--pa-green)]"
                      : "border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-ink)] hover:border-[var(--pa-green)] hover:text-[var(--pa-green)]"
                  ].join(" ")}
                  onClick={() => setCategory(item.value)}
                >
                  {dictionary.feedback.categories[item.labelKey]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-normal text-[var(--pa-muted)]">
              {dictionary.feedback.summaryLabel}
            </span>
            <input
              className="h-10 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 text-sm outline-none transition placeholder:text-[var(--pa-muted)] focus:border-[var(--pa-green)]"
              maxLength={120}
              onChange={(event) => setSummary(event.target.value)}
              placeholder={dictionary.feedback.summaryPlaceholder}
              required
              value={summary}
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-normal text-[var(--pa-muted)]">
              {dictionary.feedback.messageLabel}
            </span>
            <textarea
              className="min-h-40 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-[var(--pa-muted)] focus:border-[var(--pa-green)]"
              maxLength={4000}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={dictionary.feedback.messagePlaceholder}
              required
              value={message}
            />
          </label>
        </div>

        <div className="space-y-2 rounded-md border border-[var(--pa-line)] bg-[var(--pa-muted-surface)] p-3 text-sm text-[var(--pa-muted)]">
          <div className="flex items-center justify-between gap-3">
            <span>{dictionary.feedback.emailLabel}</span>
            <span className="truncate text-[var(--pa-ink)]" title={currentEmail}>
              {currentEmail}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>{dictionary.feedback.pageLabel}</span>
            <span className="truncate text-[var(--pa-ink)]" title={currentPath}>
              {currentPath}
            </span>
          </div>
        </div>

        {feedbackState ? (
          <p
            className={[
              "rounded-md px-3 py-2 text-sm",
              feedbackState.kind === "success"
                ? "bg-[var(--pa-green-soft)] text-[var(--pa-green)]"
                : "bg-[var(--pa-error-soft)] text-[var(--pa-error)]"
            ].join(" ")}
          >
            {feedbackState.message}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs leading-5 text-[var(--pa-muted)]">{dictionary.feedback.note}</p>
          <button
            className="pa-focus rounded-md bg-[var(--pa-green)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? dictionary.feedback.submitting : dictionary.feedback.submit}
          </button>
        </div>
      </form>
    </FloatingPanel>
  );
}
