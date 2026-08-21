import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

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

type ComparisonCardData = {
  title: string;
  body: string;
  note: string;
  featured?: boolean;
};

type StepCardData = {
  index: string;
  title: string;
  body: string;
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
  switchLabel: string;
  switchHref: string;
  appHref: string;
  brandPrimary: string;
  brandSecondary: string;
  navAria: string;
  mobileNavAria: string;
  navLinks: NavLink[];
  primaryCta: string;
  secondaryCta: string;
  heroEyebrow: string;
  heroTitle: string;
  heroBody: string;
  heroPills: string[];
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
    cards: ComparisonCardData[];
  };
  howSection: {
    eyebrow: string;
    title: string;
    description: string;
    steps: StepCardData[];
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
    note: string;
    secondaryCta: string;
  };
};

const homeCopies: Record<HomeLocale, HomeCopy> = {
  zh: {
    locale: "zh",
    switchLabel: "English",
    switchHref: "/?lang=en",
    appHref: "/zh/import/text",
    brandPrimary: "页相随",
    brandSecondary: "PageAlong",
    navAria: "Primary",
    mobileNavAria: "Primary mobile",
    navLinks: [
      { href: "#fit", label: "适合谁" },
      { href: "#difference", label: "产品区别" },
      { href: "#how", label: "怎么生成" },
      { href: "#trial", label: "免费试用" }
    ],
    primaryCta: "免费试用",
    secondaryCta: "看看适不适合我",
    heroEyebrow: "页相随 PageAlong",
    heroTitle: "把读不完的网页/文章/文档变成通勤也能听的有声课程",
    heroBody: "把网页文章、博客干货、课程笔记整理成可续播的课程轨迹。通勤、做饭、睡前都能继续听，生成后还能下载保存。",
    heroPills: ["当前可试用文本导入", "生成后可下载", "中文优先"],
    heroSignals: [
      {
        title: "离开屏幕后，学习还能继续。",
        body: "上次停在哪里，下次就从哪里接上。"
      },
      {
        title: "收藏的内容，不用再自己翻找。",
        body: "从碎片内容到课程轨迹，一条线就能看懂。"
      },
      {
        title: "生成后支持下载保存。",
        body: "听完之后，还能留在本地继续复习。"
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
      title: "把内容听完，通常发生在这些时刻",
      description: "不是所有学习场景都需要一整块屏幕和一张桌子。这个产品更像是把零散时间接起来。",
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
      title: "为什么不是普通阅读器、音频 App 或剪藏插件？",
      description: "前面三类工具各自解决了一段问题，但没有把收藏内容真正接到可续播、可下载的学习流程里。",
      cards: [
        {
          title: "阅读器",
          body: "适合认真看，但离开屏幕就中断。",
          note: "只覆盖自己擅长的那一段。"
        },
        {
          title: "音频 App",
          body: "适合听体系化课程，但内容不是你自己收藏的。",
          note: "只覆盖自己擅长的那一段。"
        },
        {
          title: "剪藏插件",
          body: "适合保存网页，但保存后还是要自己读。",
          note: "只覆盖自己擅长的那一段。"
        },
        {
          title: "PageAlong",
          body: "把你收藏的碎片内容生成音频课程，还能续播和下载。",
          note: "补上从收藏到可听的中间一步。",
          featured: true
        }
      ]
    },
    howSection: {
      eyebrow: "怎么生成",
      title: "把碎片内容变成课程轨迹，只需要四步",
      description: "只有确实按顺序发生的内容才用编号。这里的重点不是流程本身，而是内容如何被整理成一条可继续听的轨迹。",
      steps: [
        {
          index: "01",
          title: "粘贴或导入内容",
          body: "从文章、博客或课程笔记开始。"
        },
        {
          index: "02",
          title: "整理成课程记录",
          body: "先把标题、段落和顺序排好。"
        },
        {
          index: "03",
          title: "生成句子时间轴",
          body: "进入音频生成流程，准备续播和定位。"
        },
        {
          index: "04",
          title: "续播、复听、下载保存",
          body: "完成后随时回听或留存。"
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
              meta: "生成后可下载",
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
      eyebrow: "免费试用",
      title: "先把一篇读不完的文章，变成可以听的课程",
      description: "不用先整理完整学习计划。找一篇你最近收藏但一直没读完的内容，试试看它能不能变成你的下一节音频课程。",
      note: "当前先体验文本导入流程，生成完成后支持下载保存。",
      secondaryCta: "了解怎么生成"
    }
  },
  en: {
    locale: "en",
    switchLabel: "中文",
    switchHref: "/?lang=zh",
    appHref: "/en/import/text",
    brandPrimary: "PageAlong",
    brandSecondary: "页相随",
    navAria: "Primary",
    mobileNavAria: "Primary mobile",
    navLinks: [
      { href: "#fit", label: "Who it fits" },
      { href: "#difference", label: "What is different" },
      { href: "#how", label: "How it works" },
      { href: "#trial", label: "Free trial" }
    ],
    primaryCta: "Start free",
    secondaryCta: "See if it fits",
    heroEyebrow: "PageAlong",
    heroTitle: "Make your reading list listenable",
    heroBody: "Turn web articles, practical blog posts, and course notes into a resumable learning trail. Keep listening during commutes, chores, or late-night review, then download the finished course for later.",
    heroPills: ["Text import available now", "Download after generation", "Built for mobile learning"],
    heroSignals: [
      {
        title: "Learning continues after the screen is off.",
        body: "Pick up exactly where you stopped last time."
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
      title: "Finishing content usually happens in moments like these",
      description: "Not every learning session needs a desk, a full screen, and uninterrupted time. PageAlong is built to connect small pockets of time.",
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
      title: "Why not just use a reader, audio app, or clipping tool?",
      description: "Those tools each solve one part of the problem, but they do not connect saved content to a resumable, downloadable learning flow.",
      cards: [
        {
          title: "Reader",
          body: "Good for focused reading, but learning stops when you leave the screen.",
          note: "It covers the part it is best at."
        },
        {
          title: "Audio app",
          body: "Good for structured courses, but the content is not what you personally saved.",
          note: "It covers the part it is best at."
        },
        {
          title: "Clipping tool",
          body: "Good for saving pages, but saved pages still wait for you to read them.",
          note: "It covers the part it is best at."
        },
        {
          title: "PageAlong",
          body: "Turns your saved fragments into audio courses with resume and download support.",
          note: "It fills the missing step between saving and listening.",
          featured: true
        }
      ]
    },
    howSection: {
      eyebrow: "How it works",
      title: "Turn fragments into a course trail in four steps",
      description: "Numbered steps are used only where the sequence matters. The point is how content becomes a trail you can keep listening to.",
      steps: [
        {
          index: "01",
          title: "Paste or import content",
          body: "Start from an article, blog post, or course note."
        },
        {
          index: "02",
          title: "Organize it as a course record",
          body: "Keep title, sections, and order in a clear structure."
        },
        {
          index: "03",
          title: "Generate a sentence timeline",
          body: "Prepare the audio flow for resume and sentence-level positioning."
        },
        {
          index: "04",
          title: "Resume, replay, and download",
          body: "Come back any time or keep the finished output locally."
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
              meta: "Download after generation",
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
      eyebrow: "Free trial",
      title: "Start with one article you have not managed to finish",
      description: "No need to plan a full learning system first. Pick one saved piece you keep postponing and see whether it can become your next audio course.",
      note: "The current trial focuses on text import. Generated output can be downloaded after completion.",
      secondaryCta: "Learn how it works"
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
    <div className="relative overflow-hidden rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4 shadow-[0_14px_36px_rgba(31,26,20,0.06)] sm:p-5">
      <div className="relative grid gap-4 md:grid-cols-[minmax(0,0.92fr)_3rem_minmax(0,1.08fr)] md:items-center">
        <SurfacePanel className="order-2 relative z-10 !bg-[#fcfaf5] w-full max-w-[94%] p-4 md:order-1 md:col-start-1 md:row-span-2 md:row-start-1 md:max-w-none">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--pa-green)]">{copy.libraryTitle}</p>
            <span className="rounded-full border border-[rgba(47,111,94,0.18)] bg-[rgba(223,236,230,0.7)] px-2.5 py-1 text-[11px] text-[var(--pa-green)]">
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
          <span className="rounded-full border border-[rgba(47,111,94,0.2)] bg-[rgba(223,236,230,0.82)] px-2 py-3 text-[11px] font-medium text-[var(--pa-green)] [writing-mode:vertical-rl]">
            {copy.connectorLabel}
          </span>
          <span className="h-16 w-px bg-[var(--pa-line)]" />
        </div>

        <SurfacePanel className="order-1 relative z-10 ml-auto w-full max-w-[96%] p-4 md:order-3 md:col-start-3 md:row-start-1 md:max-w-none">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--pa-ink)]">{copy.playerTitle}</p>
            <span className="text-xs text-[var(--pa-muted)]">{copy.playerTime}</span>
          </div>
          <div className="mt-4 rounded-md border border-[rgba(201,138,46,0.16)] bg-[var(--pa-amber-soft)] p-4">
            <p className="text-sm leading-7 text-[var(--pa-ink)]">{copy.highlightedSentence}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
            <span className="inline-flex w-fit rounded-full border border-[rgba(201,138,46,0.18)] bg-[rgba(255,255,255,0.78)] px-2.5 py-1 text-xs font-medium text-[var(--pa-amber)]">
              {copy.speed}
            </span>
            <div className="h-2 rounded-full bg-[rgba(201,138,46,0.16)]">
              <div className="h-full w-[64%] rounded-full bg-[var(--pa-amber)]" />
            </div>
            <span className="text-xs text-[var(--pa-muted)]">{copy.resumable}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-[rgba(221,210,193,0.9)] bg-[rgba(255,253,248,0.92)] px-3 py-1 text-xs text-[var(--pa-muted)]">
              {copy.downloadAudio}
            </span>
            <span className="rounded-full border border-[rgba(221,210,193,0.9)] bg-[rgba(255,253,248,0.92)] px-3 py-1 text-xs text-[var(--pa-muted)]">
              {copy.downloadText}
            </span>
          </div>
        </SurfacePanel>

        <SurfacePanel className="order-3 relative z-10 !bg-[#fcfaf5] w-full max-w-[88%] p-4 md:order-4 md:col-start-3 md:row-start-2 md:max-w-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--pa-ink)]">{copy.downloadTitle}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--pa-muted)]">{copy.downloadBody}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[rgba(47,111,94,0.22)] bg-[rgba(223,236,230,0.85)] px-3 py-1 text-xs font-medium text-[var(--pa-green)]">
                {copy.audioLabel}
              </span>
              <span className="rounded-full border border-[var(--pa-line)] bg-[rgba(255,253,248,0.9)] px-3 py-1 text-xs text-[var(--pa-muted)]">
                {copy.markdownLabel}
              </span>
              <span className="rounded-full border border-[var(--pa-line)] bg-[rgba(255,253,248,0.9)] px-3 py-1 text-xs text-[var(--pa-muted)]">
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
        <div className="rounded-md border border-[var(--pa-line)] bg-[#fcfaf5] p-3">
          <div className="flex items-center justify-between gap-3 text-xs text-[var(--pa-muted)]">
            <span>{progressLabel}</span>
            <span>{speed}</span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-[rgba(201,138,46,0.16)]">
            <div className="h-full rounded-full bg-[var(--pa-amber)]" style={{ width: progress }} />
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--pa-muted)]">{sentence}</p>
        </div>
      </div>
    </SurfacePanel>
  );
}

function ComparisonCard({ title, body, note, featured = false }: ComparisonCardData) {
  return (
    <SurfacePanel
      className={[
        "min-h-[180px] p-5",
        featured
          ? "!border-[rgba(47,111,94,0.28)] !bg-[rgba(223,236,230,0.22)] shadow-[0_12px_30px_rgba(47,111,94,0.08)]"
          : "bg-[#fcfaf5]"
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-semibold text-[var(--pa-ink)]">{title}</p>
        {featured ? (
          <span className="rounded-full border border-[rgba(47,111,94,0.2)] bg-[rgba(223,236,230,0.86)] px-2.5 py-1 text-[11px] font-medium text-[var(--pa-green)]">
            PageAlong
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-sm leading-7 text-[var(--pa-muted)]">{body}</p>
      {featured ? (
        <div className="mt-5 h-px bg-[rgba(47,111,94,0.18)]" />
      ) : (
        <div className="mt-5 h-px bg-[rgba(221,210,193,0.65)]" />
      )}
      <p className="mt-4 text-xs leading-5 text-[var(--pa-muted)]">{note}</p>
    </SurfacePanel>
  );
}

function StepCard({ index, title, body }: StepCardData) {
  return (
    <SurfacePanel className="min-h-[200px] p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgba(47,111,94,0.2)] bg-[rgba(223,236,230,0.78)] text-sm font-semibold text-[var(--pa-green)]">
          {index}
        </span>
        <div className="min-w-0">
          <p className="text-base font-semibold text-[var(--pa-ink)]">{title}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--pa-muted)]">{body}</p>
        </div>
      </div>
    </SurfacePanel>
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
        <span className="rounded-full border border-[var(--pa-line)] bg-[rgba(255,253,248,0.9)] px-2.5 py-1 text-[11px] text-[var(--pa-muted)]">
          {badge}
        </span>
      </div>
      <div className="mt-5">{children}</div>
    </SurfacePanel>
  );
}

function PreviewRowCard({ row }: { row: PreviewRow }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--pa-line)] bg-[#fcfaf5] px-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-[var(--pa-ink)]">{row.title}</p>
        <p className="mt-1 text-xs text-[var(--pa-muted)]">{row.meta}</p>
      </div>
      <span
        className={[
          "rounded-full border px-2.5 py-1 text-[11px]",
          row.badgeTone === "green"
            ? "border-[rgba(47,111,94,0.18)] bg-[rgba(223,236,230,0.72)] text-[var(--pa-green)]"
            : "border-[var(--pa-line)] bg-[rgba(255,253,248,0.9)] text-[var(--pa-muted)]"
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

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--pa-bg)] text-[var(--pa-ink)]">
      <header className="sticky top-0 z-30 border-b border-[rgba(221,210,193,0.84)] bg-[rgba(247,242,232,0.92)] backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center justify-between gap-3">
              <Link href="#top" className="pa-focus min-w-0">
                <span className="block text-sm font-semibold text-[var(--pa-ink)]">{copy.brandPrimary}</span>
                <span className="mt-0.5 block text-[11px] text-[var(--pa-muted)]">{copy.brandSecondary}</span>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={copy.switchHref}
                  className="pa-focus rounded-md border border-[var(--pa-line)] bg-[rgba(255,253,248,0.88)] px-3 py-2 text-sm font-medium text-[var(--pa-muted)] transition hover:border-[var(--pa-green)] hover:text-[var(--pa-green)]"
                  aria-label={`Switch language: ${copy.switchLabel}`}
                >
                  {copy.switchLabel}
                </Link>
                <Link
                  href={copy.appHref}
                  className="pa-focus rounded-md bg-[var(--pa-green)] px-4 py-2 text-sm font-medium text-white shadow-[0_6px_18px_rgba(47,111,94,0.16)]"
                >
                  {copy.primaryCta}
                </Link>
              </div>
            </div>
            <nav className="hidden items-center gap-2 md:flex" aria-label={copy.navAria}>
              {copy.navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="pa-focus rounded-full border border-[var(--pa-line)] bg-[rgba(255,253,248,0.88)] px-3 py-1.5 text-sm text-[var(--pa-muted)] transition hover:border-[var(--pa-green)] hover:text-[var(--pa-green)]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <nav
            className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden"
            aria-label={copy.mobileNavAria}
          >
            {copy.navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="pa-focus shrink-0 rounded-full border border-[var(--pa-line)] bg-[rgba(255,253,248,0.88)] px-3 py-1.5 text-xs text-[var(--pa-muted)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

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
                  className="pa-focus rounded-md bg-[var(--pa-green)] px-5 py-3 text-center text-sm font-medium text-white shadow-[0_8px_20px_rgba(47,111,94,0.16)]"
                >
                  {copy.primaryCta}
                </Link>
                <Link
                  href="#fit"
                  className="pa-focus rounded-md border border-[var(--pa-line)] bg-[rgba(255,253,248,0.88)] px-5 py-3 text-center text-sm font-medium text-[var(--pa-ink)]"
                >
                  {copy.secondaryCta}
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                {copy.heroPills.map((pill) => (
                  <span
                    key={pill}
                    className="rounded-full border border-[var(--pa-line)] bg-[rgba(255,253,248,0.86)] px-3 py-1 text-xs text-[var(--pa-muted)]"
                  >
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            <HeroScene copy={copy.heroScene} />
          </div>

          <div className="mt-12 grid gap-3 border-t border-[rgba(221,210,193,0.76)] pt-5 sm:grid-cols-3">
            {copy.heroSignals.map((signal) => (
              <SurfacePanel key={signal.title} className="p-4">
                <p className="text-sm font-medium text-[var(--pa-ink)]">{signal.title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--pa-muted)]">{signal.body}</p>
              </SurfacePanel>
            ))}
          </div>
        </div>
      </section>

      <section id="fit" className="scroll-mt-24 border-t border-[rgba(221,210,193,0.76)]">
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

      <section id="difference" className="scroll-mt-24 border-t border-[rgba(221,210,193,0.76)]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow={copy.differenceSection.eyebrow}
            title={copy.differenceSection.title}
            description={copy.differenceSection.description}
          />
          <div className="mt-8 grid gap-4 xl:grid-cols-4">
            {copy.differenceSection.cards.map((card) => (
              <ComparisonCard key={card.title} {...card} />
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="scroll-mt-24 border-t border-[rgba(221,210,193,0.76)]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow={copy.howSection.eyebrow}
            title={copy.howSection.title}
            description={copy.howSection.description}
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {copy.howSection.steps.map((step) => (
              <StepCard key={step.index} {...step} />
            ))}
          </div>
        </div>
      </section>

      <section id="preview" className="scroll-mt-24 border-t border-[rgba(221,210,193,0.76)]">
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
              <div className="rounded-md border border-[var(--pa-line)] bg-[#fcfaf5] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--pa-ink)]">
                    {copy.previewSection.preview.player.status}
                  </p>
                  <p className="text-xs text-[var(--pa-muted)]">{copy.previewSection.preview.player.time}</p>
                </div>
                <div className="mt-4 rounded-md border border-[rgba(201,138,46,0.16)] bg-[var(--pa-amber-soft)] p-4">
                  <p className="text-sm leading-7 text-[var(--pa-ink)]">
                    {copy.previewSection.preview.player.highlightedSentence}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[var(--pa-muted)]">
                  <span className="rounded-full border border-[rgba(201,138,46,0.18)] bg-[rgba(255,255,255,0.78)] px-2.5 py-1 font-medium text-[var(--pa-amber)]">
                    {copy.previewSection.preview.player.speed}
                  </span>
                  <span>{copy.previewSection.preview.player.timeline}</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[rgba(201,138,46,0.16)]">
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

      <section id="trial" className="scroll-mt-24 border-t border-[rgba(221,210,193,0.76)]">
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
              <p className="mt-4 text-xs leading-5 text-[var(--pa-muted)]">{copy.trialSection.note}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={copy.appHref}
                className="pa-focus rounded-md bg-[var(--pa-green)] px-5 py-3 text-center text-sm font-medium text-white shadow-[0_8px_20px_rgba(47,111,94,0.16)]"
              >
                {copy.primaryCta}
              </Link>
              <Link
                href="#how"
                className="pa-focus rounded-md border border-[var(--pa-line)] bg-[rgba(255,253,248,0.88)] px-5 py-3 text-center text-sm font-medium text-[var(--pa-ink)]"
              >
                {copy.trialSection.secondaryCta}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
