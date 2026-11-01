import { AdminTaxonomyEditor } from "@/components/admin-taxonomy-editor";
import { getAdminTaxonomies } from "@/server/admin-data";

export default async function AdminCategoriesPage() {
  const data = await getAdminTaxonomies("categories");
  return <><header className="admin-heading"><div><p className="eyebrow">Catalogue structure</p><h1>Categories</h1><p>Create, assign, sort, hide, or archive categories without deleting referenced records.</p></div></header><AdminTaxonomyEditor kind="categories" initialItems={data.items as never} products={data.products} media={data.media} /></>;
}
