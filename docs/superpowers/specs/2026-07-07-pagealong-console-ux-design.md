# PageAlong Console UX Design

## Goal

Make the PageAlong web console feel like a usable product instead of a single text form. Users should immediately understand where they are, what content exists, what state each course is in, and what they can do next.

## Brand And Language

- Chinese brand: 页相随
- English brand: PageAlong
- First mention in product/marketing contexts: 页相随 PageAlong
- The app supports Chinese and English as separate localized interfaces.
- UI labels should not stack Chinese and English inside the same button or menu item.
- Recommended route structure:
  - `/zh/dashboard`, `/zh/library`, `/zh/import`, `/zh/jobs`, `/zh/settings`
  - `/en/dashboard`, `/en/library`, `/en/import`, `/en/jobs`, `/en/settings`
- `/` should redirect to the default locale dashboard. The first implementation can default to Chinese.

## Navigation

The first version uses a persistent sidebar with five primary entries:

| Chinese | English | Purpose |
| --- | --- | --- |
| 工作台 | Dashboard | Default landing page; shows current state and next actions. |
| 课程库 | Library | All saved courses and course actions. |
| 导入内容 | Import | Text import now; URL/file/extension entries as disabled upcoming options. |
| 生成任务 | Jobs | Generation status and explanation; initially allowed to be a light status/empty page. |
| 设置 | Settings | Language and future preferences; initially light. |

The sidebar footer contains language switching.

## Dashboard

The dashboard replaces the current bare `/courses` landing experience.

It should show:

- A clear page title and short purpose line.
- A primary action to import content.
- Status overview: total courses, pending generation count, and resume-ready count.
- A continue-learning section when a course has saved progress.
- A recent courses section.
- A next-step panel that changes based on current content:
  - No courses: import the first text.
  - Has text-ready courses: generate audio is the next product step, but until backend support exists, point users to Jobs and explain the current stage.
  - Has course progress: continue learning.

## Library

The library owns the course list.

Each course card should show:

- Title
- Status
- Source type
- Word count
- Sentence count
- Last playback position
- Open/detail action
- Delete action

Search and filters are out of scope for the first implementation.

## Import

The import page should contain the existing text import form and make upcoming sources visible without pretending they work.

Current enabled option:

- Paste text

Disabled upcoming options:

- URL import
- File upload
- Browser extension

After a successful import, the page should refresh state and make it clear the course was added.

## Jobs

The jobs page should not invent backend data that does not exist.

First version content:

- Explain that generation tasks are wired through Redis/Celery.
- Show a light empty/skeleton state until a jobs API exists.
- Link users back to the library or import page.

## Course Detail

The course detail page should show:

- Breadcrumb/location: Library / course title.
- Course title, status, word count, and sentence count.
- Playback status area.
- Sentence list.
- Next actions.

When real audio is not available, the UI must not show an empty player as if playback is ready. It should clearly say:

- Text is ready.
- Audio generation is not connected yet or is pending.
- The next step is to check generation tasks or return to the library.

## States And Honesty

The UI should distinguish current capabilities from planned capabilities.

Use disabled cards, "coming soon" badges, and empty states for future features rather than active controls that do nothing.

## Visual Direction

This is a console for repeated learning workflows, not a marketing landing page.

Design principles:

- Quiet, work-focused layout.
- Dense but readable information.
- Sidebar navigation with clear active state.
- No oversized hero area.
- No decorative cards inside page sections.
- Use status badges and next-action panels to guide behavior.

## First Implementation Scope

Implement:

- Locale route structure for Chinese and English.
- Persistent sidebar.
- Dashboard page.
- Library page.
- Import page.
- Jobs placeholder page.
- Settings placeholder page with language switch.
- Course detail page using the shared shell.
- Localized UI strings for the implemented pages.

Defer:

- Real TTS generation.
- Jobs list API.
- Search/filtering.
- Authentication.
- Billing.
- Full user preferences.
