import { redirect } from "next/navigation";

export default function AdminPage() {
  redirect("/reader_admin/users");
}
