import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { formatPlayerTime } from "@/lib/player";
import { usePlayback } from "@/providers/PlaybackProvider";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  visible: boolean;
  collapsed: boolean;
  bottomOffset?: number;
  onExpand: () => void;
  onCollapse: () => void;
  onRestore: () => void;
  expandLabel: string;
  closeLabel: string;
  restoreLabel: string;
  playLabel: string;
  pauseLabel: string;
};

export function FloatingPlayer({
  visible,
  collapsed,
  bottomOffset = 16,
  onExpand,
  onCollapse,
  onRestore,
  expandLabel,
  closeLabel,
  restoreLabel,
  playLabel,
  pauseLabel
}: Props) {
  const { tokens } = useTheme();
  const playback = usePlayback();
  const { track, currentTime, duration, playing, toggle } = playback;

  if (!track) {
    return null;
  }

  const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;

  if (collapsed) {
    return (
      <View
        pointerEvents={visible ? "auto" : "none"}
        style={{
          position: "absolute",
          right: 16,
          bottom: bottomOffset,
          opacity: visible ? 1 : 0,
          transform: [{ translateY: visible ? 0 : 12 }]
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={restoreLabel}
          onPress={onRestore}
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 22,
            borderWidth: 1,
            borderColor: tokens.border,
            backgroundColor: tokens.accent
          }}
        >
          <Feather name="chevron-up" size={20} color={tokens.surface} />
        </Pressable>
      </View>
    );
  }

  return (
    <View
      pointerEvents={visible ? "auto" : "none"}
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: bottomOffset,
        opacity: visible ? 1 : 0,
        transform: [{ translateY: visible ? 0 : 12 }]
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expandLabel}
        onPress={onExpand}
        style={{
          overflow: "hidden",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: tokens.border,
          backgroundColor: tokens.elevatedSurface,
          padding: 10,
          paddingTop: 26
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          hitSlop={10}
          onPress={(event) => {
            event.stopPropagation();
            onCollapse();
          }}
          style={{
            position: "absolute",
            right: 10,
            top: 10,
            width: 24,
            height: 24,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Feather name="x" size={18} color={tokens.mutedText} />
        </Pressable>
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 2,
            backgroundColor: tokens.border
          }}
        />
        <View
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            height: 2,
            width: `${Math.round(progress * 100)}%`,
            backgroundColor: tokens.accent
          }}
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? pauseLabel : playLabel}
            hitSlop={10}
            onPress={(event) => {
              event.stopPropagation();
              toggle();
            }}
            style={{
              width: 34,
              height: 34,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 17,
              backgroundColor: `${tokens.accent}18`
            }}
          >
            <Feather name={playing ? "pause" : "play"} size={18} color={tokens.accent} />
          </Pressable>

          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text numberOfLines={1} style={{ color: tokens.text, fontSize: 14, fontWeight: "600" }}>
              {track.title}
            </Text>
            <Text numberOfLines={1} style={{ color: tokens.mutedText, fontSize: 12 }}>
              {formatPlayerTime(currentTime)} / {formatPlayerTime(duration)}
            </Text>
          </View>

          <Feather name="chevron-up" size={18} color={tokens.mutedText} />
        </View>
      </Pressable>
    </View>
  );
}

export default FloatingPlayer;
