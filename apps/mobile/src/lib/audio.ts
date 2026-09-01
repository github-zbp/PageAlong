import * as Constants from "expo-constants";

export function canUseBackgroundPlayback(): boolean {
  return (Constants as { appOwnership?: string | null }).appOwnership !== "expo";
}

export async function configureBackgroundAudio(enableBackgroundPlayback = true): Promise<void> {
  const { setAudioModeAsync } = require("expo-audio") as {
    setAudioModeAsync: (mode: {
      playsInSilentMode: boolean;
      shouldPlayInBackground: boolean;
      interruptionMode: string;
    }) => Promise<void>;
  };

  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: enableBackgroundPlayback,
    interruptionMode: "doNotMix"
  });
}
