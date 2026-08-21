# Product Marketing Context

*Last updated: 2026-07-07*

## Brand And Trademark

**Chinese brand name:** 页相随

**English brand name:** PageAlong

**Recommended combined usage:** 页相随 PageAlong

**Brand meaning:**
- "页" points to webpages, articles, documents, and course pages.
- "相随" suggests the product follows the learner across reading contexts and turns pages into audio that can accompany them.
- "PageAlong" echoes "follow along" and "read along", while keeping the page-centric product idea.

**Trademark status:** Candidate brand selected for this project. Do not describe it as registered. Before public launch, run formal trademark checks in the intended jurisdictions and classes, especially software/SaaS, education/content, and audio-related services.

**Trademark usage guidance:**
- Use "页相随 PageAlong" on first mention in product and marketing contexts.
- Use "页相随" for Chinese UI and "PageAlong" for English UI or global-facing contexts.
- Do not use the registered trademark symbol unless registration is completed.

## Product Overview

**One-liner:** 页相随 PageAlong turns webpages, articles, course text, and documents into listenable, manageable, resumable audio courses.

**What it does:** The current product foundation lets a user paste course/article text, creates a course record, splits the text into sentences, lists saved courses, opens a course detail page, and stores playback progress. The current TTS path uses a fake provider and Celery task skeleton to validate workflow shape before real audio generation is integrated.

**Product category:** AI reading companion, text-to-audio learning tool, audio course creator.

**Product type:** Web app with FastAPI backend, Celery worker, PostgreSQL storage, Redis task broker, and Next.js H5/mobile-oriented frontend.

**Business model:** Not decided.

## Target Audience

**Primary audience:** People who collect useful web articles, course notes, documents, or long-form text but want to consume them while commuting, walking, doing chores, or away from a screen.

**Primary use case:** Turn reading material into a course-like audio experience that can be saved, resumed, and reviewed by sentence.

**Jobs to be done:**
- Convert long text into something listenable.
- Manage imported learning material as a course list.
- Resume learning from the last playback position.
- Review the sentence-level structure of a course.

## Current Product Capabilities

**Implemented in the current foundation:**
- Health check API.
- Manual text import API.
- Course creation with title, source type, raw text, word count, and status.
- Sentence splitting for imported text.
- Course list API.
- Course detail API with sentence list.
- Soft delete course API.
- Playback progress save API.
- PostgreSQL models and initialization script for application tables.
- Redis-backed Celery client/worker wiring with project key prefix.
- Fake TTS provider code that can generate silent WAV files and sentence timing data.
- Celery audio-generation task skeleton.
- Next.js course list page.
- Text import form.
- Course cards with status, word count, source type, and delete action.
- Course detail page.
- Player UI skeleton with HTML audio control.
- Sentence list UI with active sentence highlighting support.
- Frontend API client for list/create/detail/progress/delete.
- Basic backend, worker, and frontend smoke tests.

**Important current limitations:**
- Real TTS is not integrated.
- The worker task currently returns a queued status and does not yet write generated audio/timeline back to the database.
- The current player has no real audio source wired from an audio asset.
- URL import, browser extension import, OCR, and file upload are planned concepts but not implemented.
- User accounts/authentication are not implemented; local development uses a fixed user header.
- Payments, sharing, recommendations, and production observability are not implemented.

## Positioning

**Core promise:** Pages become audio courses that stay with the learner.

**Suggested tagline:** 把读不完的内容，变成一路相随的课程。

**English tagline option:** Turn any page into a course that follows along.

## Customer Language

**Words to use:** 网页转音频, 文章转课程, 有声课程, 续播, 通勤学习, 句子时间轴, 随身听.

**Words to avoid for now:** 已注册商标, 真人 TTS, 已生成 MP3, 全自动 URL 抓取, 文件上传已支持.

## Brand Voice

**Tone:** Calm, practical, learning-focused.

**Style:** Clear Chinese-first product language, with concise English brand support.

**Personality:** Companionable, efficient, focused, trustworthy.
