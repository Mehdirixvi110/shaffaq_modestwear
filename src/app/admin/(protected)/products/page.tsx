import Link from "next/link";
import { AdminProductCreate } from "@/components/admin-product-create";
import { AdminProductBulk } from "@/components/admin-product-bulk";
import { AdminProductImport } from "@/components/admin-product-import";
import { formatDate, formatPkr } from "@/lib/format";
import { getAdminLookups, getAdminProducts } from "@/server/admin-data";

export default function AdminProductsPage() {
  const products = getAdminProducts(); const lookups = getAdminLookups();
  return <><header className="admin-heading"><div><p className="eyebrow">Catalogue</p><h1>Products</h1><p>{products.length} persisted records</p></div><div className="button-row"><Link className="button button--outline" href="/api/admin/exports/products">Export CSV</Link><AdminProductCreate lookups={lookups} /></div></header><AdminProductImport /><AdminProductBulk products={products as never} /><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Status</th><th>Price</th><th>Stock</th><th>Updated</th><th /></tr></thead><tbody>{products.map((product) => <tr key={Number(product.id)}><td><strong>{String(product.title)}</strong><br /><small>{String(product.slug)}{product.isSample ? " · sample" : ""}</small></td><td><span className="status-pill">{String(product.status)}</span></td><td>{product.pricePkr === null ? "—" : formatPkr(Number(product.pricePkr))}</td><td>{Number(product.stock ?? 0)}</td><td>{formatDate(Number(product.updatedAt))}</td><td><Link className="text-link" href={`/admin/products/${product.id}`}>Edit</Link></td></tr>)}</tbody></table></div></>;
}
