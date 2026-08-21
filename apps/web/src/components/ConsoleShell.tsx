"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { clearAuthToken, getCurrentUser, hasAuthToken, logoutCurrentSession } from "@/lib/api";
import { alternateLocale, dictionaries, type Locale } from "@/lib/i18n";
import type { AuthUser } from "@/lib/types";

const courseNavItems = [
  { key: "seriesCourses", href: "series" },
  { key: "fragmentedCourses", href: "library", activePaths: ["library", "courses"] },
  { key: "courseImport", href: "import" },
  { key: "tagManagement", href: "tags" }
] as const;

function getAlternatePath(pathname: string, locale: Locale): string {
  const nextLocale = alternateLocale(locale);
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return `/${nextLocale}/dashboard`;
  }
  segments[0] = nextLocale;
  return `/${segments.join("/")}`;
}

export function ConsoleShell({
  locale,
  children
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dictionary = dictionaries[locale];
  const alternatePath = getAlternatePath(pathname, locale);
  const [searchValue, setSearchValue] = useState(searchParams.get("query") ?? "");
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    setSearchValue(searchParams.get("query") ?? "");
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      if (!hasAuthToken()) {
        router.replace(`/${locale}/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      try {
        const user = await getCurrentUser();
        if (!cancelled) {
          setCurrentUser(user);
        }
      } catch {
        clearAuthToken();
        router.replace(`/${locale}/login?next=${encodeURIComponent(pathname)}`);
      } finally {
        if (!cancelled) {
          setIsCheckingAuth(false);
        }
      }
    }

    void loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, [locale, pathname, router]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchValue.trim();
    const nextPath = query
      ? `/${locale}/library?query=${encodeURIComponent(query)}`
      : `/${locale}/library`;
    router.push(nextPath);
    setMobileNavOpen(false);
  }

  function isActive(href: string, activePaths?: readonly string[]) {
    const paths = activePaths ?? [href];
    return paths.some((path) => {
      const target = `/${locale}/${path}`;
      return pathname === target || pathname.startsWith(`${target}/`);
    });
  }

  async function signOut() {
    setCurrentUser(null);
    await logoutCurrentSession().catch(() => clearAuthToken());
    router.replace(`/${locale}/login`);
  }

  if (isCheckingAuth || currentUser === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--pa-bg)] text-sm text-[var(--pa-muted)]">
        {dictionary.auth.loading}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--pa-bg)] text-[var(--pa-ink)]">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--pa-line)] bg-[var(--pa-surface)] px-4 py-3 md:hidden">
        <Link href={`/${locale}/dashboard`} className="min-w-0">
          <p className="truncate text-base font-semibold">{dictionary.brand}</p>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            className="rounded border border-[var(--pa-line)] px-2 py-1 text-xs text-[var(--pa-muted)]"
            href={alternatePath}
            aria-label={`Switch language: ${dictionary.languageSwitch}`}
          >
            {dictionary.languageSwitch}
          </Link>
          <button
            aria-label={locale === "zh" ? "打开导航" : "Open navigation"}
            className="pa-focus rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm text-[var(--pa-ink)]"
            onClick={() => setMobileNavOpen(true)}
            type="button"
          >
            {locale === "zh" ? "菜单" : "Menu"}
          </button>
        </div>
      </header>

      {isMobileNavOpen ? (
        <div className="fixed inset-0 z-50 bg-black/30 md:hidden" role="dialog" aria-label="Primary">
          <div className="ml-auto flex h-full w-[86vw] max-w-sm flex-col bg-[var(--pa-surface)] shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--pa-line)] p-4">
              <div>
                <p className="text-base font-semibold">{dictionary.brand}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--pa-muted)]">{dictionary.brandSubtitle}</p>
              </div>
              <button
                aria-label={locale === "zh" ? "关闭导航" : "Close navigation"}
                className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-2 text-sm text-[var(--pa-muted)]"
                onClick={() => setMobileNavOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <form className="border-b border-[var(--pa-line)] p-4" role="search" onSubmit={submitSearch}>
              <input
                aria-label={dictionary.search.placeholder}
                className="h-10 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-[var(--pa-green)]"
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={dictionary.search.placeholder}
                type="search"
                value={searchValue}
              />
            </form>
            <nav className="flex flex-1 flex-col gap-5 overflow-auto p-4" aria-label="Primary">
              <Link
                href={`/${locale}/dashboard`}
                onClick={() => setMobileNavOpen(false)}
                className={[
                  "block rounded-md px-3 py-2 text-sm font-medium transition",
                  isActive("dashboard")
                    ? "bg-[var(--pa-green)] text-white"
                    : "text-[var(--pa-ink)] hover:bg-[rgba(47,111,94,0.08)] hover:text-[var(--pa-green)]"
                ].join(" ")}
              >
                {dictionary.nav.dashboard}
              </Link>
              <div>
                <p className="px-3 text-xs font-semibold uppercase tracking-normal text-[var(--pa-muted)]">
                  {dictionary.nav.myCourses}
                </p>
                <div className="mt-2 flex flex-col gap-1">
                  {courseNavItems.map((item) => {
                    const active = isActive(
                      item.href,
                      "activePaths" in item ? item.activePaths : undefined
                    );
                    return (
                      <Link
                        key={item.key}
                        href={`/${locale}/${item.href}`}
                        onClick={() => setMobileNavOpen(false)}
                        className={[
                          "block rounded-md px-3 py-2 text-sm font-medium transition",
                          active
                            ? "bg-[var(--pa-green)] text-white"
                            : "text-[var(--pa-ink)] hover:bg-[rgba(47,111,94,0.08)] hover:text-[var(--pa-green)]"
                        ].join(" ")}
                      >
                        {dictionary.nav[item.key]}
                      </Link>
                    );
                  })}
                </div>
              </div>
              <Link
                className={[
                  "block rounded-md px-3 py-2 text-sm font-medium transition",
                  isActive("settings")
                    ? "bg-[var(--pa-green)] text-white"
                    : "text-[var(--pa-ink)] hover:bg-[rgba(47,111,94,0.08)] hover:text-[var(--pa-green)]"
                ].join(" ")}
                href={`/${locale}/settings`}
                onClick={() => setMobileNavOpen(false)}
              >
                {dictionary.nav.settings}
              </Link>
              <Link
                className={[
                  "block rounded-md px-3 py-2 text-sm font-medium transition",
                  isActive("account")
                    ? "bg-[var(--pa-green)] text-white"
                    : "text-[var(--pa-ink)] hover:bg-[rgba(47,111,94,0.08)] hover:text-[var(--pa-green)]"
                ].join(" ")}
                href={`/${locale}/account`}
                onClick={() => setMobileNavOpen(false)}
              >
                {dictionary.nav.account}
              </Link>
              {currentUser?.role === "admin" ? (
                <Link
                  className={[
                    "block rounded-md px-3 py-2 text-sm font-medium transition",
                    isActive("admin")
                      ? "bg-[var(--pa-green)] text-white"
                      : "text-[var(--pa-ink)] hover:bg-[rgba(47,111,94,0.08)] hover:text-[var(--pa-green)]"
                  ].join(" ")}
                  href={`/${locale}/admin/users`}
                  onClick={() => setMobileNavOpen(false)}
                >
                  {dictionary.nav.admin}
                </Link>
              ) : null}
            </nav>
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col md:flex-row">
        <aside className="hidden border-b border-[var(--pa-line)] bg-[var(--pa-muted-surface)] px-4 py-4 md:flex md:min-h-screen md:w-72 md:flex-col md:border-b-0 md:border-r md:px-5">
          <div className="flex items-start justify-between gap-4 md:block">
            <Link href={`/${locale}/dashboard`} className="block">
              <p className="text-lg font-semibold tracking-normal">{dictionary.brand}</p>
              <p className="mt-1 max-w-44 text-xs leading-5 text-[var(--pa-muted)]">
                {dictionary.brandSubtitle}
              </p>
            </Link>
            <Link
              className="rounded border border-[var(--pa-line)] px-2 py-1 text-xs text-[var(--pa-muted)] md:hidden"
              href={alternatePath}
              aria-label={`Switch language: ${dictionary.languageSwitch}`}
            >
              {dictionary.languageSwitch}
            </Link>
          </div>

          <form className="mt-5" role="search" onSubmit={submitSearch}>
            <input
              aria-label={dictionary.search.placeholder}
              className="h-10 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-[var(--pa-green)]"
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={dictionary.search.placeholder}
              type="search"
              value={searchValue}
            />
          </form>

          <nav className="mt-5 flex flex-col gap-5" aria-label="Primary">
            <div>
              <Link
                href={`/${locale}/dashboard`}
                className={[
                  "block rounded-md px-3 py-2 text-sm font-medium transition",
                  isActive("dashboard")
                    ? "bg-[var(--pa-green)] text-white"
                    : "text-[var(--pa-ink)] hover:bg-[rgba(47,111,94,0.08)] hover:text-[var(--pa-green)]"
                ].join(" ")}
              >
                {dictionary.nav.dashboard}
              </Link>
            </div>

            <div>
              <p className="px-3 text-xs font-semibold uppercase tracking-normal text-[var(--pa-muted)]">
                {dictionary.nav.myCourses}
              </p>
              <div className="mt-2 flex flex-col gap-1">
                {courseNavItems.map((item) => {
                  const active = isActive(
                    item.href,
                    "activePaths" in item ? item.activePaths : undefined
                  );
                  return (
                    <Link
                      key={item.key}
                      href={`/${locale}/${item.href}`}
                      className={[
                        "block rounded-md px-3 py-2 text-sm font-medium transition",
                        active
                          ? "bg-[var(--pa-green)] text-white"
                          : "text-[var(--pa-ink)] hover:bg-[rgba(47,111,94,0.08)] hover:text-[var(--pa-green)]"
                      ].join(" ")}
                    >
                      {dictionary.nav[item.key]}
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>

          <div className="mt-6 border-t border-[var(--pa-line)] pt-4 md:mt-auto">
            <Link
              className={[
                "block rounded-md px-3 py-2 text-sm font-medium transition",
                isActive("settings")
                  ? "bg-[var(--pa-green)] text-white"
                  : "text-[var(--pa-ink)] hover:bg-[rgba(47,111,94,0.08)] hover:text-[var(--pa-green)]"
              ].join(" ")}
              href={`/${locale}/settings`}
            >
              {dictionary.nav.settings}
            </Link>
            <Link
              className={[
                "mt-1 block rounded-md px-3 py-2 text-sm font-medium transition",
                isActive("account")
                  ? "bg-[var(--pa-green)] text-white"
                  : "text-[var(--pa-ink)] hover:bg-[rgba(47,111,94,0.08)] hover:text-[var(--pa-green)]"
              ].join(" ")}
              href={`/${locale}/account`}
              onClick={() => setMobileNavOpen(false)}
            >
              {dictionary.nav.account}
            </Link>
            {currentUser?.role === "admin" ? (
              <Link
                className={[
                  "mt-1 block rounded-md px-3 py-2 text-sm font-medium transition",
                  isActive("admin")
                    ? "bg-[var(--pa-green)] text-white"
                    : "text-[var(--pa-ink)] hover:bg-[rgba(47,111,94,0.08)] hover:text-[var(--pa-green)]"
                ].join(" ")}
                href={`/${locale}/admin/users`}
                onClick={() => setMobileNavOpen(false)}
              >
                {dictionary.nav.admin}
              </Link>
            ) : null}
            <div className="mt-4 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-3">
              <p className="text-xs text-[var(--pa-muted)]">{dictionary.user.accountLabel}</p>
              <p className="mt-1 truncate text-sm font-medium text-[var(--pa-ink)]">
                {currentUser?.email ?? dictionary.user.localAccount}
              </p>
              <p className="mt-1 text-xs text-[var(--pa-muted)]">
                {currentUser ? currentUser.role : dictionary.user.localAccount}
              </p>
              <button
                className="mt-3 w-full rounded-md border border-[var(--pa-line)] px-3 py-2 text-sm text-[var(--pa-muted)]"
                type="button"
                onClick={() => {
                  void signOut();
                  setMobileNavOpen(false);
                }}
              >
                {dictionary.user.logout}
              </button>
            </div>
            <Link className="mt-3 block px-3 text-sm text-[var(--pa-muted)] hover:text-[var(--pa-ink)]" href={alternatePath}>
              {dictionary.languageSwitch}
            </Link>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-7">{children}</main>
      </div>
    </div>
  );
}
