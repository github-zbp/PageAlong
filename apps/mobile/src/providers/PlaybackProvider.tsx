import {
  createAudioPlayer,
  useAudioPlayerStatus,
  type AudioStatus
} from "expo-audio";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from "react";
import { mediaUrl, requestCourseAudioGeneration, savePlaybackProgress, getCourse } from "@/lib/api";
import { useAudio } from "@/providers/AudioProvider";
import { canUseBackgroundPlayback } from "@/lib/audio";
import { defaultReaderPreferences, loadReaderPreferences, saveReaderPreferences } from "@/lib/preferences";
import { activeSentenceIndexAt, clampSeekTime, shouldSaveProgress } from "@/lib/player";
import type { Course } from "@/lib/api";

type PlaybackContextValue = {
  track: Course | null;
  currentTime: number;
  duration: number;
  playing: boolean;
  rate: number;
  activeSentenceIndex: number;
  status: AudioStatus;
  loadCourse: (course: Course) => void;
  toggle: () => void;
  seekTo: (seconds: number) => Promise<void>;
  seekBy: (deltaSeconds: number) => Promise<void>;
  setRate: (rate: number) => void;
  requestAudioGeneration: (courseId: string) => Promise<Course | null>;
};

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

const LOCK_SCREEN_ARTIST = "页相随 PageAlong";

export function PlaybackProvider({ children }: PropsWithChildren) {
  const [player] = useState(() => createAudioPlayer(null, { updateInterval: 500 }));
  const status = useAudioPlayerStatus(player);
  const { ready: audioReady } = useAudio();
  const [track, setTrack] = useState<Course | null>(null);
  const [rate, setRateState] = useState(defaultReaderPreferences.playbackRate);
  const trackRef = useRef<Course | null>(null);
  const lastSavedSecondRef = useRef(0);
  const pendingInitialSeekRef = useRef<number | null>(null);
  const preferencesRef = useRef(defaultReaderPreferences);
  const canActivateLockScreenControls = canUseBackgroundPlayback() && audioReady;

  useEffect(() => {
    let active = true;

    void loadReaderPreferences()
      .then((preferences) => {
        if (!active) {
          return;
        }
        preferencesRef.current = preferences;
        setRateState(preferences.playbackRate);
        player.setPlaybackRate(preferences.playbackRate);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [player]);

  useEffect(() => {
    return () => {
      player.clearLockScreenControls();
      player.remove();
    };
  }, [player]);

  const persistProgress = useCallback(
    async (nextSecond: number) => {
      const currentTrack = trackRef.current;
      if (!currentTrack || !currentTrack.current_audio_url) {
        return;
      }
      if (!shouldSaveProgress({ lastSavedSecond: lastSavedSecondRef.current, nextSecond })) {
        return;
      }
      lastSavedSecondRef.current = nextSecond;
      await savePlaybackProgress({
        courseId: currentTrack.id,
        positionSeconds: nextSecond,
        sentenceIndex: activeSentenceIndexAt(currentTrack.sentences, nextSecond)
      }).catch(() => undefined);
    },
    []
  );

  const activateLockScreenControls = useCallback(
    (course: Course) => {
      if (!canActivateLockScreenControls) {
        return;
      }

      try {
        player.setActiveForLockScreen(
          true,
          {
            title: course.title,
            artist: LOCK_SCREEN_ARTIST
          },
          {
            showSeekForward: true,
            showSeekBackward: true
          }
        );
      } catch {
        // Expo Go cannot bind the native playback service, so lock screen
        // controls stay optional there.
      }
    },
    [canActivateLockScreenControls, player]
  );

  useEffect(() => {
    if (!canActivateLockScreenControls) {
      return;
    }

    const currentTrack = track;
    if (!currentTrack?.current_audio_url) {
      return;
    }

    activateLockScreenControls(currentTrack);
  }, [activateLockScreenControls, canActivateLockScreenControls, track]);

  const loadCourse = useCallback(
    (course: Course) => {
      trackRef.current = course;
      setTrack(course);
      lastSavedSecondRef.current = course.last_playback_position_seconds;

      const audioUrl = course.current_audio_url ? mediaUrl(course.current_audio_url) : null;
      if (!audioUrl) {
        pendingInitialSeekRef.current = null;
        player.clearLockScreenControls();
        return;
      }

      player.replace({ uri: audioUrl });
      player.setPlaybackRate(rate);

      const resumeAt = clampSeekTime(course.last_playback_position_seconds, course.duration_seconds);
      if (resumeAt > 0) {
        pendingInitialSeekRef.current = resumeAt;
        void player.seekTo(resumeAt).catch(() => undefined);
      } else {
        pendingInitialSeekRef.current = null;
      }
    },
    [player, rate]
  );

  const toggle = useCallback(() => {
    const currentTrack = trackRef.current;
    if (!currentTrack?.current_audio_url) {
      return;
    }
    if (status.playing) {
      player.pause();
      return;
    }
    const currentSecond = status.currentTime ?? 0;
    const duration = status.duration > 0 ? status.duration : currentTrack.duration_seconds;
    if (status.didJustFinish || (duration > 0 && currentSecond >= duration)) {
      pendingInitialSeekRef.current = null;
      void player
        .seekTo(0)
        .catch(() => undefined)
        .finally(() => {
          player.play();
        });
      return;
    }
    player.play();
  }, [player, status.currentTime, status.didJustFinish, status.duration, status.playing]);

  const seekTo = useCallback(
    async (seconds: number) => {
      const currentTrack = trackRef.current;
      if (!currentTrack?.current_audio_url) {
        return;
      }
      const duration = status.duration > 0 ? status.duration : currentTrack.duration_seconds;
      const nextSecond = clampSeekTime(seconds, duration);
      await player.seekTo(nextSecond);
      pendingInitialSeekRef.current = null;
      await persistProgress(nextSecond);
    },
    [persistProgress, player, status.duration]
  );

  const seekBy = useCallback(
    async (deltaSeconds: number) => {
      await seekTo((status.currentTime ?? 0) + deltaSeconds);
    },
    [seekTo, status.currentTime]
  );

  const setRate = useCallback(
    (nextRate: number) => {
      setRateState(nextRate);
      preferencesRef.current = {
        ...preferencesRef.current,
        playbackRate: nextRate
      };
      player.setPlaybackRate(nextRate);
      void saveReaderPreferences(preferencesRef.current).catch(() => undefined);
    },
    [player]
  );

  const requestAudioGeneration = useCallback(
    async (courseId: string) => {
      try {
        await requestCourseAudioGeneration(courseId);
        const refreshed = await getCourse(courseId);
        setTrack(refreshed);
        trackRef.current = refreshed;
        return refreshed;
      } catch {
        return null;
      }
    },
    []
  );

  useEffect(() => {
    const currentTrack = trackRef.current;
    if (!currentTrack) {
      return;
    }

    const currentSecond = status.currentTime ?? 0;
    if (pendingInitialSeekRef.current != null) {
      if (Math.abs(currentSecond - pendingInitialSeekRef.current) > 1) {
        return;
      }
      pendingInitialSeekRef.current = null;
    }

    if (!shouldSaveProgress({ lastSavedSecond: lastSavedSecondRef.current, nextSecond: currentSecond })) {
      return;
    }

    void persistProgress(currentSecond);
  }, [persistProgress, status.currentTime]);

  const currentTime = status.currentTime ?? track?.last_playback_position_seconds ?? 0;
  const duration = status.duration > 0 ? status.duration : track?.duration_seconds ?? 0;
  const activeSentenceIndex = useMemo(
    () => activeSentenceIndexAt(track?.sentences ?? [], currentTime),
    [currentTime, track]
  );

  const value = useMemo<PlaybackContextValue>(
    () => ({
      track,
      currentTime,
      duration,
      playing: status.playing,
      rate,
      activeSentenceIndex,
      status,
      loadCourse,
      toggle,
      seekTo,
      seekBy,
      setRate,
      requestAudioGeneration
    }),
    [activeSentenceIndex, currentTime, duration, loadCourse, rate, requestAudioGeneration, seekBy, seekTo, setRate, status, toggle, track]
  );

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

export function usePlayback() {
  const value = useContext(PlaybackContext);
  if (!value) {
    throw new Error("usePlayback must be used inside PlaybackProvider");
  }
  return value;
}
