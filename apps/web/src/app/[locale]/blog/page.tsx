import BlogPage, { generateMetadata as generateBlogMetadata } from "../../blog/page";
import { englishMarketingSearchParams, requireEnglishMarketingRoute } from "../marketing";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return generateBlogMetadata({ searchParams: englishMarketingSearchParams });
}

export default function LocaleBlogPage({ params }: { params: { locale: string } }) {
  requireEnglishMarketingRoute(params, "/blog");
  return <BlogPage searchParams={englishMarketingSearchParams} />;
}
