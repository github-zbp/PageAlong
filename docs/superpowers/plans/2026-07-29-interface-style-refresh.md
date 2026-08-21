# Interface Style Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved PageAlong interface refresh across dashboard, library, import, URL review, reading workspace, custom player, mobile navigation, and first-round reading preferences.

**Architecture:** Keep the existing Next.js App Router and component boundaries. Add small focused helpers for formatting, local reader preferences, and shared UI styling; refactor existing components in place where their responsibilities already match the feature.

**Tech Stack:** Next.js 13, React 18, TypeScript, Tailwind CSS, Playwright, browser localStorage for first-round preferences.

---

## File Structure

- Modify `apps/web/src/lib/i18n.ts`: rename user-facing library copy to `课程库` / `Library`, add player, preference, and drawer labels.
- Create `apps/web/src/lib/format.ts`: shared time, date, and progress formatting.
- Create `apps/web/src/lib/reader-preferences.ts`: localStorage-backed reader preference helpers.
- Modify `apps/web/src/app/globals.css`: theme CSS variables and range input polish.
- Modify `apps/web/src/components/ConsoleShell.tsx`: warm reader shell, desktop sidebar polish, mobile top navigation and drawer.
- Modify `apps/web/src/components/PageHeader.tsx`: align page headers with the new visual system.
- Modify `apps/web/src/components/SummaryCard.tsx`: quieter dashboard stats.
- Modify `apps/web/src/components/StatusBadge.tsx`: status-aware badge tones.
- Create `apps/web/src/components/CourseListItem.tsx`: compact course row shared by dashboard, library, and reading sidebar.
- Modify `apps/web/src/components/CourseCard.tsx`: compatibility wrapper around `CourseListItem`.
- Modify `apps/web/src/app/[locale]/dashboard/page.tsx`: continue-listening first layout.
- Modify `apps/web/src/app/[locale]/library/page.tsx`: list-first library layout and controls.
- Modify `apps/web/src/components/ImportTextForm.tsx`: new quiet form surface.
- Modify `apps/web/src/components/ImportUrlForm.tsx`: new form, status, and article-style review preview.
- Modify `apps/web/src/app/[locale]/import/[tab]/page.tsx`: quiet tabs and panels.
- Modify `apps/web/src/app/[locale]/courses/[courseId]/page.tsx`: route detail visual cleanup.
- Modify `apps/web/src/components/CourseReadingWorkspace.tsx`: collapsible desktop article queue and mobile drawer.
- Modify `apps/web/src/components/CoursePlayer.tsx`: custom right-main-area player, controls, speed memory, state panels.
- Modify `apps/web/src/components/MarkdownReader.tsx`: paper reading surface, active sentence rail, font size and line-height preferences.
- Modify `apps/web/tests/course-flow.spec.ts`: behavior tests for updated naming, custom player, reading preferences, and mobile drawer.

## Task 1: Write Failing Playwright Coverage

**Files:**
- Modify: `apps/web/tests/course-flow.spec.ts`

- [ ] **Step 1: Update import flow naming expectations**

Change the localized import test to expect `课程库` instead of `碎片化课程`:

```ts
await expect(page.getByRole("link", { name: "课程库" })).toBeVisible();
await expect(page).toHaveURL(/\/zh\/library$/);
await expect(page.getByRole("heading", { name: "课程库" })).toBeVisible();
```

- [ ] **Step 2: Add a custom player and reading preferences test**

Append a Playwright test that mocks a ready course, opens `/zh/courses/ready_1`, and asserts:

```ts
await expect(page.locator('[data-course-player="reading-dock"]')).toBeVisible();
await expect(page.getByRole("button", { name: "播放" })).toBeVisible();
await page.getByRole("button", { name: "大字号" }).click();
await expect(page.locator("[data-reader-preferences]")).toHaveAttribute("data-font-size", "large");
```

- [ ] **Step 3: Add series workspace sidebar and mobile drawer tests**

Append one Playwright test that opens a mocked series on `/zh/series` and asserts:

```ts
await page.getByRole("button", { name: /打开系列: 精听训练/ }).click();
await page.getByRole("button", { name: "折叠文章列表" }).click();
await expect(page.locator("[data-reading-sidebar]")).toHaveAttribute("data-collapsed", "true");
```

Append one mobile Playwright test with `page.setViewportSize({ width: 390, height: 844 })`, open the same mocked series, and assert:

```ts
await expect(page.getByRole("button", { name: "打开文章列表" })).toBeVisible();
await page.getByRole("button", { name: "打开文章列表" }).click();
await expect(page.getByRole("dialog", { name: "课程文章" })).toBeVisible();
await expect(page.locator('[data-course-player="reading-dock"]')).toBeVisible();
```

- [ ] **Step 4: Run tests and verify RED**

Run:

```bash
make test-web
```

Expected: FAIL because the UI still says `碎片化课程`, has no `reading-dock`, no preference controls, and no mobile drawer.

## Task 2: Add Shared Tokens, Formatting, Preferences, and Course Row

**Files:**
- Create: `apps/web/src/lib/format.ts`
- Create: `apps/web/src/lib/reader-preferences.ts`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/lib/i18n.ts`
- Modify: `apps/web/src/components/StatusBadge.tsx`
- Create: `apps/web/src/components/CourseListItem.tsx`
- Modify: `apps/web/src/components/CourseCard.tsx`

- [ ] **Step 1: Implement formatting helpers**

Create `formatDuration`, `formatDateTime`, and `formatProgressPercent` in `apps/web/src/lib/format.ts`.

- [ ] **Step 2: Implement local reader preferences**

Create typed defaults, `readReaderPreferences`, `writeReaderPreferences`, and `readerPreferenceClassNames` in `apps/web/src/lib/reader-preferences.ts`.

- [ ] **Step 3: Add CSS variables**

Update `globals.css` with `--pa-bg`, `--pa-surface`, `--pa-muted-surface`, `--pa-ink`, `--pa-muted`, `--pa-line`, `--pa-green`, `--pa-amber`, and reader preference CSS variables.

- [ ] **Step 4: Update user-facing copy**

Change Chinese `fragmentedCourses`, `library.title`, `detail.breadcrumb`, and `detail.backToLibrary` to `课程库`; add labels for player controls, reader preferences, and drawer actions.

- [ ] **Step 5: Implement status-aware badge and compact course row**

Create `CourseListItem` with title, metadata, status, progress, primary action, star/delete secondary controls. Update `CourseCard` to delegate to it for backward compatibility.

- [ ] **Step 6: Run tests**

Run:

```bash
make test-web
```

Expected: naming assertions pass; player/drawer/preference assertions still fail.

## Task 3: Refresh Shell, Dashboard, Library, and Import

**Files:**
- Modify: `apps/web/src/components/ConsoleShell.tsx`
- Modify: `apps/web/src/components/PageHeader.tsx`
- Modify: `apps/web/src/components/SummaryCard.tsx`
- Modify: `apps/web/src/app/[locale]/dashboard/page.tsx`
- Modify: `apps/web/src/app/[locale]/library/page.tsx`
- Modify: `apps/web/src/app/[locale]/import/[tab]/page.tsx`
- Modify: `apps/web/src/components/ImportTextForm.tsx`
- Modify: `apps/web/src/components/ImportUrlForm.tsx`

- [ ] **Step 1: Refresh the shell and page headers**

Use warm paper backgrounds, quieter desktop navigation, mobile top bar, and accessible mobile nav drawer.

- [ ] **Step 2: Refresh dashboard**

Make continue-learning the first visual anchor and use compact recent course rows.

- [ ] **Step 3: Refresh library**

Use compact rows, quiet filters, and `课程库` naming.

- [ ] **Step 4: Refresh import and URL review**

Use quiet task form surfaces and article-like URL preview.

- [ ] **Step 5: Run tests**

Run:

```bash
make test-web
```

Expected: import and library flow passes; player/drawer/preference assertions still fail until Task 4.

## Task 4: Implement Reading Workspace, Custom Player, and Preferences

**Files:**
- Modify: `apps/web/src/components/CourseReadingWorkspace.tsx`
- Modify: `apps/web/src/components/CoursePlayer.tsx`
- Modify: `apps/web/src/components/MarkdownReader.tsx`
- Modify: `apps/web/src/app/[locale]/courses/[courseId]/page.tsx`

- [ ] **Step 1: Add reader preference controls**

Expose font-size and line-height buttons with accessible labels such as `大字号`, update localStorage, and set `data-reader-preferences`.

- [ ] **Step 2: Add collapsible desktop sidebar**

Use `data-reading-sidebar` and `data-collapsed`, with buttons labelled `折叠文章列表` and `展开文章列表`.

- [ ] **Step 3: Add mobile article drawer**

Use a top button labelled `打开文章列表` and a dialog labelled `课程文章` for the mobile queue.

- [ ] **Step 4: Replace native visible audio controls with custom player**

Render `[data-course-player="reading-dock"]` inside the right main region. Include play/pause, +/- 10 seconds, range progress, time, and speed selector. Keep the underlying audio element for playback.

- [ ] **Step 5: Refresh MarkdownReader**

Remove heavy card styling, apply reader preference classes, and implement active sentence rail.

- [ ] **Step 6: Run tests**

Run:

```bash
make test-web
```

Expected: all Playwright tests pass.

## Task 5: Build and Visual Verification

**Files:**
- Verify changed frontend files only.

- [ ] **Step 1: Run production build**

Run:

```bash
cd apps/web && npm run build
```

Expected: build succeeds.

- [ ] **Step 2: Start local API/Web if visual inspection needs real browser rendering**

Use local ports from `AGENTS.md`:

```bash
API_BASE_URL=http://127.0.0.1:8070 NEXT_PUBLIC_API_BASE_URL=http://localhost:8070 make web
```

- [ ] **Step 3: Inspect desktop and mobile pages**

Verify no text overlap, sidebar collapse works, mobile drawer opens, and player is constrained to the right main area.

- [ ] **Step 4: Final git diff review**

Run:

```bash
git diff --stat
git diff -- apps/web/src apps/web/tests docs/superpowers/plans/2026-07-29-interface-style-refresh.md
```

Expected: changes match the approved spec with no generated/cache files.
