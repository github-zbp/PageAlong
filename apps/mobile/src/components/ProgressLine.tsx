import { View } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  progress: number;
  color?: string;
  trackColor?: string;
};

export function ProgressLine({ progress, color, trackColor }: Props) {
  const { tokens } = useTheme();
  const value = Math.min(1, Math.max(0, progress));

  return (
    <View
      accessibilityLabel={`${Math.round(value * 100)}%`}
      style={{ height: 4, overflow: "hidden", borderRadius: 2, backgroundColor: trackColor ?? tokens.border }}
    >
      <View style={{ width: `${value * 100}%`, height: "100%", backgroundColor: color ?? tokens.accent }} />
    </View>
  );
}

export default ProgressLine;
