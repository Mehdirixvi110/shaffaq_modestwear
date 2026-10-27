import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
import { getAdminPageActor } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await getAdminPageActor();
  if (!actor) redirect("/admin/login");
  return <main className="admin-shell"><AdminNav email={actor.email} /><div className="admin-main">{children}</div></main>;
}
