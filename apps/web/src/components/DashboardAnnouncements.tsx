"use client";

import { useEffect, useState } from "react";
import { listDashboardAnnouncements } from "@/lib/api";
import type { AdminAnnouncementListItem } from "@/lib/types";

type Locale = "zh" | "en";

const roadmapLabels: Record<AdminAnnouncementListItem["roadmap_status"], Record<Locale, string>> = {
  planned: {
    zh: "计划中",
    en: "Planned"
  },
  in_progress: {
    zh: "进行中",
    en: "In progress"
  },
  shipped: {
    zh: "已上线",
    en: "Shipped"
  }
};

const copy: Record<Locale, { title: string }> = {
  zh: {
    title: "公告"
  },
  en: {
    title: "Announcements"
  }
};

export function DashboardAnnouncements({ locale }: { locale: Locale }) {
  const [items, setItems] = useState<AdminAnnouncementListItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAnnouncements() {
      try {
        const response = await listDashboardAnnouncements(locale);
        if (!cancelled) {
          setItems(response.items);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    void loadAnnouncements();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  if (!loaded || items.length === 0) {
    return null;
  }

  return (
    <section className="mt-5 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--pa-ink)]">{copy[locale].title}</h2>
      </div>
      <ul className="mt-3 grid gap-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-bg)] p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <h3 className="text-sm font-semibold leading-6 text-[var(--pa-ink)]">{item.title}</h3>
              <span className="inline-flex w-fit shrink-0 rounded-md border border-[var(--pa-line)] px-2 py-1 text-xs text-[var(--pa-muted)]">
                {roadmapLabels[item.roadmap_status][locale]}
              </span>
            </div>
            <p className="mt-2 text-xs text-[var(--pa-muted)]">
              {new Date(item.updated_at).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
