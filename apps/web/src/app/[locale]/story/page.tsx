import StoryPage, { generateMetadata as generateStoryMetadata } from "../../story/page";
import { englishMarketingSearchParams, requireEnglishMarketingRoute } from "../marketing";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return generateStoryMetadata({ searchParams: englishMarketingSearchParams });
}

export default function LocaleStoryPage({ params }: { params: { locale: string } }) {
  requireEnglishMarketingRoute(params, "/story");
  return <StoryPage searchParams={englishMarketingSearchParams} />;
}
