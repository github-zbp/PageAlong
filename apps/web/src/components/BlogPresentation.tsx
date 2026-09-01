import * as React from "react";

export type BlogCardProps = {
  href: string;
  title: string;
  summary: string;
  coverImageUrl: string;
  metaLabel: string;
  metaDateTime?: string | null;
};

export function BlogCard({ href, title, summary, coverImageUrl, metaLabel, metaDateTime }: BlogCardProps) {
  const hasCoverImage = coverImageUrl.trim().length > 0;

  return (
    <article className="overflow-hidden rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--pa-green)] hover:shadow-[0_12px_28px_rgba(17,17,17,0.05)]">
      <a className="group block h-full" href={href}>
        <div className={hasCoverImage ? "grid h-full lg:grid-cols-[minmax(0,1fr)_280px]" : "h-full"}>
          <div className="p-5 sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--pa-muted)]">
              <time dateTime={metaDateTime ?? undefined}>{metaLabel}</time>
            </p>
            <h2 className="mt-3 text-xl font-semibold leading-7 text-[var(--pa-ink)] transition group-hover:text-[var(--pa-green)]">
              {title}
            </h2>
            {summary ? <p className="mt-3 text-sm leading-7 text-[var(--pa-muted)]">{summary}</p> : null}
          </div>

          {hasCoverImage ? (
            <div className="border-t border-[var(--pa-line)] bg-[var(--pa-muted-surface)] lg:border-l lg:border-t-0">
              <div className="h-full min-h-[180px] w-full overflow-hidden">
                <img
                  alt={title}
                  className="h-full w-full object-cover"
                  decoding="async"
                  loading="lazy"
                  src={coverImageUrl}
                />
              </div>
            </div>
          ) : null}
        </div>
      </a>
    </article>
  );
}

export function BlogArticleContent({ html }: { html: string }) {
  return <div className="pa-blog-content" dangerouslySetInnerHTML={{ __html: html }} />;
}
