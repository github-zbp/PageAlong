import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteChrome } from "@/components/SiteChrome";
import {
  marketingFooterLinks,
  marketingFooterNote,
  marketingHref
} from "@/lib/site";

export const metadata: Metadata = {
  title: "页相随 PageAlong",
  description: "可生成音频课程并下载的碎片化阅读器。PageAlong turns saved content into resumable audio courses."
};

type HomeLocale = "zh" | "en";

type NavLink = {
  href: string;
  label: string;
};

type HeroSignal = {
  title: string;
  body: string;
};

type HeroSceneItem = {
  title: string;
  meta: string;
  note: string;
};

type HeroSceneCopy = {
  libraryTitle: string;
  libraryCount: string;
  libraryItems: HeroSceneItem[];
  connectorLabel: string;
  playerTitle: string;
  playerTime: string;
  highlightedSentence: string;
  speed: string;
  resumable: string;
  downloadAudio: string;
  downloadText: string;
  downloadTitle: string;
  downloadBody: string;
  audioLabel: string;
  markdownLabel: string;
  wordLabel: string;
  footnote: string;
};

type FitCard = {
  title: string;
  body: string;
  progressLabel: string;
  speed: string;
  progress: string;
  sentence: string;
};

type ComparisonCell = {
  value: string;
  note?: string;
};

type ComparisonRow = {
  label: string;
  cells: ComparisonCell[];
};

type PreviewRow = {
  title: string;
  meta: string;
  badge: string;
  badgeTone?: "green" | "muted";
};

type PreviewCopy = {
  badge: string;
  library: {
    eyebrow: string;
    title: string;
    rows: PreviewRow[];
  };
  player: {
    eyebrow: string;
    title: string;
    status: string;
    time: string;
    highlightedSentence: string;
    speed: string;
    timeline: string;
    footnote: string;
  };
  download: {
    eyebrow: string;
    title: string;
    rows: PreviewRow[];
  };
};

type HomeCopy = {
  locale: HomeLocale;
  appHref: string;
  brandPrimary: string;
  brandSecondary: string;
  navLinks: NavLink[];
  primaryCta: string;
  secondaryCta: string;
  heroEyebrow: string;
  heroTitle: string;
  heroBody: string;
  heroSignals: HeroSignal[];
  heroScene: HeroSceneCopy;
  fitSection: {
    eyebrow: string;
    title: string;
    description: string;
    cards: FitCard[];
  };
  differenceSection: {
    eyebrow: string;
    title: string;
    description: string;
    columns: string[];
    rows: ComparisonRow[];
  };
  previewSection: {
    eyebrow: string;
    title: string;
    description: string;
    preview: PreviewCopy;
  };
  trialSection: {
    eyebrow: string;
    title: string;
    description: string;
    secondaryCta: string;
    secondaryCtaHref: string;
  };
  contactSection: {
    eyebrow: string;
    title: string;
    description: string;
    emailLabel: string;
    email: string;
    emailNote: string;
    qqLabel: string;
    qq: string;
    qqNote: string;
  };
};

const homeCopies: Record<HomeLocale, HomeCopy> = {
  zh: {
    locale: "zh",
    appHref: "/zh/import/text",
    brandPrimary: "页相随",
    brandSecondary: "PageAlong",
    navLinks: [
      { href: marketingHref("/guide", "zh"), label: "指南" },
      { href: marketingHref("/download", "zh"), label: "下载" },
      { href: marketingHref("/blog", "zh"), label: "博客" },
      { href: marketingHref("/story", "zh"), label: "产品故事" }
    ],
    primaryCta: "免费使用",
    secondaryCta: "看看适不适合我",
    heroEyebrow: "页相随 PageAlong",
    heroTitle: "把读不完的网页、文章和课件变成通勤也能继续听的有声课程",
    heroBody: "能自动把网页文章、文档笔记整理成可续播的课程轨迹。通勤、做饭、睡前都能继续听，生成音频后还能下载保存。",
    heroSignals: [
      {
        title: "离开屏幕后，学习还能继续。",
        body: "学习进度保存，上次停在哪里，下次就从哪里接上。"
      },
      {
        title: "收藏的内容整理到一起，不用再自己翻找。",
        body: "从碎片内容到体系化课程整理。"
      },
      {
        title: "生成音频后支持下载。",
        body: "支持把课程按PDF/Word/MP3/Markdown文件下载。"
      }
    ],
    heroScene: {
      libraryTitle: "课程库中的碎片内容",
      libraryCount: "3 条收藏",
      libraryItems: [
        {
          title: "技术博客",
          meta: "12,840 字",
          note: "最近整理 · 32 句"
        },
        {
          title: "课程笔记",
          meta: "16 句",
          note: "上次停在 08:42"
        },
        {
          title: "长文收藏",
          meta: "待生成",
          note: "今天收藏，今晚听完"
        }
      ],
      connectorLabel: "内容变声轨",
      playerTitle: "正在播放的音频课程",
      playerTime: "08:42 / 24:18",
      highlightedSentence: "当前句高亮：通勤的时候，最适合把昨晚收藏的博客重新听一遍。",
      speed: "1.25x",
      resumable: "可续播",
      downloadAudio: "下载音频",
      downloadText: "下载文稿",
      downloadTitle: "下载保存",
      downloadBody: "生成后可留存到本地，方便复听和复习。",
      audioLabel: "音频",
      markdownLabel: "Markdown",
      wordLabel: "Word",
      footnote: "内容变声轨把碎片内容连到正在播放的课程。"
    },
    fitSection: {
      eyebrow: "适合谁",
      title: "碎片时间听完而非用一整块时间读完",
      description: "不是所有学习场景都需要一整块屏幕和一张桌子，任何时间地点用零散时间把课程听完。",
      cards: [
        {
          title: "通勤路上",
          body: "昨天收藏的博客，今天路上听完。",
          progressLabel: "08:42 / 24:18",
          speed: "1.25x",
          progress: "58%",
          sentence: "当前句：把零散时间接起来，比等一整块时间更现实。"
        },
        {
          title: "做饭收拾时",
          body: "手上忙着，耳朵还能复习课程笔记。",
          progressLabel: "12:15 / 19:40",
          speed: "1.0x",
          progress: "67%",
          sentence: "当前句：现在不需要重新打开屏幕，也能接着听。"
        },
        {
          title: "睡前眼睛累了",
          body: "不再硬撑着看屏幕，切到听完最后一段。",
          progressLabel: "04:28 / 16:12",
          speed: "0.9x",
          progress: "27%",
          sentence: "当前句：最后一段内容，适合安静地收尾。"
        },
        {
          title: "碎片时间补内容",
          body: "不需要一整块时间，也能消化一篇长文。",
          progressLabel: "06:03 / 14:58",
          speed: "1.25x",
          progress: "41%",
          sentence: "当前句：先听重点，再决定要不要回看原文。"
        }
      ]
    },
    differenceSection: {
      eyebrow: "产品区别",
      title: "PageAlong 与普通阅读器、音频 App 或剪藏插件有什么区别？",
      description: "PageAlong = 阅读器 + 音频 App + 剪藏插件",
      columns: ["维度", "阅读器", "音频 App", "剪藏插件", "TTS 插件", "PageAlong"],
      rows: [
        {
          label: "能不能听",
          cells: [
            { value: "×" },
            { value: "√" },
            { value: "×" },
            { value: "√" },
            { value: "√" }
          ]
        },
        {
          label: "内容能否来源于网页或自己的文档",
          cells: [
            { value: "√" },
            { value: "×" },
            { value: "√" },
            { value: "√" },
            { value: "√" }
          ]
        },
        {
          label: "音频能否下载",
          cells: [
            { value: "×" },
            { value: "×", note: "可能需付费" },
            { value: "×" },
            { value: "×" },
            { value: "√" }
          ]
        },
        {
          label: "能否转为 PDF / Word / Markdown 格式",
          cells: [
            { value: "×", note: "可能需付费" },
            { value: "×" },
            { value: "×" },
            { value: "×" },
            { value: "√" }
          ]
        },
        {
          label: "知识管理能力",
          cells: [
            { value: "√" },
            { value: "×" },
            { value: "×" },
            { value: "×" },
            { value: "√" }
          ]
        }
      ]
    },
    previewSection: {
      eyebrow: "产品展示",
      title: "这不是概念页，界面里已经有能认出来的产品形态",
      description: "课程库、播放页和下载区分开呈现，但都围绕同一条内容变声轨展开。",
      preview: {
        badge: "真实界面",
        library: {
          eyebrow: "课程库",
          title: "把碎片内容集中起来",
          rows: [
            {
              title: "技术博客",
              meta: "12,840 字 · 32 句",
              badge: "可续播",
              badgeTone: "green"
            },
            {
              title: "课程笔记",
              meta: "16 句 · 上次更新 14:20",
              badge: "待整理"
            },
            {
              title: "长文收藏",
              meta: "今天收藏，今晚听完",
              badge: "1 篇"
            }
          ]
        },
        player: {
          eyebrow: "播放页",
          title: "当前句跟着走，像听课一样",
          status: "正在播放",
          time: "08:42 / 24:18",
          highlightedSentence: "当前句高亮：通勤的时候，最适合把昨晚收藏的博客重新听一遍。",
          speed: "1.25x",
          timeline: "句子时间轴",
          footnote: "生成后，位置、速度和当前句都能继续对上。"
        },
        download: {
          eyebrow: "下载区",
          title: "生成后保存到本地",
          rows: [
            {
              title: "音频",
              meta: "可下载保存",
              badge: "推荐",
              badgeTone: "green"
            },
            {
              title: "Markdown",
              meta: "便于继续整理",
              badge: "文稿"
            },
            {
              title: "Word / PDF",
              meta: "便于复习和留存",
              badge: "保存"
            }
          ]
        }
      }
    },
    trialSection: {
      eyebrow: "免费使用",
      title: "先把一篇读不完的文章，变成可以听的课程",
      description: "不用先整理完整学习计划。找一篇你最近收藏但一直没读完的内容，试试看它能不能变成你的下一节音频课程。",
      secondaryCta: "查看产品区别",
      secondaryCtaHref: "#difference"
    },
    contactSection: {
      eyebrow: "联系",
      title: "建议、Bug 和新功能，都可以直接发给我们",
      description: "工作台里的反馈会自动附上当前账号邮箱，方便我们回看上下文。官网也保留公开联系方式，便于快速联系。",
      emailLabel: "邮箱",
      email: "juhuatang@outlook.com",
      emailNote: "优先用于反馈、合作和问题跟进。",
      qqLabel: "QQ",
      qq: "1640632344",
      qqNote: "如果你更习惯 QQ，也可以直接联系。"
    }
  },
  en: {
    locale: "en",
    appHref: "/en/import/text",
    brandPrimary: "PageAlong",
    brandSecondary: "Turn long reads into courses that follow along.",
    navLinks: [
      { href: marketingHref("/guide", "en"), label: "Guide" },
      { href: marketingHref("/download", "en"), label: "Download" },
      { href: marketingHref("/blog", "en"), label: "Blog" },
      { href: marketingHref("/story", "en"), label: "Product Story" }
    ],
    primaryCta: "Use for free",
    secondaryCta: "See if it fits",
    heroEyebrow: "PageAlong",
    heroTitle: "A fragmented reader that turns saved content into downloadable audio courses",
    heroBody: "Turn web articles, document, and course notes into a resumable learning trail. Keep listening during commutes, chores, or late-night review, then download the audio for later.",
    heroSignals: [
      {
        title: "Learning continues after the screen is off.",
        body: "Learning progress is saved, pick up exactly where you stopped last time."
      },
      {
        title: "Saved content no longer gets buried.",
        body: "From fragments to a course trail, the path stays visible."
      },
      {
        title: "Generated courses can be downloaded.",
        body: "Keep the audio and transcript for review after listening."
      }
    ],
    heroScene: {
      libraryTitle: "Saved fragments in the course library",
      libraryCount: "3 saved items",
      libraryItems: [
        {
          title: "Technical blog",
          meta: "12,840 chars",
          note: "Recently organized · 32 sentences"
        },
        {
          title: "Course notes",
          meta: "16 sentences",
          note: "Paused at 08:42"
        },
        {
          title: "Long read",
          meta: "To generate",
          note: "Saved today, listen tonight"
        }
      ],
      connectorLabel: "Content to audio",
      playerTitle: "Audio course playing",
      playerTime: "08:42 / 24:18",
      highlightedSentence: "Highlighted sentence: The commute is the right moment to revisit the blog you saved last night.",
      speed: "1.25x",
      resumable: "Resumable",
      downloadAudio: "Download audio",
      downloadText: "Download transcript",
      downloadTitle: "Save locally",
      downloadBody: "Keep generated output on your device for replay and review.",
      audioLabel: "Audio",
      markdownLabel: "Markdown",
      wordLabel: "Word",
      footnote: "The content-to-audio trail connects saved fragments with the course currently playing."
    },
    fitSection: {
      eyebrow: "Who it fits",
      title: "Listening through small pockets of time instead of reading in one long block",
      description: "Not every learning session needs a desk, a full screen, and uninterrupted time. Any time and place can be used to finish the course in small pockets of time.",
      cards: [
        {
          title: "On the commute",
          body: "Listen to the blog you saved yesterday on today's ride.",
          progressLabel: "08:42 / 24:18",
          speed: "1.25x",
          progress: "58%",
          sentence: "Current sentence: Linking small moments is more realistic than waiting for a long block of time."
        },
        {
          title: "Cooking or cleaning",
          body: "Your hands are busy, but your ears can review course notes.",
          progressLabel: "12:15 / 19:40",
          speed: "1.0x",
          progress: "67%",
          sentence: "Current sentence: You do not need to reopen the screen to keep going."
        },
        {
          title: "Before bed",
          body: "When your eyes are tired, switch to audio for the final section.",
          progressLabel: "04:28 / 16:12",
          speed: "0.9x",
          progress: "27%",
          sentence: "Current sentence: The last section is better as a calm wrap-up."
        },
        {
          title: "Short breaks",
          body: "Digest a long article without needing a long session.",
          progressLabel: "06:03 / 14:58",
          speed: "1.25x",
          progress: "41%",
          sentence: "Current sentence: Hear the key ideas first, then decide whether to reread the original."
        }
      ]
    },
    differenceSection: {
      eyebrow: "What is different",
      title: "How is PageAlong different from a reader, an audio app, or a clipping tool?",
      description: "PageAlong = Reader + Audio app + Clipping tool",
      columns: ["Dimension", "Reader", "Audio app", "Clipping tool", "TTS plugin", "PageAlong"],
      rows: [
        {
          label: "Can you listen to it?",
          cells: [
            { value: "×" },
            { value: "√" },
            { value: "×" },
            { value: "√" },
            { value: "√" }
          ]
        },
        {
          label: "Can the content come from a web page or your own docs?",
          cells: [
            { value: "√" },
            { value: "×" },
            { value: "√" },
            { value: "√" },
            { value: "√" }
          ]
        },
        {
          label: "Can the audio be downloaded?",
          cells: [
            { value: "×" },
            { value: "×", note: "May require payment" },
            { value: "×" },
            { value: "×" },
            { value: "√" }
          ]
        },
        {
          label: "Can it be exported to PDF / Word / Markdown?",
          cells: [
            { value: "×", note: "May require payment" },
            { value: "×" },
            { value: "×" },
            { value: "×" },
            { value: "√" }
          ]
        },
        {
          label: "Does it support knowledge management?",
          cells: [
            { value: "√" },
            { value: "×" },
            { value: "×" },
            { value: "×" },
            { value: "√" }
          ]
        }
      ]
    },
    previewSection: {
      eyebrow: "Product preview",
      title: "This is not a concept page; the product shape is already visible",
      description: "The library, player, and download area are separate surfaces, all centered on one content-to-audio trail.",
      preview: {
        badge: "Real UI",
        library: {
          eyebrow: "Library",
          title: "Gather fragmented content",
          rows: [
            {
              title: "Technical blog",
              meta: "12,840 chars · 32 sentences",
              badge: "Resumable",
              badgeTone: "green"
            },
            {
              title: "Course notes",
              meta: "16 sentences · Updated 14:20",
              badge: "To organize"
            },
            {
              title: "Long read",
              meta: "Saved today, listen tonight",
              badge: "1 item"
            }
          ]
        },
        player: {
          eyebrow: "Player",
          title: "The current sentence follows along",
          status: "Now playing",
          time: "08:42 / 24:18",
          highlightedSentence: "Highlighted sentence: The commute is the right moment to revisit the blog you saved last night.",
          speed: "1.25x",
          timeline: "Sentence timeline",
          footnote: "After generation, position, speed, and highlighted sentence can stay aligned."
        },
        download: {
          eyebrow: "Downloads",
          title: "Save generated output locally",
          rows: [
            {
              title: "Audio",
              meta: "Save locally",
              badge: "Recommended",
              badgeTone: "green"
            },
            {
              title: "Markdown",
              meta: "Useful for further editing",
              badge: "Transcript"
            },
            {
              title: "Word / PDF",
              meta: "Useful for review and archiving",
              badge: "Save"
            }
          ]
        }
      }
    },
    trialSection: {
      eyebrow: "Use for free",
      title: "Start with one article you have not managed to finish",
      description: "No need to plan a full learning system first. Pick one saved piece you keep postponing and see whether it can become your next audio course.",
      secondaryCta: "See the comparison",
      secondaryCtaHref: "#difference"
    },
    contactSection: {
      eyebrow: "Contact",
      title: "Send suggestions, bugs, or feature ideas directly",
      description: "Feedback in the dashboard automatically includes your signed-in account email. The public site keeps a direct contact path here as well.",
      emailLabel: "Email",
      email: "juhuatang@outlook.com",
      emailNote: "Best for feedback, follow-up, and collaborations.",
      qqLabel: "QQ",
      qq: "1640632344",
      qqNote: "Use QQ if that is easier for you."
    }
  }
};

function normalizeHomeLocale(value: string | string[] | undefined): HomeLocale {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "en" ? "en" : "zh";
}

function SurfacePanel({
  className = "",
  children
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-medium text-[var(--pa-green)]">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold leading-tight text-[var(--pa-ink)] sm:text-3xl">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-7 text-[var(--pa-muted)] sm:text-base">{description}</p>
    </div>
  );
}

function HeroScene({ copy }: { copy: HeroSceneCopy }) {
  return (
    <div className="relative overflow-hidden rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4 shadow-[0_14px_36px_rgba(17,17,17,0.06)] sm:p-5">
      <div className="relative grid gap-4 md:grid-cols-[minmax(0,0.92fr)_3rem_minmax(0,1.08fr)] md:items-center">
        <SurfacePanel className="order-2 relative z-10 !bg-[var(--pa-surface)] w-full max-w-[94%] p-4 md:order-1 md:col-start-1 md:row-span-2 md:row-start-1 md:max-w-none">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--pa-green)]">{copy.libraryTitle}</p>
            <span className="rounded-full border border-[var(--pa-green-soft)] bg-[var(--pa-green-soft)] px-2.5 py-1 text-[11px] text-[var(--pa-green)]">
              {copy.libraryCount}
            </span>
          </div>
          <div className="mt-4 space-y-2.5">
            {copy.libraryItems.map((item) => (
              <div
                key={item.title}
                className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--pa-ink)]">{item.title}</p>
                  <span className="text-xs text-[var(--pa-muted)]">{item.meta}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--pa-muted)]">{item.note}</p>
              </div>
            ))}
          </div>
        </SurfacePanel>

        <div className="order-4 relative hidden h-full min-h-[250px] flex-col items-center justify-center gap-3 md:order-2 md:col-start-2 md:row-span-2 md:row-start-1 md:flex">
          <span className="h-3 w-3 rounded-full bg-[var(--pa-green)] ring-4 ring-[var(--pa-green-soft)]" />
          <span className="h-16 w-px bg-[var(--pa-line)]" />
          <span className="rounded-full border border-[var(--pa-green-soft)] bg-[var(--pa-green-soft)] px-2 py-3 text-[11px] font-medium text-[var(--pa-green)] [writing-mode:vertical-rl]">
            {copy.connectorLabel}
          </span>
          <span className="h-16 w-px bg-[var(--pa-line)]" />
        </div>

        <SurfacePanel className="order-1 relative z-10 ml-auto w-full max-w-[96%] p-4 md:order-3 md:col-start-3 md:row-start-1 md:max-w-none">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--pa-ink)]">{copy.playerTitle}</p>
            <span className="text-xs text-[var(--pa-muted)]">{copy.playerTime}</span>
          </div>
          <div className="mt-4 rounded-md border border-[var(--pa-amber-soft)] bg-[var(--pa-amber-soft)] p-4">
            <p className="text-sm leading-7 text-[var(--pa-ink)]">{copy.highlightedSentence}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
            <span className="inline-flex w-fit rounded-full border border-[var(--pa-amber-soft)] bg-[var(--pa-surface)] px-2.5 py-1 text-xs font-medium text-[var(--pa-amber)]">
              {copy.speed}
            </span>
            <div className="h-2 rounded-full bg-[var(--pa-amber-soft)]">
              <div className="h-full w-[64%] rounded-full bg-[var(--pa-amber)]" />
            </div>
            <span className="text-xs text-[var(--pa-muted)]">{copy.resumable}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-1 text-xs text-[var(--pa-muted)]">
              {copy.downloadAudio}
            </span>
            <span className="rounded-full border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-1 text-xs text-[var(--pa-muted)]">
              {copy.downloadText}
            </span>
          </div>
        </SurfacePanel>

        <SurfacePanel className="order-3 relative z-10 !bg-[var(--pa-surface)] w-full max-w-[88%] p-4 md:order-4 md:col-start-3 md:row-start-2 md:max-w-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--pa-ink)]">{copy.downloadTitle}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--pa-muted)]">{copy.downloadBody}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[var(--pa-green-soft)] bg-[var(--pa-green-soft)] px-3 py-1 text-xs font-medium text-[var(--pa-green)]">
                {copy.audioLabel}
              </span>
              <span className="rounded-full border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-1 text-xs text-[var(--pa-muted)]">
                {copy.markdownLabel}
              </span>
              <span className="rounded-full border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-1 text-xs text-[var(--pa-muted)]">
                {copy.wordLabel}
              </span>
            </div>
          </div>
        </SurfacePanel>
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--pa-muted)]">{copy.footnote}</p>
    </div>
  );
}

function FitSceneCard({
  title,
  body,
  progressLabel,
  speed,
  progress,
  sentence
}: FitCard) {
  return (
    <SurfacePanel className="flex min-h-[220px] flex-col p-5">
      <p className="text-sm font-medium text-[var(--pa-green)]">{title}</p>
      <p className="mt-3 text-base leading-7 text-[var(--pa-ink)]">{body}</p>
      <div className="mt-auto pt-5">
        <div className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-3">
          <div className="flex items-center justify-between gap-3 text-xs text-[var(--pa-muted)]">
            <span>{progressLabel}</span>
            <span>{speed}</span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-[var(--pa-amber-soft)]">
            <div className="h-full rounded-full bg-[var(--pa-amber)]" style={{ width: progress }} />
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--pa-muted)]">{sentence}</p>
        </div>
      </div>
    </SurfacePanel>
  );
}

function ComparisonTable({ columns, rows }: { columns: string[]; rows: ComparisonRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)]">
      <table className="min-w-[900px] w-full border-collapse">
        <thead>
          <tr className="bg-[var(--pa-muted-surface)]">
            {columns.map((column, index) => (
              <th
                key={column}
                className={[
                  "border-b border-[var(--pa-line)] px-4 py-3 text-left text-xs font-medium text-[var(--pa-muted)]",
                  index === 0 ? "w-[22rem]" : "text-center",
                  index === columns.length - 1 ? "bg-[var(--pa-green-soft)] text-[var(--pa-green)]" : ""
                ].join(" ")}
                scope="col"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="align-top">
              <th
                className="border-b border-[var(--pa-line)] px-4 py-4 text-left text-sm font-medium text-[var(--pa-ink)]"
                scope="row"
              >
                {row.label}
              </th>
              {row.cells.map((cell, index) => (
                <td
                  key={`${row.label}-${columns[index + 1] ?? index}`}
                  className={[
                    "border-b border-[var(--pa-line)] px-4 py-4 text-center text-sm text-[var(--pa-ink)]",
                    index === row.cells.length - 1 ? "bg-[var(--pa-green-soft)] font-medium" : ""
                  ].join(" ")}
                >
                  <div className="flex min-h-[3rem] flex-col items-center justify-center gap-1">
                    <span>{cell.value}</span>
                    {cell.note ? <span className="text-[11px] leading-4 text-[var(--pa-muted)]">{cell.note}</span> : null}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PreviewPanel({
  eyebrow,
  title,
  badge,
  children
}: {
  eyebrow: string;
  title: string;
  badge: string;
  children: ReactNode;
}) {
  return (
    <SurfacePanel className="min-h-[280px] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--pa-green)]">
            {eyebrow}
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--pa-ink)]">{title}</p>
        </div>
        <span className="rounded-full border border-[var(--pa-line)] bg-[var(--pa-surface)] px-2.5 py-1 text-[11px] text-[var(--pa-muted)]">
          {badge}
        </span>
      </div>
      <div className="mt-5">{children}</div>
    </SurfacePanel>
  );
}

function PreviewRowCard({ row }: { row: PreviewRow }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-[var(--pa-ink)]">{row.title}</p>
        <p className="mt-1 text-xs text-[var(--pa-muted)]">{row.meta}</p>
      </div>
      <span
        className={[
          "rounded-full border px-2.5 py-1 text-[11px]",
          row.badgeTone === "green"
            ? "border-[var(--pa-green-soft)] bg-[var(--pa-green-soft)] text-[var(--pa-green)]"
            : "border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-muted)]"
        ].join(" ")}
      >
        {row.badge}
      </span>
    </div>
  );
}

export default function HomePage({
  searchParams
}: {
  searchParams?: { lang?: string | string[] };
}) {
  const locale = normalizeHomeLocale(searchParams?.lang);
  const copy = homeCopies[locale];
  const localeLinks = {
    zh: marketingHref("/", "zh"),
    en: marketingHref("/", "en")
  } satisfies Record<HomeLocale, string>;

  return (
    <SiteChrome
      locale={locale}
      homeHref={localeLinks[locale]}
      brandPrimary={copy.brandPrimary}
      brandSecondary={copy.brandSecondary}
      navLinks={copy.navLinks}
      localeLinks={localeLinks}
      primaryCta={{ href: copy.appHref, label: copy.primaryCta }}
      footerLinks={marketingFooterLinks(locale)}
      footerNote={marketingFooterNote[locale]}
    >
      <section id="top" className="scroll-mt-24">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-10 sm:px-6 lg:px-8 lg:pb-16 lg:pt-14">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] lg:items-center">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-[var(--pa-green)]">{copy.heroEyebrow}</p>
              <h1 className="mt-4 text-4xl font-semibold leading-[1.08] text-[var(--pa-ink)] sm:text-5xl lg:text-6xl">
                {copy.heroTitle}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-[var(--pa-muted)] sm:text-lg">
                {copy.heroBody}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={copy.appHref}
                  className="pa-focus rounded-md bg-[var(--pa-green)] px-5 py-3 text-center text-sm font-medium text-white shadow-[0_8px_20px_rgba(17,17,17,0.12)]"
                >
                  {copy.primaryCta}
                </Link>
                <Link
                  href="#fit"
                  className="pa-focus rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-5 py-3 text-center text-sm font-medium text-[var(--pa-ink)]"
                >
                  {copy.secondaryCta}
                </Link>
              </div>
            </div>

            <HeroScene copy={copy.heroScene} />
          </div>

          <div className="mt-12 grid gap-3 border-t border-[var(--pa-line)] pt-5 sm:grid-cols-3">
            {copy.heroSignals.map((signal) => (
              <SurfacePanel key={signal.title} className="p-4">
                <p className="text-sm font-medium text-[var(--pa-ink)]">{signal.title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--pa-muted)]">{signal.body}</p>
              </SurfacePanel>
            ))}
          </div>
        </div>
      </section>

      <section id="fit" className="scroll-mt-24 border-t border-[var(--pa-line)]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow={copy.fitSection.eyebrow}
            title={copy.fitSection.title}
            description={copy.fitSection.description}
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {copy.fitSection.cards.map((card) => (
              <FitSceneCard key={card.title} {...card} />
            ))}
          </div>
        </div>
      </section>

      <section id="difference" className="scroll-mt-24 border-t border-[var(--pa-line)]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow={copy.differenceSection.eyebrow}
            title={copy.differenceSection.title}
            description={copy.differenceSection.description}
          />
          <div className="mt-8">
            <ComparisonTable columns={copy.differenceSection.columns} rows={copy.differenceSection.rows} />
          </div>
        </div>
      </section>

      <section id="preview" className="scroll-mt-24 border-t border-[var(--pa-line)]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow={copy.previewSection.eyebrow}
            title={copy.previewSection.title}
            description={copy.previewSection.description}
          />
          <div className="mt-8 grid gap-4 xl:grid-cols-3">
            <PreviewPanel
              eyebrow={copy.previewSection.preview.library.eyebrow}
              title={copy.previewSection.preview.library.title}
              badge={copy.previewSection.preview.badge}
            >
              <div className="space-y-2.5">
                {copy.previewSection.preview.library.rows.map((row) => (
                  <PreviewRowCard key={row.title} row={row} />
                ))}
              </div>
            </PreviewPanel>

            <PreviewPanel
              eyebrow={copy.previewSection.preview.player.eyebrow}
              title={copy.previewSection.preview.player.title}
              badge={copy.previewSection.preview.badge}
            >
              <div className="rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--pa-ink)]">
                    {copy.previewSection.preview.player.status}
                  </p>
                  <p className="text-xs text-[var(--pa-muted)]">{copy.previewSection.preview.player.time}</p>
                </div>
                <div className="mt-4 rounded-md border border-[var(--pa-amber-soft)] bg-[var(--pa-amber-soft)] p-4">
                  <p className="text-sm leading-7 text-[var(--pa-ink)]">
                    {copy.previewSection.preview.player.highlightedSentence}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[var(--pa-muted)]">
                  <span className="rounded-full border border-[var(--pa-amber-soft)] bg-[var(--pa-surface)] px-2.5 py-1 font-medium text-[var(--pa-amber)]">
                    {copy.previewSection.preview.player.speed}
                  </span>
                  <span>{copy.previewSection.preview.player.timeline}</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[var(--pa-amber-soft)]">
                  <div className="h-full w-[58%] rounded-full bg-[var(--pa-amber)]" />
                </div>
                <p className="mt-4 text-xs leading-5 text-[var(--pa-muted)]">
                  {copy.previewSection.preview.player.footnote}
                </p>
              </div>
            </PreviewPanel>

            <PreviewPanel
              eyebrow={copy.previewSection.preview.download.eyebrow}
              title={copy.previewSection.preview.download.title}
              badge={copy.previewSection.preview.badge}
            >
              <div className="space-y-2.5">
                {copy.previewSection.preview.download.rows.map((row) => (
                  <PreviewRowCard key={row.title} row={row} />
                ))}
              </div>
            </PreviewPanel>
          </div>
        </div>
      </section>

      <section id="trial" className="scroll-mt-24 border-t border-[var(--pa-line)]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-[var(--pa-green)]">{copy.trialSection.eyebrow}</p>
              <h2 className="mt-3 text-2xl font-semibold leading-tight text-[var(--pa-ink)] sm:text-3xl">
                {copy.trialSection.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--pa-muted)] sm:text-base">
                {copy.trialSection.description}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={copy.appHref}
                className="pa-focus rounded-md bg-[var(--pa-green)] px-5 py-3 text-center text-sm font-medium text-white shadow-[0_8px_20px_rgba(17,17,17,0.12)]"
              >
                {copy.primaryCta}
              </Link>
              <Link
                href={copy.trialSection.secondaryCtaHref}
                className="pa-focus rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-5 py-3 text-center text-sm font-medium text-[var(--pa-ink)]"
              >
                {copy.trialSection.secondaryCta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="scroll-mt-24 border-t border-[var(--pa-line)]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-[var(--pa-green)]">{copy.contactSection.eyebrow}</p>
              <h2 className="mt-3 text-2xl font-semibold leading-tight text-[var(--pa-ink)] sm:text-3xl">
                {copy.contactSection.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--pa-muted)] sm:text-base">
                {copy.contactSection.description}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SurfacePanel className="p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--pa-green)]">
                  {copy.contactSection.emailLabel}
                </p>
                <a
                  className="mt-3 block text-sm font-medium text-[var(--pa-ink)] transition hover:text-[var(--pa-green)]"
                  href={`mailto:${copy.contactSection.email}`}
                >
                  {copy.contactSection.email}
                </a>
                <p className="mt-2 text-xs leading-5 text-[var(--pa-muted)]">{copy.contactSection.emailNote}</p>
              </SurfacePanel>
              <SurfacePanel className="p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--pa-green)]">
                  {copy.contactSection.qqLabel}
                </p>
                <p className="mt-3 text-sm font-medium text-[var(--pa-ink)]">{copy.contactSection.qq}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--pa-muted)]">{copy.contactSection.qqNote}</p>
              </SurfacePanel>
            </div>
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
