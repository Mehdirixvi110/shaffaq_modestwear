import Image from "next/image";
import Link from "next/link";
import { formatPkr } from "@/lib/format";
import type { ProductSummary } from "@/server/store";

export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <article className="product-card">
      <Link className="product-card-image" href={`/products/${product.slug}`} aria-label={`View ${product.title}`}>
        {product.imagePath ? <Image src={product.imagePath} alt={product.imageAlt ?? product.title} fill sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 25vw" /> : <span className="image-placeholder">Image pending</span>}
        {product.isSample ? <span className="sample-badge">Sample catalogue</span> : null}
      </Link>
      <div className="product-card-copy">
        <div><p className="product-kicker">{product.collectionName ?? product.categoryName ?? "SHAFFAQ"}</p><h3><Link href={`/products/${product.slug}`}>{product.title}</Link></h3></div>
        <p className="product-price">{product.compareAtPkr ? <del>{formatPkr(product.compareAtPkr)}</del> : null}<span>{formatPkr(product.pricePkr)}</span></p>
        <p className={`availability ${product.available ? "in-stock" : "sold-out"}`}>{product.available ? "Available" : "Sold out"}</p>
      </div>
    </article>
  );
}
