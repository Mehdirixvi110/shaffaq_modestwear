import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
import { getLeadsNewCount } from "@/server/admin-data";
import { getAdminPageActor } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await getAdminPageActor();
  if (!actor) redirect("/admin/login");
  const leadsNewCount = await getLeadsNewCount();
  return <main className="admin-shell"><AdminNav email={actor.email} leadsNewCount={leadsNewCount} /><div className="admin-main">{children}</div></main>;
}
