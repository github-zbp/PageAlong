import GuidePage, { generateMetadata as generateGuideMetadata } from "../../guide/page";
import { englishMarketingSearchParams, requireEnglishMarketingRoute } from "../marketing";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return generateGuideMetadata({ searchParams: englishMarketingSearchParams });
}

export default function LocaleGuidePage({ params }: { params: { locale: string } }) {
  requireEnglishMarketingRoute(params, "/guide");
  return <GuidePage searchParams={englishMarketingSearchParams} />;
}
