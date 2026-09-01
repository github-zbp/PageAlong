import { Modal, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatPlayerTime } from "@/lib/player";
import { usePlayback } from "@/providers/PlaybackProvider";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  visible: boolean;
  onClose: () => void;
  labels: {
    closePlayer: string;
    play: string;
    pause: string;
    back10: string;
    forward10: string;
    currentSentence: string;
    speed: string;
  };
};

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function Stepper({
  value,
  duration,
  onSeek
}: {
  value: number;
  duration: number;
  onSeek: (nextSeconds: number) => void;
}) {
  const { tokens } = useTheme();

  return (
    <View style={{ flexDirection: "row", gap: 4, height: 10 }}>
      {Array.from({ length: 20 }, (_, index) => {
        const ratio = index / 19;
        const active = duration > 0 ? ratio <= value / duration : index === 0;
        return (
          <Pressable
            key={index}
            accessibilityRole="button"
            onPress={() => onSeek(duration * ratio)}
            style={{
              flex: 1,
              borderRadius: 999,
              backgroundColor: active ? tokens.accent : tokens.border
            }}
          />
        );
      })}
    </View>
  );
}

export function FullScreenPlayer({ visible, onClose, labels }: Props) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const playback = usePlayback();
  const { track, currentTime, duration, playing, toggle, seekBy, seekTo, rate, setRate, activeSentenceIndex } = playback;

  if (!track) {
    return null;
  }

  const currentSentence = track.sentences.find((sentence) => sentence.index === activeSentenceIndex);

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" visible={visible} onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: tokens.background,
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom, 16),
          paddingHorizontal: 18,
          gap: 18
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable accessibilityRole="button" accessibilityLabel={labels.closePlayer} hitSlop={10} onPress={onClose}>
            <Feather name="chevron-down" size={22} color={tokens.text} />
          </Pressable>
          <Text numberOfLines={1} style={{ color: tokens.mutedText, fontSize: 12, maxWidth: "70%" }}>
            {formatPlayerTime(currentTime)} / {formatPlayerTime(duration)}
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text numberOfLines={2} style={{ color: tokens.text, fontSize: 28, fontWeight: "700", lineHeight: 34 }}>
            {track.title}
          </Text>
          {currentSentence ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: tokens.mutedText, fontSize: 12 }}>{labels.currentSentence}</Text>
              <View
                style={{
                  borderLeftWidth: 2,
                  borderLeftColor: tokens.highlight,
                  backgroundColor: `${tokens.highlight}18`,
                  borderRadius: 10,
                  paddingVertical: 12,
                  paddingHorizontal: 12
                }}
              >
                <Text style={{ color: tokens.text, fontSize: 15, lineHeight: 23 }}>{currentSentence.text}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={{ gap: 12 }}>
          <Stepper value={currentTime} duration={duration} onSeek={(nextSeconds) => void seekTo(nextSeconds)} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: tokens.mutedText, fontSize: 12 }}>{formatPlayerTime(currentTime)}</Text>
            <Text style={{ color: tokens.mutedText, fontSize: 12 }}>{formatPlayerTime(duration)}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, paddingVertical: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={labels.back10}
            hitSlop={10}
            onPress={() => void seekBy(-10)}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tokens.elevatedSurface
            }}
          >
            <Feather name="rotate-ccw" size={20} color={tokens.text} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? labels.pause : labels.play}
            onPress={toggle}
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tokens.accent
            }}
          >
            <Feather name={playing ? "pause" : "play"} size={26} color={tokens.surface} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={labels.forward10}
            hitSlop={10}
            onPress={() => void seekBy(10)}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tokens.elevatedSurface
            }}
          >
            <Feather name="rotate-cw" size={20} color={tokens.text} />
          </Pressable>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ color: tokens.mutedText, fontSize: 12 }}>{labels.speed}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {SPEEDS.map((speed) => {
              const selected = rate === speed;
              return (
                <Pressable
                  key={speed}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setRate(speed)}
                  style={{
                    minWidth: 64,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: selected ? tokens.accent : tokens.border,
                    backgroundColor: selected ? tokens.accent : tokens.elevatedSurface,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    alignItems: "center"
                  }}
                >
                  <Text style={{ color: selected ? tokens.surface : tokens.text, fontSize: 14, fontWeight: "600" }}>
                    {speed === 1 ? "1.0x" : `${speed}x`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default FullScreenPlayer;
