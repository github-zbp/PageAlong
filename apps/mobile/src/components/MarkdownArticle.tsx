import { Pressable, Text, View, type TextStyle } from "react-native";
import Markdown from "react-native-markdown-display";
import type { Sentence } from "@/lib/api";
import type { ReaderFontSize, ReaderLineHeight } from "@/lib/preferences";
import { useTheme } from "@/providers/ThemeProvider";

type Props = {
  markdown: string;
  sentences: Sentence[];
  activeSentenceIndex: number;
  onSentencePress: (sentence: Sentence) => void;
  fontSize?: ReaderFontSize;
  lineHeight?: ReaderLineHeight;
};

function fontMetrics(fontSize: ReaderFontSize, lineHeight: ReaderLineHeight) {
  const size = fontSize === "small" ? 15 : fontSize === "large" ? 18 : 16;
  const line = lineHeight === "compact" ? size + 8 : lineHeight === "loose" ? size + 14 : size + 10;
  return { size, line };
}

function markdownStyles(tokens: ReturnType<typeof useTheme>["tokens"], fontSize: ReaderFontSize, lineHeight: ReaderLineHeight) {
  const metrics = fontMetrics(fontSize, lineHeight);
  const body: TextStyle = {
    color: tokens.text,
    fontSize: metrics.size,
    lineHeight: metrics.line
  };

  return {
    body,
    paragraph: {
      marginTop: 0,
      marginBottom: 12,
      color: tokens.text,
      fontSize: metrics.size,
      lineHeight: metrics.line
    },
    heading1: {
      color: tokens.text,
      fontSize: metrics.size + 10,
      lineHeight: metrics.line + 10,
      fontWeight: "700",
      marginBottom: 14,
      marginTop: 8
    },
    heading2: {
      color: tokens.text,
      fontSize: metrics.size + 6,
      lineHeight: metrics.line + 6,
      fontWeight: "700",
      marginBottom: 12,
      marginTop: 8
    },
    heading3: {
      color: tokens.text,
      fontSize: metrics.size + 3,
      lineHeight: metrics.line + 3,
      fontWeight: "600",
      marginBottom: 10,
      marginTop: 8
    },
    bullet_list: {
      marginBottom: 12
    },
    ordered_list: {
      marginBottom: 12
    },
    list_item: {
      color: tokens.text,
      fontSize: metrics.size,
      lineHeight: metrics.line,
      marginBottom: 4
    },
    link: {
      color: tokens.accent
    },
    fence: {
      backgroundColor: tokens.elevatedSurface,
      borderColor: tokens.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      color: tokens.text,
      fontSize: metrics.size - 1,
      lineHeight: metrics.line
    },
    code_inline: {
      backgroundColor: tokens.elevatedSurface,
      color: tokens.text,
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 2
    }
  };
}

export function MarkdownArticle({
  markdown,
  sentences,
  activeSentenceIndex,
  onSentencePress,
  fontSize = "standard",
  lineHeight = "comfortable"
}: Props) {
  const { tokens } = useTheme();
  const metrics = fontMetrics(fontSize, lineHeight);
  const hasSentences = sentences.length > 0;
  const styles = markdownStyles(tokens, fontSize, lineHeight);

  if (!markdown.trim() && !hasSentences) {
    return null;
  }

  if (hasSentences) {
    return (
      <View style={{ gap: 10 }}>
        {sentences.map((sentence) => {
          const active = sentence.index === activeSentenceIndex;
          const sentenceStyle: TextStyle = {
            color: active ? tokens.text : tokens.text,
            fontSize: metrics.size,
            lineHeight: metrics.line,
            fontWeight: active ? "600" : "400"
          };

          return (
            <Pressable
              key={sentence.index}
              accessibilityRole="button"
              onPress={(event) => {
                event.stopPropagation();
                onSentencePress(sentence);
              }}
              style={{
                borderLeftWidth: 2,
                borderLeftColor: active ? tokens.highlight : "transparent",
                borderRadius: 8,
                backgroundColor: active ? `${tokens.highlight}22` : "transparent",
                paddingVertical: 8,
                paddingHorizontal: 12
              }}
            >
              <Text style={sentenceStyle}>{sentence.text}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <Markdown
      style={styles}
    >
      {markdown}
    </Markdown>
  );
}

export default MarkdownArticle;
