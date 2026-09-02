import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { BrandMark } from "@/components/BrandMark";
import { Screen } from "@/components/Screen";
import { getAuthCopy } from "@/lib/i18n";
import { useLocalePreference } from "@/lib/locale";
import { useTheme } from "@/providers/ThemeProvider";

type SlideVariant = "read" | "collect";

type Slide = {
  key: string;
  title: string;
  description: string;
  variant: SlideVariant;
};

function SlideArtwork({ variant }: { variant: SlideVariant }) {
  const { tokens } = useTheme();
  const collect = variant === "collect";
  const accent = collect ? "#7E7CF5" : "#4F73FF";
  const soft = collect ? "#F6E6D8" : "#E9DDFF";
  const ink = collect ? "#322E2A" : "#2B2440";
  const mark = collect ? "#E88D44" : "#FF8A4C";

  return (
    <View
      style={{
        minHeight: 300,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: tokens.elevatedSurface,
        padding: 18,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.22,
        shadowRadius: 24,
        elevation: 4
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 18,
          left: collect ? 18 : 20,
          width: collect ? 148 : 126,
          height: collect ? 92 : 126,
          borderRadius: 28,
          backgroundColor: accent,
          transform: [{ rotate: collect ? "-4deg" : "-7deg" }]
        }}
      />
      <View
        style={{
          position: "absolute",
          top: collect ? 34 : 34,
          left: collect ? 34 : 36,
          width: collect ? 62 : 72,
          height: collect ? 62 : 72,
          borderRadius: 31,
          backgroundColor: tokens.background,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ rotate: collect ? "5deg" : "-4deg" }]
        }}
      >
        <Feather name={collect ? "archive" : "book-open"} size={24} color={tokens.text} />
      </View>
      <View
        style={{
          position: "absolute",
          top: 22,
          right: 18,
          width: 152,
          height: 100,
          borderRadius: 24,
          backgroundColor: soft,
          paddingHorizontal: 14,
          paddingTop: 16,
          gap: 12,
          transform: [{ rotate: collect ? "2deg" : "4deg" }]
        }}
      >
        <View style={{ width: 14, height: 14, borderRadius: 5, backgroundColor: mark }} />
        <View style={{ gap: 8 }}>
          <View style={{ height: 3, borderRadius: 999, backgroundColor: ink, opacity: 0.65, width: "88%" }} />
          <View style={{ height: 3, borderRadius: 999, backgroundColor: ink, opacity: 0.65, width: "64%" }} />
        </View>
      </View>
      <View
        style={{
          position: "absolute",
          right: collect ? 20 : 30,
          bottom: collect ? 22 : 20,
          width: collect ? 128 : 142,
          height: collect ? 120 : 114,
          borderRadius: 24,
          backgroundColor: tokens.background,
          borderWidth: 1,
          borderColor: tokens.border,
          padding: 14,
          justifyContent: "space-between",
          transform: [{ rotate: collect ? "5deg" : "-4deg" }]
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Feather name={collect ? "mail" : "clock"} size={18} color={tokens.text} />
          <Feather name="star" size={14} color={mark} />
        </View>
        <View style={{ gap: 8 }}>
          <View style={{ height: 3, borderRadius: 999, backgroundColor: tokens.mutedText, opacity: 0.7, width: "92%" }} />
          <View style={{ height: 3, borderRadius: 999, backgroundColor: tokens.mutedText, opacity: 0.7, width: "70%" }} />
          <View style={{ height: 3, borderRadius: 999, backgroundColor: tokens.mutedText, opacity: 0.55, width: "52%" }} />
        </View>
      </View>
      <View
        style={{
          position: "absolute",
          left: collect ? 30 : 18,
          bottom: collect ? 26 : 20,
          width: collect ? 152 : 162,
          height: collect ? 88 : 98,
          borderRadius: 22,
          backgroundColor: tokens.surface,
          borderWidth: 1,
          borderColor: tokens.border,
          padding: 14,
          gap: 10,
          transform: [{ rotate: collect ? "-8deg" : "6deg" }]
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: mark, opacity: 0.9 }} />
          <View style={{ height: 4, borderRadius: 999, backgroundColor: tokens.text, opacity: 0.85, width: "42%" }} />
        </View>
        <View style={{ gap: 7 }}>
          <View style={{ height: 3, borderRadius: 999, backgroundColor: tokens.mutedText, opacity: 0.7, width: "84%" }} />
          <View style={{ height: 3, borderRadius: 999, backgroundColor: tokens.mutedText, opacity: 0.55, width: "66%" }} />
        </View>
      </View>
      <View
        style={{
          position: "absolute",
          top: collect ? 140 : 138,
          right: collect ? 72 : 64,
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: mark,
          opacity: 0.95,
          transform: [{ rotate: "14deg" }]
        }}
      />
      <View
        style={{
          position: "absolute",
          top: collect ? 174 : 170,
          right: collect ? 50 : 42,
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: mark,
          opacity: 0.9
        }}
      />
    </View>
  );
}

function StartSlide({ slide, width }: { slide: Slide; width: number }) {
  const { tokens } = useTheme();

  return (
    <View style={{ width, gap: 18 }}>
      <SlideArtwork variant={slide.variant} />
      <View style={{ gap: 10 }}>
        <Text style={{ color: tokens.text, fontSize: 34, lineHeight: 40, fontWeight: "700" }}>{slide.title}</Text>
        <Text style={{ color: tokens.mutedText, fontSize: 16, lineHeight: 24 }}>{slide.description}</Text>
      </View>
    </View>
  );
}

export default function StartScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const locale = useLocalePreference();
  const copy = getAuthCopy(locale);
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const slideWidth = Math.max(0, width - 32);
  const slides: Slide[] = copy.start.slides;

  const dots = useMemo(
    () =>
      slides.map((slide, index) => (
        <Pressable
          key={slide.key}
          accessibilityRole="button"
          accessibilityLabel={copy.start.accessibilityLabel(index + 1)}
          onPress={() => scrollRef.current?.scrollTo({ x: index * slideWidth, animated: true })}
          style={{
            width: activeIndex === index ? 18 : 8,
            height: 8,
            borderRadius: 999,
            backgroundColor: activeIndex === index ? tokens.accent : tokens.border
          }}
        />
      )),
    [activeIndex, copy.start, slideWidth, tokens.accent, tokens.border]
  );

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "space-between", paddingTop: 4, paddingBottom: 10, gap: 24 }}>
        <View style={{ gap: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: tokens.surface,
                borderWidth: 1,
                borderColor: tokens.border,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden"
              }}
            >
              <BrandMark size={28} />
            </View>
            <Text style={{ color: tokens.text, fontSize: 16, fontWeight: "600" }}>{copy.brand}</Text>
          </View>

          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(event) => {
              const nextIndex = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
              setActiveIndex(Math.max(0, Math.min(slides.length - 1, nextIndex)));
            }}
          >
            {slides.map((slide) => (
              <StartSlide key={slide.key} slide={slide} width={slideWidth} />
            ))}
          </ScrollView>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>{dots}</View>
        </View>

        <View style={{ gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(auth)/login")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              borderRadius: 16,
              paddingVertical: 16,
              backgroundColor: tokens.accent,
              shadowColor: tokens.accent,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.28,
              shadowRadius: 18,
              elevation: 4
            }}
          >
            <Text style={{ color: tokens.surface, fontSize: 17, fontWeight: "700" }}>{copy.start.start}</Text>
            <Feather name="arrow-right" size={17} color={tokens.surface} />
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
