"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthPageShell } from "@/components/AuthPageShell";
import { confirmPasswordReset, requestPasswordResetCode } from "@/lib/api";
import { dictionaries, homepageHref, normalizeLocale, type Locale } from "@/lib/i18n";
import { importTextHref, marketingFooterLinks, marketingFooterNote, marketingNavLinks } from "@/lib/site";

export default function ForgotPasswordPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const dictionary = dictionaries[locale];
  const localeLinks = {
    zh: "/zh/forgot-password",
    en: "/en/forgot-password"
  } satisfies Record<Locale, string>;
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    setError("");
    setMessage("");
    try {
      await requestPasswordResetCode(email);
      setMessage(dictionary.auth.verificationCode);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : locale === "zh" ? "发送验证码失败" : "Failed to send code");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await confirmPasswordReset({ email, code, newPassword });
      setMessage(dictionary.auth.changePassword);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : locale === "zh" ? "重置失败" : "Reset failed");
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
      footerLinks={marketingFooterLinks(locale)}
      footerNote={marketingFooterNote[locale]}
      backHref={homepageHref(locale)}
      backLabel={dictionary.auth.backToHome}
    >
      <section className="w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-6">
        <h1 className="text-2xl font-semibold text-[var(--pa-ink)]">{dictionary.auth.forgotPasswordTitle}</h1>
        <p className="mt-2 text-sm text-[var(--pa-muted)]">{dictionary.auth.resetPrompt}</p>
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
              <span className="text-[var(--pa-muted)]">{dictionary.auth.verificationCode}</span>
              <input
                className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]"
                onChange={(event) => setCode(event.target.value)}
                value={code}
              />
            </label>
            <button
              className="pa-focus mt-7 h-11 rounded-md border border-[var(--pa-line)] px-4 text-sm text-[var(--pa-ink)]"
              onClick={() => void sendCode()}
              type="button"
            >
              {dictionary.auth.sendCode}
            </button>
          </div>
          <label className="block space-y-2 text-sm">
            <span className="text-[var(--pa-muted)]">{dictionary.auth.newPassword}</span>
            <input
              className="h-11 w-full rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 outline-none focus:border-[var(--pa-green)]"
              onChange={(event) => setNewPassword(event.target.value)}
              type="password"
              value={newPassword}
            />
          </label>
          {message ? <p className="text-sm text-[var(--pa-green)]">{message}</p> : null}
          {error ? <p className="text-sm text-[var(--pa-error)]">{error}</p> : null}
          <button
            className="pa-focus flex h-11 w-full items-center justify-center rounded-md bg-[var(--pa-green)] px-4 text-sm font-medium text-white"
            disabled={loading}
            type="submit"
          >
            {dictionary.auth.changePassword}
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
