import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminProductEditor } from "@/components/admin-product-editor";
import { getAdminLookups, getAdminProduct } from "@/server/admin-data";

export default async function AdminProductPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id); if (!Number.isInteger(id) || id < 1) notFound(); const [found, lookups] = await Promise.all([getAdminProduct(id), getAdminLookups()]); if (!found) notFound(); const product = found as Record<string, unknown>;
  return <><header className="admin-heading"><div><p className="eyebrow"><Link href="/admin/products">Products</Link> / Edit</p><h1>{String(product.title)}</h1></div><Link className="button button--outline" href={`/products/${String(product.slug)}`}>View public page</Link></header><AdminProductEditor initialProduct={product as never} lookups={lookups} /></>;
}
