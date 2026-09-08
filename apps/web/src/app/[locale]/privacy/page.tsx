import PrivacyPage, { generateMetadata as generatePrivacyMetadata } from "../../privacy/page";
import { englishMarketingSearchParams, requireEnglishMarketingRoute } from "../marketing";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return generatePrivacyMetadata({ searchParams: englishMarketingSearchParams });
}

export default function LocalePrivacyPage({ params }: { params: { locale: string } }) {
  requireEnglishMarketingRoute(params, "/privacy");
  return <PrivacyPage searchParams={englishMarketingSearchParams} />;
}
