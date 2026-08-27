# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users

- Primary users: people who collect useful text and want to turn it into a readable, listenable learning record they can return to later.
- Secondary users: visitors evaluating the public PageAlong homepage before trying the product.

## Product Purpose

PageAlong helps people paste or import text, organize it into course-like records, and continue reading or listening later.
Success means a user can capture content, find it again, and resume without losing context.

## Positioning

PageAlong is a web reader that turns scattered text into structured audio-course records.
It is closer to a personal learning library than a generic bookmark app, feed reader, or admin dashboard.

## Operating Context

- The product ships as a public homepage plus a web console/workbench.
- Local development uses FastAPI, Celery, PostgreSQL, Redis, MinIO-compatible storage, and a Next.js frontend.
- The current console flows center on import, course library, reading, sentence-level review, and playback progress.
- Local development currently uses a fixed `X-User-Id` request header.

## Capabilities and Constraints

- Manual text import, course creation, course listing, course detail, and playback progress saving exist.
- Sentence splitting and sentence-level reading support exist.
- The worker/TTS path is still fake/skeleton based; real TTS is not yet integrated.
- URL import, file upload, browser extension import, OCR, authentication, payment, sharing, recommendations, and production observability are not yet implemented.
- The public homepage and console must not imply unfinished capabilities are already available.
- Chinese and English are separate localized interfaces.
- Business model is not decided yet.

## Brand Commitments

- Brand name: 页相随 PageAlong.
- Tone: calm, practical, learning-focused, trustworthy.
- The product should feel reading-first, not backend-first.
- It should work naturally for repeated mobile learning sessions.
- It should not be described as a registered trademark yet.

## Evidence on Hand

- `.agents/product-marketing.md`
- `docs/interface-style-and-interaction-research.md`
- `docs/superpowers/specs/2026-07-07-pagealong-console-ux-design.md`
- `docs/superpowers/specs/2026-07-29-interface-style-refresh-design.md`
- `docs/superpowers/specs/2026-08-01-brand-homepage-visual-design.md`
- `apps/web/src/app/[locale]/...`

## Product Principles

- Preserve honesty about what is ready versus planned.
- Make the resume path obvious before management details.
- Treat homepage and console as one product story.
- Keep mobile learning and quick return visits central.
- Favor clarity and repeatability over decorative complexity.

## Accessibility & Inclusion

- Chinese and English must remain supported as separate locales.
- The product must remain usable on mobile.
- Do not assume a desktop-only or keyboard-only usage pattern.
