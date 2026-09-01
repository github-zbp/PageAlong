"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthPageShell } from "@/components/AuthPageShell";
import { AuthConsentRow } from "@/components/AuthConsentRow";
import { registerWithEmail, requestEmailCode } from "@/lib/api";
import { dictionaries, homepageHref, normalizeLocale, type Locale } from "@/lib/i18n";
import { importTextHref, marketingFooterLinks, marketingFooterNote, marketingNavLinks } from "@/lib/site";

function localizedNextPath(nextPath: string | null, currentLocale: Locale, targetLocale: Locale): string {
  if (!nextPath) {
    return "";
  }
  return nextPath.replace(new RegExp(`^/${currentLocale}(?=/|$)`), `/${targetLocale}`);
}

function authLocaleHref(
  route: "login" | "register",
  currentLocale: Locale,
  targetLocale: Locale,
  nextPath: string | null
): string {
  const params = new URLSearchParams();
  const localizedNext = localizedNextPath(nextPath, currentLocale, targetLocale);
  if (localizedNext) {
    params.set("next", localizedNext);
  }
  const query = params.toString();
  return `/${targetLocale}/${route}${query ? `?${query}` : ""}`;
}

export default function RegisterPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const dictionary = dictionaries[locale];
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || `/${locale}/dashboard`;
  const explicitNextPath = searchParams.get("next");
  const localeLinks = {
    zh: authLocaleHref("register", locale, "zh", explicitNextPath),
    en: authLocaleHref("register", locale, "en", explicitNextPath)
  } satisfies Record<Locale, string>;
  const footerLinks = marketingFooterLinks(locale);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [consented, setConsented] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);

  useEffect(() => {
    if (codeCooldown <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setCodeCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [codeCooldown]);

  async function sendCode() {
    setError("");
    setMessage("");
    if (!consented) {
      setError(dictionary.auth.consentRequired);
      return;
    }
    try {
      await requestEmailCode({ email, purpose: "register" });
      setMessage(dictionary.auth.codeSentNotice);
      setCodeCooldown(60);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : locale === "zh" ? "发送验证码失败" : "Failed to send code");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!consented) {
      setError(dictionary.auth.consentRequired);
      return;
    }
    setLoading(true);
    try {
      await registerWithEmail({ email, password, code });
      router.replace(nextPath);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : locale === "zh" ? "注册失败" : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageShell
      locale={locale}
      homeHref={homepageHref(locale)}
      brandPrimary={dictionary.brand}
      brandSecondary={dictionary.brandSubtitle}
      navLinks={marketingNavLinks(locale)}
      localeLinks={localeLinks}
      primaryCta={{ href: importTextHref(locale), label: locale === "zh" ? "免费使用" : "Use for free" }}
      footerLinks={footerLinks}
      footerNote={marketingFooterNote[locale]}
      backHref={homepageHref(locale)}
      backLabel={dictionary.auth.backToHome}
    >
      <section className="w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-6">
        <h1 className="text-2xl font-semibold text-[var(--pa-ink)]">{dictionary.auth.registerTitle}</h1>
        <p className="mt-2 text-sm text-[var(--pa-muted)]">{dictionary.auth.registerPrompt}</p>
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
          <div className="flex gap-2">
            <label className="block flex-1 space-y-2 text-sm">
              <span className="text-[var(--pa-muted)]">{dictionary.auth.password}</span>
              <input
                className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            <button
              className="pa-focus mt-7 h-11 rounded-md border border-[var(--pa-line)] px-4 text-sm text-[var(--pa-ink)]"
              disabled={codeCooldown > 0 || !email}
              onClick={() => void sendCode()}
              type="button"
            >
              {codeCooldown > 0 ? `${dictionary.auth.resendCode} (${codeCooldown})` : dictionary.auth.sendCode}
            </button>
          </div>
          <label className="block space-y-2 text-sm">
            <span className="text-[var(--pa-muted)]">{dictionary.auth.verificationCode}</span>
            <input
              className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]"
              onChange={(event) => setCode(event.target.value)}
              value={code}
            />
          </label>
          <AuthConsentRow checked={consented} label={dictionary.auth.consentLabel} links={footerLinks} onChange={setConsented} />
          {message ? <p className="text-sm text-[var(--pa-green)]">{message}</p> : null}
          {error ? <p className="text-sm text-[var(--pa-error)]">{error}</p> : null}
          <button
            className="pa-focus flex h-11 w-full items-center justify-center rounded-md bg-[var(--pa-green)] px-4 text-sm font-medium text-white"
            disabled={loading}
            type="submit"
          >
            {dictionary.user.signUp}
          </button>
        </form>
        <div className="mt-4 text-sm">
          <Link className="text-[var(--pa-muted)]" href={`/${locale}/login`}>
            {dictionary.user.signIn}
          </Link>
        </div>
      </section>
    </AuthPageShell>
  );
}
