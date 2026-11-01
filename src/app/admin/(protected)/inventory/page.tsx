import Link from "next/link";
import { AdminInventory } from "@/components/admin-inventory";
import { getAdminInventory } from "@/server/admin-data";

export default async function AdminInventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; low?: string; active?: string }> }) {
  const query = await searchParams;
  const q = query.q?.slice(0, 100) ?? "";
  const data = await getAdminInventory({ q, low: query.low === "1", active: query.active === "1" });
  return <><header className="admin-heading"><div><p className="eyebrow">Stock control</p><h1>Inventory</h1><p>{data.variants.length} variants in this view</p></div><Link className="button button--outline" href="/api/admin/exports/inventory">Export CSV</Link></header>
    <form className="admin-filter" method="get"><label><span>Search product, variant, or SKU</span><input name="q" defaultValue={q} /></label><label className="checkbox-field"><input name="low" type="checkbox" value="1" defaultChecked={query.low === "1"} /> Low stock only</label><label className="checkbox-field"><input name="active" type="checkbox" value="1" defaultChecked={query.active === "1"} /> Active only</label><button className="button button--dark">Filter</button><Link className="text-link" href="/admin/inventory">Clear</Link></form>
    <AdminInventory variants={data.variants as never} movements={data.movements as never} />
  </>;
}
