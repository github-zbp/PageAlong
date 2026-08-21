export type HighlightColor = "amber" | "green" | "blue" | "purple" | "coral";

export type ExtensionSettings = {
  highlightColor: HighlightColor;
  sidebarEnabled: boolean;
  autoScroll: boolean;
  playbackRate: number;
};

export type ArticleImageCandidate = {
  url: string;
  alt: string;
  width?: number;
  height?: number;
  nearbyText: string;
};

export type ExtractedSentence = {
  index: number;
  text: string;
};

export type ExtractedArticle = {
  url: string;
  title: string;
  sourceDomain: string;
  articleHtml: string;
  textExcerpt: string;
  images: ArticleImageCandidate[];
  sentences: ExtractedSentence[];
};
