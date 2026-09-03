import { useRef, useState, type ComponentProps } from "react";
import { Feather } from "@expo/vector-icons";
import { LayoutRectangle, Pressable, Text, useWindowDimensions, View } from "react-native";
import type { WorkbenchCopy } from "@/lib/i18n";
import { useTheme } from "@/providers/ThemeProvider";

type IconName = ComponentProps<typeof Feather>["name"];

const STEP_ICONS: IconName[] = ["plus", "clock", "book-open", "layers"];

type Props = {
  copy: WorkbenchCopy["onboarding"];
  visible: boolean;
  anchorLayout?: LayoutRectangle | null;
  onComplete: () => void;
  onStepChange?: (stepIndex: number) => void;
};

export function WorkbenchOnboardingSheet({ copy, anchorLayout, onComplete, onStepChange, visible }: Props) {
  const { tokens } = useTheme();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const transitionLockedRef = useRef(false);

  if (!visible) {
    return null;
  }

  const currentStep = copy.steps[activeIndex] ?? copy.steps[0];
  const isLastStep = activeIndex >= copy.steps.length - 1;
  const iconName = STEP_ICONS[activeIndex] ?? STEP_ICONS[STEP_ICONS.length - 1];
  const estimatedCardHeight = 300;
  const cardTop = anchorLayout
    ? anchorLayout.y + anchorLayout.height + 12 + estimatedCardHeight > windowHeight
      ? Math.max(16, anchorLayout.y - estimatedCardHeight - 12)
      : anchorLayout.y + anchorLayout.height + 12
    : 120;
  const hole = anchorLayout
    ? {
        x: Math.max(0, anchorLayout.x),
        y: Math.max(0, anchorLayout.y),
        width: Math.max(0, anchorLayout.width),
        height: Math.max(0, anchorLayout.height)
      }
    : null;
  const holeRight = hole ? Math.min(windowWidth, hole.x + hole.width) : 0;
  const holeBottom = hole ? Math.min(windowHeight, hole.y + hole.height) : 0;

  const releaseTransitionLock = () => {
    setTimeout(() => {
      transitionLockedRef.current = false;
    }, 50);
  };

  const handlePrimaryPress = () => {
    if (transitionLockedRef.current) {
      return;
    }
    transitionLockedRef.current = true;
    if (isLastStep) {
      onComplete();
      releaseTransitionLock();
      return;
    }
    const next = Math.min(activeIndex + 1, copy.steps.length - 1);
    setActiveIndex(next);
    setTimeout(() => {
      onStepChange?.(next);
    }, 0);
    releaseTransitionLock();
  };

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 1000
      }}
    >
      {hole ? (
        <>
          <Pressable
            accessibilityLabel="关闭引导遮罩"
            onPress={onComplete}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: hole.y,
              backgroundColor: "rgba(0,0,0,0.56)"
            }}
          />
          <Pressable
            accessibilityLabel="关闭引导遮罩"
            onPress={onComplete}
            style={{
              position: "absolute",
              top: hole.y,
              left: 0,
              width: hole.x,
              height: hole.height,
              backgroundColor: "rgba(0,0,0,0.56)"
            }}
          />
          <Pressable
            accessibilityLabel="关闭引导遮罩"
            onPress={onComplete}
            style={{
              position: "absolute",
              top: hole.y,
              left: holeRight,
              right: 0,
              height: hole.height,
              backgroundColor: "rgba(0,0,0,0.56)"
            }}
          />
          <Pressable
            accessibilityLabel="关闭引导遮罩"
            onPress={onComplete}
            style={{
              position: "absolute",
              top: holeBottom,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.56)"
            }}
          />
          <View
            testID={`workbench-guide-target-${currentStep.target}`}
            pointerEvents="none"
            style={{
              position: "absolute",
              top: hole.y,
              left: hole.x,
              width: hole.width,
              height: hole.height,
              borderRadius: 14,
              borderWidth: 3,
              borderColor: tokens.highlight,
              backgroundColor: "rgba(215, 180, 106, 0.08)",
              shadowColor: tokens.highlight,
              shadowOpacity: 0.45,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 0 }
            }}
          />
        </>
      ) : (
        <Pressable
          accessibilityLabel="关闭引导遮罩"
          onPress={onComplete}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: "rgba(0,0,0,0.56)"
          }}
        />
      )}

      <View
        testID="workbench-guide-card"
        accessibilityLabel={copy.title}
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          top: cardTop,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: tokens.border,
          backgroundColor: tokens.surface,
          padding: 18,
          gap: 14
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: tokens.text, fontSize: 20, fontWeight: "700" }}>{copy.title}</Text>
            <Text style={{ color: tokens.mutedText, fontSize: 13, lineHeight: 19 }}>{copy.subtitle}</Text>
          </View>
          <Text style={{ color: tokens.mutedText, fontSize: 12, fontWeight: "600" }}>
            {copy.stepLabel(activeIndex + 1, copy.steps.length)}
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <View
            style={{
              width: 52,
              height: 52,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 18,
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: tokens.elevatedSurface
            }}
          >
            <Feather name={iconName} size={22} color={tokens.accent} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={{ color: tokens.text, fontSize: 18, fontWeight: "700" }}>{currentStep.title}</Text>
            <Text style={{ color: tokens.mutedText, fontSize: 14, lineHeight: 21 }}>{currentStep.body}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          {copy.steps.map((step, index) => (
            <View
              key={step.key}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 999,
                backgroundColor: index <= activeIndex ? tokens.accent : tokens.border,
                opacity: index === activeIndex ? 1 : 0.5
              }}
            />
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={handlePrimaryPress}
          style={({ pressed }) => ({
            minHeight: 46,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderRadius: 14,
            backgroundColor: tokens.accent,
            opacity: pressed ? 0.82 : 1
          })}
        >
          <Text style={{ color: tokens.surface, fontSize: 16, fontWeight: "700" }}>
            {isLastStep ? copy.complete : copy.next}
          </Text>
          <Feather name="arrow-right" size={16} color={tokens.surface} />
        </Pressable>
      </View>
    </View>
  );
}

export default WorkbenchOnboardingSheet;
