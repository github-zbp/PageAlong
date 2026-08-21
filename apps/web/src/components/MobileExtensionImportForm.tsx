"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { clearAuthToken, createExtensionSyncCourse, getCurrentUser, hasAuthToken } from "@/lib/api";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { Course } from "@/lib/types";

export function MobileExtensionImportForm({
  dictionary,
  locale
}: {
  dictionary: Dictionary;
  locale: Locale;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.toString();
  const loginHref = useMemo(() => {
    const nextPath = searchQuery ? `${pathname}?${searchQuery}` : pathname;
    return `/${locale}/login?next=${encodeURIComponent(nextPath)}`;
  }, [locale, pathname, searchQuery]);
  const [url, setUrl] = useState(() => searchParams.get("url") ?? "");
  const [title, setTitle] = useState(() => searchParams.get("title") ?? "");
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      if (!hasAuthToken()) {
        router.replace(loginHref);
        return;
      }
      try {
        await getCurrentUser();
        if (!cancelled) {
          setCheckingAuth(false);
        }
      } catch {
        clearAuthToken();
        router.replace(loginHref);
      }
    }

    void checkAuth();

    return () => {
      cancelled = true;
    };
  }, [loginHref, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const createdCourse = await createExtensionSyncCourse({
        url: url.trim(),
        title: title.trim() || undefined
      });
      setCourse(createdCourse);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : dictionary.import.error);
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingAuth) {
    return (
      <div className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-4 py-5 text-sm text-[var(--pa-muted)]">
        {dictionary.auth.loading}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form className="space-y-4 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4" onSubmit={submit}>
        <label className="block space-y-2 text-sm">
          <span className="text-[var(--pa-muted)]">{dictionary.extensionImport.urlLabel}</span>
          <input
            className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]"
            onChange={(event) => setUrl(event.target.value)}
            placeholder={dictionary.extensionImport.urlPlaceholder}
            required
            type="url"
            value={url}
          />
        </label>
        <label className="block space-y-2 text-sm">
          <span className="text-[var(--pa-muted)]">{dictionary.extensionImport.titleLabel}</span>
          <input
            className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]"
            onChange={(event) => setTitle(event.target.value)}
            placeholder={dictionary.extensionImport.titlePlaceholder}
            type="text"
            value={title}
          />
        </label>
        {error ? <p className="text-sm leading-6 text-[#b42318]">{error}</p> : null}
        <button
          className="pa-focus flex h-11 w-full items-center justify-center rounded-md bg-[var(--pa-green)] px-4 text-sm font-medium text-white disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? dictionary.extensionImport.submitting : dictionary.extensionImport.submit}
        </button>
      </form>

      {course !== null ? (
        <section className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4">
          <h2 className="text-base font-semibold text-[var(--pa-ink)]">{dictionary.extensionImport.successTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--pa-muted)]">{dictionary.extensionImport.successBody}</p>
          <div className="mt-4">
            <Link
              className="pa-focus inline-flex h-11 items-center justify-center rounded-md bg-[var(--pa-green)] px-4 text-sm font-medium text-white"
              href={`/${locale}/courses/${course.id}`}
            >
              {dictionary.extensionImport.openCourse}
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
