import Link from "next/link";
import { AdminLeadManager, type ManagedLead } from "@/components/admin-lead-manager";
import { getAdminLeads } from "@/server/admin-data";

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const query = await searchParams;
  const leads = await getAdminLeads({ status: query.status });
  return <><header className="admin-heading"><div><p className="eyebrow">Customer enquiries</p><h1>Leads</h1><p>{leads.length} leads in this view. Captured from product inquiries and the contact form. Update the status as you follow up and keep private notes against each lead.</p></div></header><form className="admin-filter" method="get"><label><span>Status</span><select name="status" defaultValue={query.status ?? ""}><option value="">All</option><option value="NEW">NEW</option><option value="CONTACTED">CONTACTED</option><option value="CLOSED">CLOSED</option></select></label><button className="button button--dark">Filter</button><Link className="text-link" href="/admin/leads">Clear</Link></form><AdminLeadManager leads={leads as unknown as ManagedLead[]} /></>;
}
