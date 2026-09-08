import BlogDetailPage, { generateMetadata as generateBlogDetailMetadata } from "../../../blog/[slug]/page";
import { englishMarketingSearchParams, requireEnglishMarketingRoute } from "../../marketing";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return generateBlogDetailMetadata({ searchParams: englishMarketingSearchParams });
}

export default function LocaleBlogDetailPage({
  params
}: {
  params: { locale: string; slug: string };
}) {
  requireEnglishMarketingRoute(params, `/blog/${params.slug}`);
  return <BlogDetailPage params={params} searchParams={englishMarketingSearchParams} />;
}
