"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearAuthToken, getCurrentUser, hasAuthToken } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

export function AuthGate({
  locale,
  children,
  fallback
}: {
  locale: string;
  children: (user: AuthUser) => ReactNode;
  fallback?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
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
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [locale, pathname, router]);

  if (isLoading || currentUser === null) {
    return fallback ?? <div className="py-10 text-sm text-neutral-500">Loading...</div>;
  }

  return <>{children(currentUser)}</>;
}
