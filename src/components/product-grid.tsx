import type { ProductSummary } from "@/server/store";
import { ProductCard } from "./product-card";

export function ProductGrid({ products, emptyMessage = "No products match this view yet." }: { products: ProductSummary[]; emptyMessage?: string }) {
  if (products.length === 0) return <div className="empty-state"><p>{emptyMessage}</p></div>;
  return <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>;
}
