"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { loginWithPassword } from "@/lib/api";
import { alternateLocale, dictionaries, homepageHref, normalizeLocale, type Locale } from "@/lib/i18n";

function localizedNextPath(nextPath: string | null, currentLocale: Locale, targetLocale: Locale): string {
  if (!nextPath) {
    return "";
  }
  return nextPath.replace(new RegExp(`^/${currentLocale}(?=/|$)`), `/${targetLocale}`);
}

function authSwitchHref(route: "login" | "register", locale: Locale, nextPath: string | null): string {
  const targetLocale = alternateLocale(locale);
  const params = new URLSearchParams();
  const localizedNext = localizedNextPath(nextPath, locale, targetLocale);
  if (localizedNext) {
    params.set("next", localizedNext);
  }
  const query = params.toString();
  return `/${targetLocale}/${route}${query ? `?${query}` : ""}`;
}

export default function LoginPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const dictionary = dictionaries[locale];
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || `/${locale}/dashboard`;
  const explicitNextPath = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await loginWithPassword({ email, password });
      router.replace(user.must_change_password_at_next_login ? `/${locale}/account?force-password-change=1` : nextPath);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8">
      <Link
        className="pa-focus fixed left-4 top-4 z-10 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm font-medium text-[var(--pa-muted)] shadow-sm transition hover:border-[var(--pa-green)] hover:text-[var(--pa-green)]"
        href={homepageHref(locale)}
      >
        {dictionary.auth.backToHome}
      </Link>
      <Link
        className="pa-focus fixed right-4 top-4 z-10 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2 text-sm font-medium text-[var(--pa-muted)] shadow-sm transition hover:border-[var(--pa-green)] hover:text-[var(--pa-green)]"
        href={authSwitchHref("login", locale, explicitNextPath)}
        aria-label={`Switch language: ${dictionary.languageSwitch}`}
      >
        {dictionary.languageSwitch}
      </Link>
      <section className="w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-6">
        <h1 className="text-2xl font-semibold text-[var(--pa-ink)]">{dictionary.auth.loginTitle}</h1>
        <p className="mt-2 text-sm text-[var(--pa-muted)]">{dictionary.auth.signInPrompt}</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block space-y-2 text-sm">
            <span className="text-[var(--pa-muted)]">{dictionary.auth.email}</span>
            <input
              className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span className="text-[var(--pa-muted)]">{dictionary.auth.password}</span>
            <input
              className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            className="pa-focus flex h-11 w-full items-center justify-center rounded-md bg-[var(--pa-green)] px-4 text-sm font-medium text-white"
            disabled={loading}
            type="submit"
          >
            {dictionary.user.signIn}
          </button>
        </form>
        <div className="mt-4 flex items-center justify-between text-sm">
          <Link className="text-[var(--pa-green)]" href={`/${locale}/register`}>
            {dictionary.user.signUp}
          </Link>
          <Link className="text-[var(--pa-muted)]" href={`/${locale}/forgot-password`}>
            {dictionary.auth.forgotPasswordTitle}
          </Link>
        </div>
      </section>
    </main>
  );
}
