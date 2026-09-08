import type { Metadata } from "next";
import HomePage from "../page";
import { englishMarketingSearchParams, requireEnglishMarketingRoute } from "./marketing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PageAlong",
  description: "PageAlong turns saved content into resumable audio courses."
};

export default function LocaleHomePage({ params }: { params: { locale: string } }) {
  requireEnglishMarketingRoute(params, "/");
  return <HomePage searchParams={englishMarketingSearchParams} />;
}
