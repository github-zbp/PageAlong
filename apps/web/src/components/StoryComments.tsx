"use client";

import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  clearAuthToken,
  createStoryComment,
  getCurrentUser,
  hasAuthToken,
  listStoryCommentsPage
} from "@/lib/api";
import type { Locale } from "@/lib/i18n";
import type { StoryComment } from "@/lib/types";

export type StoryCommentsCopy = {
  title: string;
  intro: string;
  loginPrompt: string;
  loginCta: string;
  placeholder: string;
  countLabel: string;
  submit: string;
  submitting: string;
  loading: string;
  loadingMore: string;
  loadMore: string;
  empty: string;
  error: string;
  success: string;
  loginState: string;
};

function formatCommentDate(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function StoryComments({ locale, copy }: { locale: Locale; copy: StoryCommentsCopy }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void listStoryCommentsPage({ page: 1, pageSize: 20 })
      .then((response) => {
        if (cancelled) return;
        setComments(response.items);
        setPage(1);
        setHasNext(response.pagination.has_next);
        setHasLoadError(false);
      })
      .catch(() => {
        if (!cancelled) {
          setHasLoadError(true);
          setStatusMessage({ kind: "error", text: copy.error });
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [copy.error]);

  useEffect(() => {
    let cancelled = false;
    if (!hasAuthToken()) {
      setAuthChecked(true);
      return () => {
        cancelled = true;
      };
    }
    void getCurrentUser()
      .then((user) => {
        if (!cancelled) setCurrentEmail(user.email);
      })
      .catch(() => {
        clearAuthToken();
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function goToLogin() {
    const returnPath = `${pathname || "/story"}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    router.push(`/${locale}/login?next=${encodeURIComponent(returnPath)}`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedContent = content.trim();
    if (!currentEmail || !trimmedContent || isSubmitting) return;

    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const comment = await createStoryComment(trimmedContent);
      setComments((items) => [comment, ...items]);
      setContent("");
      setStatusMessage({ kind: "success", text: copy.success });
    } catch (error) {
      setStatusMessage({ kind: "error", text: error instanceof Error ? error.message : copy.error });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLoadMore() {
    if (isLoadingMore || !hasNext) return;
    const nextPage = page + 1;
    setIsLoadingMore(true);
    try {
      const response = await listStoryCommentsPage({ page: nextPage, pageSize: 20 });
      setComments((items) => {
        const existingIds = new Set(items.map((item) => item.id));
        return [...items, ...response.items.filter((item) => !existingIds.has(item.id))];
      });
      setPage(nextPage);
      setHasNext(response.pagination.has_next);
    } catch {
      setStatusMessage({ kind: "error", text: copy.error });
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <section className="border-t border-[var(--pa-line)] bg-[var(--pa-muted-surface)]" aria-labelledby="story-comments-title">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-[72ch]">
          <h2 id="story-comments-title" className="text-2xl font-semibold leading-tight text-[var(--pa-ink)] sm:text-3xl">{copy.title}</h2>
          <p className="mt-4 text-[1.0625rem] leading-8 text-[var(--pa-muted)]">{copy.intro}</p>

          {!authChecked ? (
            <p className="mt-8 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-4 py-4 text-sm text-[var(--pa-muted)]">{copy.loginState}</p>
          ) : currentEmail ? (
            <form className="mt-8 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4 sm:p-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="sr-only">{copy.placeholder}</span>
                <textarea
                  className="min-h-28 w-full resize-y rounded-md border border-[var(--pa-line)] bg-[var(--pa-bg)] px-3 py-3 text-sm leading-7 text-[var(--pa-ink)] outline-none transition placeholder:text-[var(--pa-muted)] focus:border-[var(--pa-green)]"
                  maxLength={300}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder={copy.placeholder}
                  value={content}
                />
              </label>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-[var(--pa-muted)]">{content.length} / 300 {copy.countLabel}</span>
                <button className="pa-focus rounded-md bg-[var(--pa-green)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={!content.trim() || isSubmitting} type="submit">
                  {isSubmitting ? copy.submitting : copy.submit}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-4 py-4 sm:px-5">
              <p className="text-sm leading-6 text-[var(--pa-muted)]">{copy.loginPrompt}</p>
              <button className="pa-focus rounded-md border border-[var(--pa-green)] px-4 py-2 text-sm font-medium text-[var(--pa-green)] transition hover:bg-[var(--pa-green-soft)]" onClick={goToLogin} type="button">{copy.loginCta}</button>
            </div>
          )}

          {statusMessage ? (
            <p className={["mt-4 rounded-md px-3 py-2 text-sm", statusMessage.kind === "success" ? "bg-[var(--pa-green-soft)] text-[var(--pa-green)]" : "bg-[var(--pa-error-soft)] text-[var(--pa-error)]"].join(" ")} role="status">
              {statusMessage.text}
            </p>
          ) : null}

          <div className="mt-10">
            {isLoading ? <p className="text-sm text-[var(--pa-muted)]">{copy.loading}</p> : null}
            {!isLoading && !hasLoadError && comments.length === 0 ? <p className="border-y border-[var(--pa-line)] py-6 text-sm text-[var(--pa-muted)]">{copy.empty}</p> : null}
            <ol className="divide-y divide-[var(--pa-line)] border-y border-[var(--pa-line)]">
              {comments.map((comment) => (
                <li key={comment.id} className="py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <strong className="text-sm font-semibold text-[var(--pa-ink)]">{comment.author_email}</strong>
                    <time className="text-xs text-[var(--pa-muted)]" dateTime={comment.created_at}>{formatCommentDate(comment.created_at, locale)}</time>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[var(--pa-muted)]">{comment.content}</p>
                </li>
              ))}
            </ol>
            {hasNext ? (
              <button className="pa-focus mt-6 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-4 py-3 text-sm font-medium text-[var(--pa-ink)] transition hover:border-[var(--pa-green)] disabled:cursor-not-allowed disabled:opacity-60" disabled={isLoadingMore} onClick={handleLoadMore} type="button">
                {isLoadingMore ? copy.loadingMore : copy.loadMore}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
