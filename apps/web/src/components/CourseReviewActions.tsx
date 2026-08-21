"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestCourseAudioGeneration } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n";

export function CourseReviewActions({
  courseId,
  dictionary,
  onConfirmed
}: {
  courseId: string;
  dictionary: Dictionary;
  onConfirmed?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      await requestCourseAudioGeneration(courseId);
      if (onConfirmed) {
        await onConfirmed();
        setSubmitting(false);
        return;
      }
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : dictionary.detail.confirmError);
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-5 rounded-lg border border-[#e3c88f] bg-[#f4e6ca] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#1f1a14]">{dictionary.detail.reviewTitle}</p>
          <p className="mt-1 text-sm leading-6 text-[#70685e]">{dictionary.detail.reviewBody}</p>
          {error ? <p className="mt-2 text-sm text-[#b42318]">{error}</p> : null}
        </div>
        <button
          className="pa-focus w-full rounded-md bg-[#2f6f5e] px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
          disabled={isSubmitting}
          onClick={submit}
          type="button"
        >
          {isSubmitting ? dictionary.detail.confirmingGenerate : dictionary.detail.confirmGenerate}
        </button>
      </div>
    </div>
  );
}
