<p align="center">
  <a href="./README.md">中文</a> ｜ English
</p>

<h1 align="center">PageAlong</h1>

<p align="center">
  <img src="apps/mobile/assets/logo/web_reader-logo.png" alt="PageAlong logo" width="128" />
</p>

## Product Overview

PageAlong is a clip-based audio-course product for mobile learning. It turns webpages, course content, and documents into listenable, manageable, resumable audio courses, helping users make the most of fragmented time and learn on the go without staring at a screen.

A small tool built entirely with vibe coding for personal use. Feel free to use it for free, no payment required.

### Official website
<https://web-reader.zbpblog.cn> (subject to change later)

### Product forms
- Web app
- Chrome extension
- Android app

### Product features
1. Multi-entry import: supports URL, plain text, files, Chrome extension, and Android sharing to collect articles into PageAlong and generate documents + audio.
2. Automatic content cleanup: extracts the main page content, removes noise, and turns it into course text that is suitable for reading and listening.
3. Sentence-level audio courses: generates timelines by sentence, with current-sentence highlighting, sentence jumping, and resume playback.
4. Course library management: organizes saved content by course, series, and tag for search, filtering, and continued learning.
5. Traceable generation status: import, text parsing, audio generation, and download all show status, and failed jobs can be retried.
6. Download and retain: supports downloading audio, Markdown, Word, and PDF for re-listening, review, and editing.
7. Mobile-first: lets you keep listening in commute, cooking, bedtime, and other screen-free situations.

## One-Click Deployment

There are two deployment options:
- Host-based installation and startup
```bash
make bootstrap-prod
```

- Containerized installation and startup
```bash
make compose-prod
```

Both options copy `.env.example` to `.env` first when the root `.env` file is missing. `make compose-prod` also guides you through the minimum runtime configuration and writes the results back to `.env`.

### Variables you will be prompted for during deployment

#### Required environment variables (prompted during install)
| Variable | Purpose | How to set |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | Written to root `.env`; `make compose-prod` will prompt for it |
| `REDIS_URL` | Redis connection string | Same |
| `TTS_STORAGE_BACKEND` | Audio storage backend | Same, `local` / `r2` / `s3` / `minio` |
| `ADMIN_BOOTSTRAP_EMAIL` | First admin email | `make compose-prod` will prompt for it |
| `ADMIN_BOOTSTRAP_PASSWORD` | First admin password | `make compose-prod` will prompt for it |

#### Optional environment variables
| Variable | Purpose | How to set |
| --- | --- | --- |
| `URL_IMPORT_IMAGE_STORAGE_BACKEND` | URL import image storage backend | Same, usually keep it aligned with audio storage |
| `S3_ENDPOINT_URL` | S3/R2/MinIO endpoint | Fill it in when you choose object storage |
| `S3_ACCESS_KEY_ID` | Object storage access key | Fill it in when you choose object storage |
| `S3_SECRET_ACCESS_KEY` | Object storage secret key | Fill it in when you choose object storage |
| `S3_BUCKET` | Object storage bucket | Fill it in when you choose object storage |
| `API_HOST_PORT` | Exposed API port on the host | Adjust if the port is already in use |
| `WEB_HOST_PORT` | Exposed Web port on the host | Adjust if the port is already in use |

### Minimum runtime variables

If you want to start with the smallest usable setup, put the following into the root `.env`:

```env
DATABASE_URL=postgresql+psycopg://<db_user>:<db_password>@<db_host>:5432/web_reader
REDIS_URL=redis://:<redis_password>@<redis_host>:6379/0
API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_BASE_URL=/api
CORS_ALLOW_ORIGINS=https://your-domain.example
TTS_PROVIDER_MODE=fake or edge_tts
TTS_STORAGE_BACKEND=local
URL_IMPORT_IMAGE_STORAGE_BACKEND=local
```

Configuration:
- The root `.env` file is the main configuration entry for production and containerized deployment.

If you want to use real object storage or a real TTS provider, refer to [docs/environment-variables.md](docs/environment-variables.md) for the corresponding variables.

## Tech Stack

- Web app: Next.js 13, React 18, TypeScript, Tailwind CSS, Playwright
- Chrome extension: Vite, React 18, TypeScript, Vitest
- Android app: React Native, Expo, Expo Router, TypeScript
- Backend API: FastAPI, SQLAlchemy, Alembic, Python 3.12
- Async jobs: Celery
- Data and cache: PostgreSQL, Redis
- Content processing: readability-lxml, trafilatura, markdownify, python-docx, pypdf, EbookLib
- Media and object storage: local directories, Cloudflare R2, S3, MinIO
- TTS providers: Edge TTS, Kokoro ONNX CPU, Tencent Cloud TTS, AWS Polly; fake provider remains only for tests
- Email service: Brevo SMTP
- Deployment and scripts: Makefile, Docker, Docker Compose, tmux

## Planned Features

Whether these get built next depends on user count and feedback.

- Pricing strategy
- Homepage product showcase redesign
- Male and female voices
- Better book cover generation
- Font, size, and background controls
- AI-generated notes / summaries
- Community, comments, and sharing
- Sync to third-party knowledge management tools such as Notion and Obsidian

## Contact the Author

If you have suggestions, feedback, or feature ideas, or just want to be friends with A Pei, feel free to reach out.

- QQ: 1640632344
- WeChat: zbp_01
- Official account: 程序员阿沛

| Personal WeChat QR code | Official account QR code |
| --- | --- |
| <img src="apps/mobile/assets/logo/个人微信二维码.jpg" alt="Personal WeChat QR code" width="180" /> | <img src="apps/mobile/assets/logo/qrcode_程序员阿沛.jpg" alt="Official account QR code" width="180" /> |

## Non-Commercial Notice

This project uses [PolyForm Noncommercial License 1.0.0](LICENSE). It is for non-commercial use only, and commercial use in any form is prohibited.
