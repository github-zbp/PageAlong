import DownloadPage, { generateMetadata as generateDownloadMetadata } from "../../download/page";
import { englishMarketingSearchParams, requireEnglishMarketingRoute } from "../marketing";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return generateDownloadMetadata({ searchParams: englishMarketingSearchParams });
}

export default function LocaleDownloadPage({ params }: { params: { locale: string } }) {
  requireEnglishMarketingRoute(params, "/download");
  return <DownloadPage searchParams={englishMarketingSearchParams} />;
}
