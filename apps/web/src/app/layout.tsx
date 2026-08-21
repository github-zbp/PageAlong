import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "页相随 PageAlong",
  description: "可生成音频课程并下载的碎片化阅读器"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
