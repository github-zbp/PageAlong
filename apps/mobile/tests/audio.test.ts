jest.mock(
  "expo-audio",
  () => ({
    setAudioModeAsync: jest.fn()
  }),
  { virtual: true }
);

const { setAudioModeAsync } = require("expo-audio");

import { configureBackgroundAudio } from "@/lib/audio";

beforeEach(() => {
  jest.clearAllMocks();
});

it("enables background audio mode with expo-audio", async () => {
  (setAudioModeAsync as jest.Mock).mockResolvedValueOnce(undefined);

  await configureBackgroundAudio(true);

  expect(setAudioModeAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix"
    })
  );
});

it("disables background playback in Expo Go", async () => {
  (setAudioModeAsync as jest.Mock).mockResolvedValueOnce(undefined);

  await configureBackgroundAudio(false);

  expect(setAudioModeAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "doNotMix"
    })
  );
});
