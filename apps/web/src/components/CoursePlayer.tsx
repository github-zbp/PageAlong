"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { courseAudioUrl, getCourse, mediaUrl, requestCourseAudioGeneration, savePlaybackProgress } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { dictionaries, type Locale } from "@/lib/i18n";
import {
  defaultReaderPreferences,
  READER_PREFERENCES_UPDATED_EVENT,
  readReaderPreferences,
  updateReaderPreferences,
  type ReaderPreferences
} from "@/lib/reader-preferences";
import type { Course, CourseOutlineItem, Sentence } from "@/lib/types";
import { MarkdownReader } from "./MarkdownReader";
import { ReaderPreferencesControls } from "./ReaderPreferencesControls";
import { CloseIcon, PlayIcon } from "./UiIcons";

const playbackRates = [0.75, 1, 1.25, 1.5, 2];

type PlaybackPhase = "idle" | "waiting";

export function CoursePlayer({
  course,
  locale,
  autoplay = false,
  outline = [],
  showReaderPreferencesSection = true,
  showSourceInfo = true
}: {
  course: Course;
  locale: Locale;
  autoplay?: boolean;
  outline?: CourseOutlineItem[];
  showReaderPreferencesSection?: boolean;
  showSourceInfo?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const mountedRef = useRef(true);
  const pollTokenRef = useRef(0);
  const pendingAutoPlayRef = useRef(false);
  const lastSavedSecondRef = useRef(course.last_playback_position_seconds);
  const [currentCourse, setCurrentCourse] = useState(course);
  const [currentTime, setCurrentTime] = useState(course.last_playback_position_seconds);
  const [durationSeconds, setDurationSeconds] = useState(course.duration_seconds);
  const [isPlaying, setPlaying] = useState(false);
  const [preferences, setPreferences] = useState<ReaderPreferences>(defaultReaderPreferences);
  const [playbackPhase, setPlaybackPhase] = useState<PlaybackPhase>("idle");
  const [playbackMessage, setPlaybackMessage] = useState("");
  const [isPlayerCollapsed, setPlayerCollapsed] = useState(false);
  const dictionary = dictionaries[locale];

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pollTokenRef.current += 1;
    };
  }, []);

  useEffect(() => {
    setCurrentCourse(course);
    setCurrentTime(course.last_playback_position_seconds);
    setDurationSeconds(course.duration_seconds);
    setPlaying(false);
    setPlaybackPhase("idle");
    setPlaybackMessage("");
    setPlayerCollapsed(false);
    lastSavedSecondRef.current = course.last_playback_position_seconds;
    pendingAutoPlayRef.current = false;
    if (audioRef.current != null) {
      audioRef.current.currentTime = course.last_playback_position_seconds;
      audioRef.current.pause();
    }
  }, [
    course.content_markdown,
    course.current_audio_url,
    course.duration_seconds,
    course.id,
    course.last_playback_position_seconds,
    course.outline,
    course.sentences,
    course.status
  ]);

  useEffect(() => {
    function syncPreferences() {
      setPreferences(readReaderPreferences());
    }

    syncPreferences();
    window.addEventListener(READER_PREFERENCES_UPDATED_EVENT, syncPreferences);
    return () => {
      window.removeEventListener(READER_PREFERENCES_UPDATED_EVENT, syncPreferences);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current != null) {
      audioRef.current.playbackRate = preferences.playbackRate;
    }
  }, [preferences.playbackRate]);

  useEffect(() => {
    if (currentCourse.status !== "ready" || currentCourse.current_audio_url == null) {
      return;
    }
    if (!pendingAutoPlayRef.current) {
      return;
    }
    pendingAutoPlayRef.current = false;
    void playCurrentAudio();
  }, [currentCourse.current_audio_url, currentCourse.status]);

  useEffect(() => {
    setDurationSeconds(currentCourse.duration_seconds);
  }, [currentCourse.duration_seconds]);

  const activeSentenceIndex = useMemo(() => {
    const match = currentCourse.sentences.find((sentence) => {
      if (sentence.audio_start_seconds == null || sentence.audio_end_seconds == null) {
        return false;
      }
      return currentTime >= sentence.audio_start_seconds && currentTime < sentence.audio_end_seconds;
    });
    return match?.index ?? 0;
  }, [currentCourse.sentences, currentTime]);

  function canRequestAudio(status: string): boolean {
    return status === "text_ready" || status === "audio_generating";
  }

  function delay(milliseconds: number) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function seekToSentence(sentence: Sentence) {
    if (sentence.audio_start_seconds == null || audioRef.current == null) {
      return;
    }
    audioRef.current.currentTime = sentence.audio_start_seconds;
    setCurrentTime(sentence.audio_start_seconds);
  }

  function updatePreferences(nextPreferences: Partial<ReaderPreferences>) {
    setPreferences((current) => {
      const updated = updateReaderPreferences({ ...current, ...nextPreferences });
      return updated;
    });
  }

  function seekBy(deltaSeconds: number) {
    if (audioRef.current == null) {
      return;
    }
    const nextTime = Math.min(Math.max(audioRef.current.currentTime + deltaSeconds, 0), durationSeconds || currentCourse.duration_seconds || 0);
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function seekToTime(value: number) {
    if (audioRef.current != null) {
      audioRef.current.currentTime = value;
    }
    setCurrentTime(value);
  }

  async function playCurrentAudio() {
    const audio = audioRef.current;
    if (audio == null) {
      return;
    }
    try {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
      await audio.play();
      setPlaying(true);
      setPlaybackPhase("idle");
      setPlaybackMessage("");
    } catch {
      setPlaying(false);
      setPlaybackPhase("idle");
      setPlaybackMessage(dictionary.detail.lazyPlayBlocked);
    }
  }

  async function pollUntilAudioReady(courseId: string) {
    const token = ++pollTokenRef.current;
    while (mountedRef.current && pollTokenRef.current === token) {
      const nextCourse = await getCourse(courseId);
      if (!mountedRef.current || pollTokenRef.current !== token) {
        return;
      }
      setCurrentCourse(nextCourse);
      setDurationSeconds(nextCourse.duration_seconds);
      if (nextCourse.status === "ready" && nextCourse.current_audio_url != null) {
        return;
      }
      await delay(1500);
    }
  }

  async function requestAndPollAudio() {
    if (!canRequestAudio(currentCourse.status)) {
      return;
    }
    if (playbackPhase === "waiting") {
      return;
    }
    pendingAutoPlayRef.current = true;
    setPlaybackPhase("waiting");
    setPlaybackMessage(dictionary.detail.lazyGenerating);
    try {
      await requestCourseAudioGeneration(currentCourse.id);
      await pollUntilAudioReady(currentCourse.id);
    } catch {
      pendingAutoPlayRef.current = false;
      setPlaybackPhase("idle");
      setPlaybackMessage(dictionary.detail.playRequestError);
    }
  }

  async function togglePlayback() {
    if (currentCourse.status === "ready" && currentCourse.current_audio_url != null) {
      if (audioRef.current == null) {
        return;
      }
      if (audioRef.current.paused) {
        await playCurrentAudio();
        return;
      }
      audioRef.current.pause();
      setPlaying(false);
      return;
    }

    if (canRequestAudio(currentCourse.status)) {
      await requestAndPollAudio();
    }
  }

  async function handleTimeUpdate(event: React.SyntheticEvent<HTMLAudioElement>) {
    const nextTime = event.currentTarget.currentTime;
    setCurrentTime(nextTime);
    if (Math.abs(nextTime - lastSavedSecondRef.current) >= 10) {
      lastSavedSecondRef.current = nextTime;
      await savePlaybackProgress({
        courseId: currentCourse.id,
        positionSeconds: nextTime,
        sentenceIndex: activeSentenceIndex
      });
    }
  }

  const fallbackMarkdown = currentCourse.sentences.map((sentence) => sentence.text).join("\n\n");
  const readerMarkdown = currentCourse.content_markdown || fallbackMarkdown;
  const readerOutline = currentCourse.outline ?? outline;
  const hasAudio = currentCourse.status === "ready";
  const audioSource = currentCourse.current_audio_url ? mediaUrl(currentCourse.current_audio_url) : courseAudioUrl(currentCourse.id);
  const activeSentence = currentCourse.sentences.find((sentence) => sentence.index === activeSentenceIndex);
  const totalDuration = durationSeconds || currentCourse.duration_seconds || 0;
  const progressValue = totalDuration > 0 ? Math.min(currentTime, totalDuration) : 0;
  const canStartAudio = canRequestAudio(currentCourse.status);
  const source = currentCourse.source;
  const canonicalLocator = source?.canonical_locator || "";
  const canonicalLocatorIsLink = /^https?:\/\//i.test(canonicalLocator);
  const shouldShowSourceInfo = showSourceInfo && source != null;

  return (
    <div
      className={isPlayerCollapsed ? "space-y-5 pb-20" : "space-y-5 pb-28 md:pb-32"}
      data-reader-preferences
      data-font-size={preferences.fontSize}
      data-line-height={preferences.lineHeight}
    >
      {showReaderPreferencesSection ? (
        <section
          aria-label={dictionary.reading.readerPreferences}
          className="flex flex-col gap-3 rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] p-3 text-xs text-[var(--pa-muted)] sm:flex-row sm:items-center sm:justify-between"
        >
          <ReaderPreferencesControls locale={locale} onChange={updatePreferences} preferences={preferences} />
        </section>
      ) : null}

      {shouldShowSourceInfo ? (
        <div className="rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] p-3 text-xs text-[var(--pa-muted)]">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {source?.source_domain ? <span>{source.source_domain}</span> : null}
            {source?.author ? <span>{source.author}</span> : null}
            {source?.published_at ? <span>{source.published_at}</span> : null}
            {source?.original_filename ? <span>{source.original_filename}</span> : null}
            {source?.relative_path ? <span>{source.relative_path}</span> : null}
            {source?.content_type ? <span>{source.content_type}</span> : null}
            {source?.byte_size != null ? <span>{source.byte_size} B</span> : null}
            {source?.canonical_locator ? (
              canonicalLocatorIsLink ? (
                <a className="text-[var(--pa-green)] underline" href={canonicalLocator} rel="noreferrer" target="_blank">
                  {canonicalLocator}
                </a>
              ) : (
                <span>{canonicalLocator}</span>
              )
            ) : null}
          </div>
        </div>
      ) : null}

      {readerMarkdown ? (
        <MarkdownReader
          markdown={readerMarkdown}
          sentences={currentCourse.sentences}
          activeSentenceIndex={activeSentenceIndex}
          onSelectSentence={seekToSentence}
          outline={readerOutline}
          fontSize={preferences.fontSize}
          lineHeight={preferences.lineHeight}
        />
      ) : null}

      {!readerMarkdown && !hasAudio ? (
        <div className="rounded-lg border border-dashed border-[var(--pa-line)] bg-[var(--pa-surface)] p-4">
          <p className="text-sm font-medium text-[var(--pa-ink)]">
            {canStartAudio ? dictionary.detail.textReadyTitle : dictionary.detail.reviewTitle}
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--pa-muted)]">
            {canStartAudio ? playbackMessage || dictionary.detail.textReadyBody : dictionary.detail.reviewBody}
          </p>
        </div>
      ) : null}

      {hasAudio ? (
        <audio
          ref={audioRef}
          className="hidden"
          src={audioSource}
          onLoadedMetadata={(event) => setDurationSeconds(event.currentTarget.duration || currentCourse.duration_seconds)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          onTimeUpdate={handleTimeUpdate}
        />
      ) : null}

      {isPlayerCollapsed ? (
        <button
          aria-label={dictionary.player.expand}
          className="pa-focus fixed bottom-4 right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--pa-green)] text-white shadow-[0_14px_34px_rgba(17,17,17,0.22)] transition hover:-translate-y-0.5 supports-[padding:max(0px)]:bottom-[max(1rem,env(safe-area-inset-bottom))]"
          data-course-player="mini"
          onClick={() => setPlayerCollapsed(false)}
          title={dictionary.player.expand}
          type="button"
        >
          <PlayIcon className="h-6 w-6 translate-x-0.5" />
        </button>
      ) : (
        <section
          data-course-player="reading-dock"
          className="sticky bottom-3 z-30 rounded-xl border border-[var(--pa-line)] bg-[var(--pa-surface)] p-3 shadow-[0_14px_40px_rgba(17,17,17,0.14)] backdrop-blur supports-[padding:max(0px)]:mb-[max(0rem,env(safe-area-inset-bottom))]"
        >
        <button
          aria-label={dictionary.player.collapse}
          className="pa-focus absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--pa-line)] bg-[var(--pa-surface)] text-[var(--pa-muted)] shadow-sm transition hover:border-[var(--pa-green)] hover:text-[var(--pa-green)]"
          onClick={() => setPlayerCollapsed(true)}
          title={dictionary.player.collapse}
          type="button"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
        <div className="flex flex-col gap-3">
          {!hasAudio ? (
            <div className="rounded-lg border border-dashed border-[var(--pa-line)] bg-[var(--pa-surface)] p-3">
              <p className="text-sm font-medium text-[var(--pa-ink)]">
                {canStartAudio ? dictionary.detail.textReadyTitle : dictionary.detail.reviewTitle}
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--pa-muted)]">
                {canStartAudio ? playbackMessage || dictionary.detail.textReadyBody : dictionary.detail.reviewBody}
              </p>
            </div>
          ) : null}

          {hasAudio ? (
            <>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 pr-8">
                    <p className="truncate text-sm font-semibold text-[var(--pa-ink)]">{currentCourse.title}</p>
                    <p className="truncate text-xs text-[var(--pa-muted)]">
                      {activeSentence?.text ?? dictionary.player.unavailable}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-[var(--pa-muted)]">
                    {dictionary.player.speed}
                    <select
                      aria-label={dictionary.player.speed}
                      className="pa-focus rounded-md border border-[var(--pa-line)] bg-[var(--pa-surface)] px-2 py-1 text-xs text-[var(--pa-ink)]"
                      onChange={(event) => updatePreferences({ playbackRate: Number(event.target.value) })}
                      value={preferences.playbackRate}
                    >
                      {playbackRates.map((rate) => (
                        <option key={rate} value={rate}>
                          {rate}x
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
                  <div className="flex items-center justify-center gap-2 sm:justify-start">
                    <button
                      aria-label={dictionary.player.rewind}
                      className="pa-focus inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--pa-line)] bg-[var(--pa-muted-surface)] text-sm font-semibold text-[var(--pa-muted)]"
                      onClick={() => seekBy(-10)}
                      type="button"
                    >
                      -10
                    </button>
                    <button
                      className="pa-focus inline-flex h-11 min-w-20 items-center justify-center rounded-full bg-[var(--pa-green)] px-4 text-sm font-semibold text-white"
                      onClick={togglePlayback}
                      type="button"
                    >
                      {isPlaying ? dictionary.player.pause : dictionary.player.play}
                    </button>
                    <button
                      aria-label={dictionary.player.forward}
                      className="pa-focus inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--pa-line)] bg-[var(--pa-muted-surface)] text-sm font-semibold text-[var(--pa-muted)]"
                      onClick={() => seekBy(10)}
                      type="button"
                    >
                      +10
                    </button>
                  </div>
                  <div className="grid gap-1">
                    <input
                      aria-label={dictionary.player.progress}
                      className="w-full"
                      max={totalDuration}
                      min={0}
                      onChange={(event) => seekToTime(Number(event.target.value))}
                      step={0.1}
                      type="range"
                      value={progressValue}
                    />
                    <div className="flex justify-between text-xs text-[var(--pa-muted)]">
                      <span>{formatDuration(currentTime)}</span>
                      <span>{formatDuration(totalDuration)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            canStartAudio ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--pa-ink)]">{currentCourse.title}</p>
                    <p className="mt-1 text-xs text-[var(--pa-muted)]">{playbackMessage || dictionary.detail.textReadyBody}</p>
                  </div>
                  <button
                    className="pa-focus inline-flex h-11 min-w-20 items-center justify-center rounded-full bg-[var(--pa-green)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                    disabled={playbackPhase === "waiting"}
                    onClick={() => requestAndPollAudio()}
                    type="button"
                  >
                    {playbackPhase === "waiting" ? dictionary.detail.lazyGenerating : dictionary.player.play}
                  </button>
                </div>
              </div>
            ) : null
          )}
        </div>
      </section>
      )}
    </div>
  );
}
