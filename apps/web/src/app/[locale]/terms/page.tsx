import TermsPage, { generateMetadata as generateTermsMetadata } from "../../terms/page";
import { englishMarketingSearchParams, requireEnglishMarketingRoute } from "../marketing";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return generateTermsMetadata({ searchParams: englishMarketingSearchParams });
}

export default function LocaleTermsPage({ params }: { params: { locale: string } }) {
  requireEnglishMarketingRoute(params, "/terms");
  return <TermsPage searchParams={englishMarketingSearchParams} />;
}
