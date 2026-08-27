import { TagManagementPage } from "@/components/TagManagementPage";
import { normalizeLocale } from "@/lib/i18n";

export default function TagsPage({ params }: { params: { locale: string } }) {
  return <TagManagementPage locale={normalizeLocale(params.locale)} />;
}

