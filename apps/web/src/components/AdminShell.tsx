"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { clearAuthToken, getCurrentUser, hasAuthToken, logoutCurrentSession } from "@/lib/api";
import type { AuthUser } from "@/lib/types";
import { ClipboardIcon, FileIcon, LogoutIcon, PageAlongMarkIcon, ShieldIcon, UserIcon } from "./UiIcons";

const navItems: Array<{
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { href: "/reader_admin/users", label: "用户管理", icon: UserIcon },
  { href: "/reader_admin/blogs", label: "博客管理", icon: FileIcon },
  { href: "/reader_admin/courses", label: "课程管理", icon: ClipboardIcon },
  { href: "/reader_admin/announcements", label: "公告板", icon: ShieldIcon }
];

function AdminNavLink({
  active,
  href,
  icon: Icon,
  label
}: {
  active: boolean;
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      className={[
        "pa-focus flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-[var(--pa-green)] text-white"
          : "text-[var(--pa-ink)] hover:bg-[var(--pa-green-soft)] hover:text-[var(--pa-green)]"
      ].join(" ")}
      href={href}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hasAuthToken()) {
        router.replace(`/zh/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      try {
        const current = await getCurrentUser();
        if (cancelled) {
          return;
        }
        if (current.role !== "admin") {
          setDenied(true);
          return;
        }
        setUser(current);
      } catch {
        clearAuthToken();
        router.replace(`/zh/login?next=${encodeURIComponent(pathname)}`);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  async function signOut() {
    await logoutCurrentSession().catch(() => clearAuthToken());
    clearAuthToken();
    router.replace("/zh/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--pa-bg)] text-sm text-[var(--pa-muted)]">
        加载中
      </div>
    );
  }

  if (denied) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--pa-bg)] px-4 text-sm text-[var(--pa-error)]">
        需要管理员权限
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--pa-bg)] text-[var(--pa-ink)]">
      <header className="border-b border-[var(--pa-line)] bg-[var(--pa-surface)] px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link className="pa-focus flex min-w-0 items-center gap-2 rounded-md" href="/reader_admin/users">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--pa-line)] bg-[var(--pa-bg)] text-[var(--pa-green)]">
              <PageAlongMarkIcon className="h-4 w-4" />
            </span>
            <span className="truncate text-base font-semibold">PageAlong Admin</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="max-w-[220px] truncate text-[var(--pa-muted)]">{user?.email}</span>
            <Link className="pa-focus rounded-md border border-[var(--pa-line)] px-3 py-1.5" href="/zh/dashboard">
              返回工作台
            </Link>
            <button
              className="pa-focus inline-flex items-center gap-1.5 rounded-md border border-[var(--pa-line)] px-3 py-1.5"
              onClick={signOut}
              type="button"
            >
              <LogoutIcon className="h-4 w-4" />
              退出
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 md:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Reader admin" className="flex gap-2 overflow-x-auto border-b border-[var(--pa-line)] pb-3 md:block md:space-y-1 md:border-b-0 md:pb-0">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return <AdminNavLink key={item.href} active={active} href={item.href} icon={item.icon} label={item.label} />;
          })}
        </nav>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
