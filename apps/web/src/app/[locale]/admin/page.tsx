import { redirect } from "next/navigation";
import { normalizeLocale } from "@/lib/i18n";

export default function AdminPage({ params }: { params: { locale: string } }) {
  redirect(`/${normalizeLocale(params.locale)}/admin/users`);
}
