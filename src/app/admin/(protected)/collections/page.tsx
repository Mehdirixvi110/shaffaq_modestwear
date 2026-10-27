import { AdminTaxonomyEditor } from "@/components/admin-taxonomy-editor";
import { getAdminTaxonomies } from "@/server/admin-data";

export default function AdminCollectionsPage() {
  const data = getAdminTaxonomies("collections");
  return <><header className="admin-heading"><div><p className="eyebrow">Catalogue structure</p><h1>Collections</h1><p>Create, assign, sort, hide, or archive collections without deleting referenced records.</p></div></header><AdminTaxonomyEditor kind="collections" initialItems={data.items as never} products={data.products} media={data.media} /></>;
}
