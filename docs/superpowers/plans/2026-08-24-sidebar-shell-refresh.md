# Sidebar Shell Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the desktop sidebar and series reading workspace so the shell is flush-left, collapse controls live on the border, collapsed states use icons only, and series reading can enter a fullscreen mode that hides the article sidebar.

**Architecture:** Keep the workbench shell and the series reading workspace as separate layouts, but standardize their sidebar behavior around the same visual language: border-mounted toggle handles, icon-only collapsed rails, and compact top-level controls. The series reading view gets a fullscreen state that is owned by the workspace layout and triggered from the course header, so the content component stays focused on reading while the layout decides whether the article list is visible.

**Tech Stack:** Next.js 13 App Router, React 18, TypeScript, Tailwind CSS, local preference helpers, custom SVG icons.

---

### Task 1: Add the shared iconography and labels

**Files:**
- Modify: `apps/web/src/components/UiIcons.tsx`
- Modify: `apps/web/src/lib/i18n.ts`

- [ ] **Step 1: Add sidebar and fullscreen icons**

```tsx
export function SidebarHandleIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m14.5 6.5-5 5 5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </BaseIcon>
  );
}

export function FullscreenIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M20 20h-5v-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </BaseIcon>
  );
}

export function FullscreenExitIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M20 20v-5h-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </BaseIcon>
  );
}
```

- [ ] **Step 2: Add labels for the new fullscreen controls**

```ts
reading: {
  // existing labels...
  fullscreen: "全屏阅读",
  exitFullscreen: "退出全屏",
}
```

```ts
reading: {
  // existing labels...
  fullscreen: "Fullscreen",
  exitFullscreen: "Exit fullscreen",
}
```

### Task 2: Rebuild the workbench shell

**Files:**
- Modify: `apps/web/src/components/ConsoleShell.tsx`

- [ ] **Step 1: Remove the centered max-width wrapper and make the shell flush-left**

```tsx
<div className="min-h-screen bg-[var(--pa-bg)] text-[var(--pa-ink)]">
  <div className="flex min-h-screen w-full flex-col md:flex-row">
    {/* sidebar */}
    {/* main */}
  </div>
</div>
```

- [ ] **Step 2: Move the collapse control onto the sidebar border and make it icon-first**

```tsx
<aside className="relative hidden min-h-screen border-r border-[var(--pa-line)] bg-[var(--pa-muted-surface)] md:flex md:w-72 md:flex-col md:transition-[width] md:duration-200">
  <button className="absolute right-0 top-6 inline-flex h-8 w-8 translate-x-1/2 items-center justify-center rounded-full border border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-ink)] shadow-sm">
    <SidebarHandleIcon className={isSidebarCollapsed ? "h-4 w-4" : "h-4 w-4 rotate-180"} />
  </button>
</aside>
```

- [ ] **Step 3: Render icons instead of initials in the collapsed rail**

```tsx
<SidebarLink collapsed icon={<DashboardIcon className="h-4 w-4" />} label={dictionary.nav.dashboard} ... />
```

### Task 3: Rework the series reading workspace

**Files:**
- Modify: `apps/web/src/components/CourseReadingWorkspace.tsx`
- Modify: `apps/web/src/components/CourseDetailContent.tsx`

- [ ] **Step 1: Remove the in-panel "fold article list" button from the reading sidebar**

```tsx
// delete the inline collapse button from the sidebar header
// keep the sidebar item list and search field behavior
```

- [ ] **Step 2: Add a fullscreen state owned by the workspace and pass it into the course header**

```tsx
const [isFullscreenMode, setFullscreenMode] = useState(false);

<CourseDetailContent
  ...
  isFullscreen={isFullscreenMode}
  onToggleFullscreen={() => setFullscreenMode((value) => !value)}
/>
```

```tsx
export function CourseDetailContent({
  ...
  isFullscreen = false,
  onToggleFullscreen
}: {
  ...
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}) {
  ...
}
```

- [ ] **Step 3: Add the fullscreen toggle to the top-left of the detail header**

```tsx
{onToggleFullscreen ? (
  <button
    className="pa-focus inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#ddd2c1] bg-[#fffdf8] text-[#70685e] hover:border-[#2f6f5e] hover:text-[#245447]"
    onClick={onToggleFullscreen}
    type="button"
    aria-label={isFullscreen ? dictionary.reading.exitFullscreen : dictionary.reading.fullscreen}
    title={isFullscreen ? dictionary.reading.exitFullscreen : dictionary.reading.fullscreen}
  >
    {isFullscreen ? <FullscreenExitIcon className="h-4 w-4" /> : <FullscreenIcon className="h-4 w-4" />}
  </button>
) : null}
```

- [ ] **Step 4: Hide the sidebar when fullscreen is active and keep a minimal top bar**

```tsx
{!isFullscreenMode ? (
  <aside>{/* article list */}</aside>
) : (
  <div className="sticky top-0 z-20 border-b border-[var(--pa-line)] bg-[var(--pa-bg)]/95 px-4 py-3 backdrop-blur">
    <div className="flex items-center justify-between gap-3">
      <button onClick={onBack} type="button">{dictionary.reading.backToList}</button>
      <p className="truncate text-sm font-semibold">{title}</p>
    </div>
  </div>
)}
```

### Task 4: Verify the shell behavior

**Files:**
- Modify: `apps/web/src/components/ConsoleShell.tsx`
- Modify: `apps/web/src/components/CourseReadingWorkspace.tsx`
- Modify: `apps/web/src/components/CourseDetailContent.tsx`

- [ ] **Step 1: Build the web app**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/web && npm run build
```

- [ ] **Step 2: Launch the web app and inspect the sidebar states in a browser**

```bash
API_BASE_URL=http://127.0.0.1:8070 NEXT_PUBLIC_API_BASE_URL=http://localhost:8070 make web
```

- [ ] **Step 3: Check the workbench sidebar, the collapsed icon rail, the series reader, and fullscreen mode in both desktop and mobile widths**

```bash
# verify the sidebar handle sits on the border
# verify collapsed content is icon-only
# verify fullscreen hides the reading sidebar
```

- [ ] **Step 4: Fix any layout regressions found in the browser and rerun the build**

```bash
cd /Users/jqsf/Desktop/code/web_reader/apps/web && npm run build
```
