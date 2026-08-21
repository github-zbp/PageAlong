# PageAlong Console UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current single text-import page into a bilingual PageAlong console with sidebar navigation, dashboard, library, import, jobs, settings, and clearer course detail states.

**Architecture:** Keep the current Next 13 app router. Add locale-aware routes under `/[locale]`, a shared console shell, a small i18n dictionary, and focused page components that reuse the existing API client. Root and legacy `/courses` routes redirect into `/zh/dashboard` and `/zh/library`.

**Tech Stack:** Next.js 13 app router, React 18, TypeScript, Tailwind CSS, Playwright.

---

## Files

- Create `apps/web/src/lib/i18n.ts` for locale validation and UI strings.
- Create `apps/web/src/components/ConsoleShell.tsx` for sidebar layout, active navigation, and language switch.
- Create `apps/web/src/components/StatusBadge.tsx` for readable course statuses.
- Create `apps/web/src/components/SummaryCard.tsx` for dashboard metrics.
- Modify `apps/web/src/components/AppShell.tsx` to delegate or stop using it in new routes.
- Modify `apps/web/src/components/ImportTextForm.tsx` to use localized copy and success/error states.
- Modify `apps/web/src/components/CourseCard.tsx` to show status, sentence count, last position, and localized actions.
- Modify `apps/web/src/components/CoursePlayer.tsx` to show honest audio availability state.
- Create locale pages:
  - `apps/web/src/app/[locale]/dashboard/page.tsx`
  - `apps/web/src/app/[locale]/library/page.tsx`
  - `apps/web/src/app/[locale]/import/page.tsx`
  - `apps/web/src/app/[locale]/jobs/page.tsx`
  - `apps/web/src/app/[locale]/settings/page.tsx`
  - `apps/web/src/app/[locale]/courses/[courseId]/page.tsx`
- Modify redirects:
  - `apps/web/src/app/page.tsx`
  - `apps/web/src/app/courses/page.tsx`
  - `apps/web/src/app/courses/[courseId]/page.tsx`
- Update `apps/web/tests/course-flow.spec.ts` for the localized import/library flow.

## Tasks

### Task 1: Add Failing Navigation Test

- [ ] Update Playwright smoke test to visit `/zh/import`, create a course, verify redirect/visibility in `/zh/library`, and verify sidebar entries.
- [ ] Run `cd apps/web && npm test -- --project=chromium`.
- [ ] Expected: fail because locale routes/sidebar do not exist yet.

### Task 2: Add Locale Dictionary And Shell

- [ ] Implement `apps/web/src/lib/i18n.ts`.
- [ ] Implement `ConsoleShell` with sidebar entries: Dashboard, Library, Import, Jobs, Settings.
- [ ] Use Chinese and English dictionaries without mixed labels.
- [ ] Add language switch links between matching pages.

### Task 3: Build Dashboard, Library, Import, Jobs, Settings

- [ ] Implement `/[locale]/dashboard` with metrics, next action, continue learning, recent courses.
- [ ] Implement `/[locale]/library` with course list.
- [ ] Implement `/[locale]/import` using the existing text import form and disabled upcoming import options.
- [ ] Implement `/[locale]/jobs` as honest placeholder until jobs API exists.
- [ ] Implement `/[locale]/settings` as language-focused placeholder.

### Task 4: Build Localized Course Detail

- [ ] Implement `/[locale]/courses/[courseId]`.
- [ ] Use breadcrumb-style location.
- [ ] Show course state, sentence count, and audio availability copy.
- [ ] Keep sentence list and playback progress behavior where applicable.

### Task 5: Redirect Legacy Routes

- [ ] Redirect `/` to `/zh/dashboard`.
- [ ] Redirect `/courses` to `/zh/library`.
- [ ] Redirect `/courses/[courseId]` to `/zh/courses/[courseId]`.

### Task 6: Verify

- [ ] Run `cd apps/web && npm test -- --project=chromium`.
- [ ] Run `cd apps/web && npm run build`.
- [ ] Start or reuse local dev server.
- [ ] Inspect `/zh/dashboard`, `/zh/import`, `/zh/library`, and `/en/dashboard` in the browser.
