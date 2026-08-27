"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { clearAuthToken, getCurrentThemePreferences, getCurrentUser, hasAuthToken, logoutCurrentSession } from "@/lib/api";
import { alternateLocale, dictionaries, type Locale } from "@/lib/i18n";
import { readConsoleShellPreferences, updateConsoleShellPreferences } from "@/lib/console-shell-preferences";
import type { AuthUser } from "@/lib/types";
import { writeThemePreferences } from "@/lib/theme-preferences";
import { FeedbackPanel } from "./FeedbackPanel";
import {
  ArrowRightIcon,
  ClipboardIcon,
  DashboardIcon,
  FeedbackIcon,
  GlobeIcon,
  ImportIcon,
  LibraryIcon,
  LogoutIcon,
  PageAlongMarkIcon,
  SeriesIcon,
  SettingsIcon,
  ShieldIcon,
  TagIcon,
  UserIcon
} from "./UiIcons";

const courseNavItems = [
  { key: "seriesCourses", href: "series", icon: SeriesIcon },
  { key: "fragmentedCourses", href: "library", activePaths: ["library", "courses"], icon: LibraryIcon },
  { key: "courseImport", href: "import", icon: ImportIcon },
  { key: "downloadTasks", href: "jobs", activePaths: ["jobs"], icon: ClipboardIcon },
  { key: "tagManagement", href: "tags", icon: TagIcon }
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

function SidebarLink({
  active,
  collapsed,
  icon,
  href,
  label,
  onClick
}: {
  active: boolean;
  collapsed: boolean;
  icon: ReactNode;
  href: string;
  label: string;
  onClick?: () => void;
}) {
  const activeClass = collapsed
    ? active
      ? "border-[var(--pa-green)] bg-[var(--pa-green)] text-white"
      : "border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-ink)] hover:border-[var(--pa-green)]"
    : active
      ? "bg-[var(--pa-green)] text-white"
      : "text-[var(--pa-ink)] hover:bg-[var(--pa-green-soft)] hover:text-[var(--pa-green)]";

  return (
    <Link
      aria-label={label}
      className={[
        "transition",
        collapsed
          ? "flex h-10 w-10 items-center justify-center rounded-md border text-sm font-semibold"
          : "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
        activeClass
      ].join(" ")}
      href={href}
      onClick={onClick}
      title={label}
    >
      {collapsed ? (
        <span className="inline-flex h-4 w-4 items-center justify-center">{icon}</span>
      ) : (
        <>
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>
          <span className="truncate">{label}</span>
        </>
      )}
    </Link>
  );
}

function SidebarAction({
  collapsed,
  description,
  icon,
  label,
  onClick
}: {
  collapsed: boolean;
  description?: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={[
        "pa-focus transition",
        collapsed
          ? "flex h-10 w-10 items-center justify-center rounded-md border border-[var(--pa-green-soft)] bg-[var(--pa-green-soft)] text-[var(--pa-green)] hover:border-[var(--pa-green)]"
          : "flex w-full items-start gap-2 rounded-md border border-[var(--pa-green-soft)] bg-[var(--pa-green-soft)] px-3 py-2.5 text-left text-sm font-medium text-[var(--pa-ink)] hover:border-[var(--pa-green)] hover:text-[var(--pa-green)]"
      ].join(" ")}
      onClick={onClick}
      title={label}
      type="button"
    >
      {collapsed ? (
        <span className="inline-flex h-4 w-4 items-center justify-center">{icon}</span>
      ) : (
        <>
          <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block">{label}</span>
            {description ? <span className="mt-1 block text-xs font-normal leading-5 text-[var(--pa-muted)]">{description}</span> : null}
          </span>
        </>
      )}
    </button>
  );
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
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(() => readConsoleShellPreferences().sidebarCollapsed);
  const [isFeedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    setSearchValue(searchParams.get("query") ?? "");
  }, [searchParams]);

  useEffect(() => {
    updateConsoleShellPreferences({ sidebarCollapsed: isSidebarCollapsed });
  }, [isSidebarCollapsed]);

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

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;

    async function loadPreferences() {
      try {
        const preferences = await getCurrentThemePreferences();
        if (!cancelled) {
          writeThemePreferences(preferences);
        }
      } catch {
        // Keep the locally available theme if the preference request fails.
      }
    }

    void loadPreferences();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchValue.trim();
    const nextPath = query ? `/${locale}/library?query=${encodeURIComponent(query)}` : `/${locale}/library`;
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

  function openFeedbackPanel() {
    setFeedbackOpen(true);
    setMobileNavOpen(false);
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
                className="h-10 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 text-sm outline-none transition placeholder:text-[var(--pa-muted)] focus:border-[var(--pa-green)]"
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
                    : "text-[var(--pa-ink)] hover:bg-[var(--pa-green-soft)] hover:text-[var(--pa-green)]"
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
                    const active = isActive(item.href, "activePaths" in item ? item.activePaths : undefined);
                    return (
                      <Link
                        key={item.key}
                        href={`/${locale}/${item.href}`}
                        onClick={() => setMobileNavOpen(false)}
                        className={[
                          "block rounded-md px-3 py-2 text-sm font-medium transition",
                          active
                            ? "bg-[var(--pa-green)] text-white"
                            : "text-[var(--pa-ink)] hover:bg-[var(--pa-green-soft)] hover:text-[var(--pa-green)]"
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
                    : "text-[var(--pa-ink)] hover:bg-[var(--pa-green-soft)] hover:text-[var(--pa-green)]"
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
                    : "text-[var(--pa-ink)] hover:bg-[var(--pa-green-soft)] hover:text-[var(--pa-green)]"
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
                      : "text-[var(--pa-ink)] hover:bg-[var(--pa-green-soft)] hover:text-[var(--pa-green)]"
                  ].join(" ")}
                  href={`/${locale}/admin/users`}
                  onClick={() => setMobileNavOpen(false)}
                  >
                  {dictionary.nav.admin}
                </Link>
              ) : null}
              <div className="pt-1">
                <SidebarAction
                  collapsed={false}
                  description={dictionary.feedback.sidebarHint}
                  icon={<FeedbackIcon className="h-4 w-4" />}
                  label={dictionary.nav.feedback}
                  onClick={openFeedbackPanel}
                />
              </div>
            </nav>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-screen w-full flex-col md:flex-row">
        <aside
          aria-label="Primary"
          data-collapsed={isSidebarCollapsed}
          className={[
            "relative hidden min-h-screen border-b border-[var(--pa-line)] bg-[var(--pa-muted-surface)] md:flex md:flex-col md:border-b-0 md:border-r md:transition-[width] md:duration-200",
            isSidebarCollapsed ? "md:w-20" : "md:w-72"
          ].join(" ")}
        >
          <button
            aria-label={isSidebarCollapsed ? dictionary.shell.expandSidebar : dictionary.shell.collapseSidebar}
            className="pa-focus absolute right-0 top-6 inline-flex h-8 w-8 translate-x-1/2 items-center justify-center rounded-full border border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-ink)] shadow-sm"
            onClick={() => setSidebarCollapsed((value) => !value)}
            title={isSidebarCollapsed ? dictionary.shell.expandSidebar : dictionary.shell.collapseSidebar}
            type="button"
          >
            <ArrowRightIcon className={["h-4 w-4 transition-transform", isSidebarCollapsed ? "" : "rotate-180"].join(" ")} />
          </button>

          <div className={isSidebarCollapsed ? "flex flex-1 flex-col items-center px-2 py-4" : "flex flex-1 flex-col px-4 py-4"}>
            <Link
              href={`/${locale}/dashboard`}
              aria-label={dictionary.brand}
              className={isSidebarCollapsed ? "inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-ink)]" : "block"}
              title={dictionary.brand}
            >
              {isSidebarCollapsed ? (
                <PageAlongMarkIcon className="h-5 w-5" />
              ) : (
                <>
                  <p className="text-lg font-semibold tracking-normal">{dictionary.brand}</p>
                  <p className="mt-1 max-w-44 text-xs leading-5 text-[var(--pa-muted)]">{dictionary.brandSubtitle}</p>
                </>
              )}
            </Link>

            {!isSidebarCollapsed ? (
              <form className="mt-5" role="search" onSubmit={submitSearch}>
                <input
                  aria-label={dictionary.search.placeholder}
                  className="h-10 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 text-sm outline-none transition placeholder:text-[var(--pa-muted)] focus:border-[var(--pa-green)]"
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder={dictionary.search.placeholder}
                  type="search"
                  value={searchValue}
                />
              </form>
            ) : null}

            <nav className={isSidebarCollapsed ? "mt-5 flex flex-1 flex-col items-center gap-2" : "mt-5 flex flex-col gap-5"} aria-label="Primary">
              <SidebarLink
                active={isActive("dashboard")}
                collapsed={isSidebarCollapsed}
                href={`/${locale}/dashboard`}
                icon={<DashboardIcon className="h-4 w-4" />}
                label={dictionary.nav.dashboard}
              />

              <div className={isSidebarCollapsed ? "flex flex-col items-center gap-2" : ""}>
                {!isSidebarCollapsed ? (
                  <p className="px-3 text-xs font-semibold uppercase tracking-normal text-[var(--pa-muted)]">
                    {dictionary.nav.myCourses}
                  </p>
                ) : null}
                <div className={isSidebarCollapsed ? "flex flex-col items-center gap-2" : "mt-2 flex flex-col gap-1"}>
                  {courseNavItems.map((item) => {
                    const ItemIcon = item.icon;
                    const active = isActive(item.href, "activePaths" in item ? item.activePaths : undefined);
                    return (
                      <SidebarLink
                        active={active}
                        collapsed={isSidebarCollapsed}
                        href={`/${locale}/${item.href}`}
                        icon={<ItemIcon className="h-4 w-4" />}
                        key={item.key}
                        label={dictionary.nav[item.key]}
                      />
                    );
                  })}
                </div>
              </div>
            </nav>

            {isSidebarCollapsed ? (
              <div className="mt-auto flex flex-col items-center gap-2 border-t border-[var(--pa-line)] pt-4">
                <SidebarAction
                  collapsed
                  icon={<FeedbackIcon className="h-4 w-4" />}
                  label={dictionary.nav.feedback}
                  onClick={openFeedbackPanel}
                />
                <Link
                  aria-label={dictionary.nav.settings}
                  className={[
                    "inline-flex h-10 w-10 items-center justify-center rounded-md border transition",
                    isActive("settings")
                      ? "border-[var(--pa-green)] bg-[var(--pa-green)] text-white"
                      : "border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-ink)]"
                  ].join(" ")}
                  href={`/${locale}/settings`}
                  title={dictionary.nav.settings}
                >
                  <SettingsIcon className="h-4 w-4" />
                </Link>
                <Link
                  aria-label={dictionary.nav.account}
                  className={[
                    "inline-flex h-10 w-10 items-center justify-center rounded-md border transition",
                    isActive("account")
                      ? "border-[var(--pa-green)] bg-[var(--pa-green)] text-white"
                      : "border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-ink)]"
                  ].join(" ")}
                  href={`/${locale}/account`}
                  title={dictionary.nav.account}
                >
                  <UserIcon className="h-4 w-4" />
                </Link>
                {currentUser?.role === "admin" ? (
                  <Link
                    aria-label={dictionary.nav.admin}
                    className={[
                      "inline-flex h-10 w-10 items-center justify-center rounded-md border transition",
                      isActive("admin")
                        ? "border-[var(--pa-green)] bg-[var(--pa-green)] text-white"
                        : "border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-ink)]"
                    ].join(" ")}
                    href={`/${locale}/admin/users`}
                    title={dictionary.nav.admin}
                  >
                    <ShieldIcon className="h-4 w-4" />
                  </Link>
                ) : null}
                <Link
                  aria-label={dictionary.languageSwitch}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-ink)]"
                  href={alternatePath}
                  title={dictionary.languageSwitch}
                >
                  <GlobeIcon className="h-4 w-4" />
                </Link>
                <button
                  aria-label={dictionary.user.logout}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-ink)]"
                  onClick={() => {
                    void signOut();
                  }}
                  title={dictionary.user.logout}
                  type="button"
                >
                  <LogoutIcon className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="mt-6 border-t border-[var(--pa-line)] pt-4 md:mt-auto">
                <div className="mb-3">
                  <SidebarAction
                    collapsed={false}
                    description={dictionary.feedback.sidebarHint}
                    icon={<FeedbackIcon className="h-4 w-4" />}
                    label={dictionary.nav.feedback}
                    onClick={openFeedbackPanel}
                  />
                </div>
                <Link
                  className={[
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
                    isActive("settings")
                      ? "bg-[var(--pa-green)] text-white"
                      : "text-[var(--pa-ink)] hover:bg-[var(--pa-green-soft)] hover:text-[var(--pa-green)]"
                  ].join(" ")}
                  href={`/${locale}/settings`}
                >
                  <SettingsIcon className="h-4 w-4" />
                  <span>{dictionary.nav.settings}</span>
                </Link>
                <Link
                  className={[
                    "mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
                    isActive("account")
                      ? "bg-[var(--pa-green)] text-white"
                      : "text-[var(--pa-ink)] hover:bg-[var(--pa-green-soft)] hover:text-[var(--pa-green)]"
                  ].join(" ")}
                  href={`/${locale}/account`}
                  onClick={() => setMobileNavOpen(false)}
                >
                  <UserIcon className="h-4 w-4" />
                  <span>{dictionary.nav.account}</span>
                </Link>
                {currentUser?.role === "admin" ? (
                  <Link
                    className={[
                      "mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
                      isActive("admin")
                        ? "bg-[var(--pa-green)] text-white"
                        : "text-[var(--pa-ink)] hover:bg-[var(--pa-green-soft)] hover:text-[var(--pa-green)]"
                    ].join(" ")}
                    href={`/${locale}/admin/users`}
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <ShieldIcon className="h-4 w-4" />
                    <span>{dictionary.nav.admin}</span>
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
                <Link
                  className="mt-3 flex items-center gap-2 px-3 text-sm text-[var(--pa-muted)] hover:text-[var(--pa-ink)]"
                  href={alternatePath}
                >
                  <GlobeIcon className="h-4 w-4" />
                  <span>{dictionary.languageSwitch}</span>
                </Link>
              </div>
            )}
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-7">{children}</main>
      </div>
      <FeedbackPanel
        currentEmail={currentUser.email}
        currentPath={pathname}
        dictionary={dictionary}
        onClose={() => setFeedbackOpen(false)}
        open={isFeedbackOpen}
      />
    </div>
  );
}
