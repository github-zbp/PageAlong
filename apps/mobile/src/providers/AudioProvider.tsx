import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { canUseBackgroundPlayback, configureBackgroundAudio } from "@/lib/audio";

type AudioContextValue = {
  ready: boolean;
};

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void configureBackgroundAudio(canUseBackgroundPlayback())
      .catch(() => undefined)
      .finally(() => {
        setReady(true);
      });
  }, []);

  return <AudioContext.Provider value={{ ready }}>{children}</AudioContext.Provider>;
}

export function useAudio() {
  const value = useContext(AudioContext);
  if (!value) {
    throw new Error("useAudio must be used inside AudioProvider");
  }
  return value;
}
