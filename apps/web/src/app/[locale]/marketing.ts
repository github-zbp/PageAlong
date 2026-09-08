import { redirect } from "next/navigation";
import type { MarketingSearchParams } from "@/lib/site";

export const englishMarketingSearchParams = {
  lang: "en"
} satisfies MarketingSearchParams;

export function requireEnglishMarketingRoute(params: { locale: string }, chinesePath: string): void {
  if (params.locale !== "en") {
    redirect(chinesePath);
  }
}
