import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "vditor/dist/index.css";
import { BaiduAnalyticsScript } from "@/components/BaiduAnalyticsScript";
import { ChunkLoadRecovery } from "@/components/ChunkLoadRecovery";
import { ThemeBootstrap } from "@/components/ThemeBootstrap";

export const metadata: Metadata = {
  title: "页相随 PageAlong",
  description: "可生成音频课程并下载的碎片化阅读器"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isPublicFacingRequest = headers().get("x-pagealong-public-analytics") === "1";

  return (
    <html lang="zh-CN">
      <head>{isPublicFacingRequest ? <BaiduAnalyticsScript /> : null}</head>
      <body className="antialiased">
        <ThemeBootstrap />
        <ChunkLoadRecovery />
        {children}
      </body>
    </html>
  );
}
