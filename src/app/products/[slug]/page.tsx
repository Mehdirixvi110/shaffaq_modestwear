import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/product-gallery";
import { ProductGrid } from "@/components/product-grid";
import { ProductPurchase } from "@/components/product-purchase";
import { WishlistButton } from "@/components/wishlist-button";
import { getApprovedReviews, getProduct, getSettings } from "@/server/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  return product ? { title: product.seoTitle ?? product.title, description: product.seoDescription ?? product.description, alternates: { canonical: `/products/${slug}` }, openGraph: { title: product.title, description: product.description, images: product.imagePath ? [product.imagePath] : [] } } : { title: "Product" };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params; const product = await getProduct(slug); if (!product) notFound(); const [settings, reviews] = await Promise.all([getSettings(), getApprovedReviews(product.id)]);
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? process.env.APP_ORIGIN ?? "http://localhost:3000";
  const productJsonLd = { "@context": "https://schema.org", "@type": "Product", name: product.title, description: product.description, image: product.images.map((image) => new URL(image.path, origin).toString()), sku: product.variants[0]?.sku, brand: { "@type": "Brand", name: "SHAFFAQ" }, offers: { "@type": "AggregateOffer", priceCurrency: "PKR", lowPrice: product.pricePkr, highPrice: Math.max(...product.variants.map((variant) => variant.pricePkr)), availability: product.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${origin}/products/${slug}` } };
  const breadcrumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: origin }, { "@type": "ListItem", position: 2, name: "Shop", item: `${origin}/search` }, { "@type": "ListItem", position: 3, name: product.title, item: `${origin}/products/${slug}` }] };
  return <><div className="product-page shell"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/search">Shop</Link><span>/</span><span aria-current="page">{product.title}</span></nav><div className="product-layout"><ProductGallery images={product.images} title={product.title} /><aside className="product-details"><p className="eyebrow">{product.collectionName ?? "SHAFFAQ edit"}</p><h1>{product.title}</h1>{product.isSample ? <p className="sample-notice">Sample catalogue item. Verify all product facts before launch.</p> : null}<p className="product-description">{product.description}</p><ProductPurchase title={product.title} slug={product.slug} options={product.options} variants={product.variants} whatsappNumber={settings.whatsappNumber} /><WishlistButton productId={product.id} /><details><summary>Size guidance</summary><p>Only the currently configured option labels are shown. Add an owner-reviewed size guide before launch.</p></details><details><summary>Shipping and returns</summary><p>Shipping is calculated from current settings. Review the editable <Link href="/pages/shipping">Shipping policy</Link>, <Link href={settings.returnsPolicyUrl}>Returns policy</Link>, and <Link href={settings.exchangesPolicyUrl}>Exchange policy</Link>.</p></details><details><summary>Reviews ({reviews.length})</summary>{reviews.length ? <div className="product-reviews">{reviews.map((review) => <article key={review.id}><strong>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</strong>{review.title ? <h3>{review.title}</h3> : null}<p>{review.body}</p><small>{review.customerName} · verified delivered order</small></article>)}</div> : <p>No approved reviews yet. Reviews can be submitted only from a delivered order and appear after moderation.</p>}</details></aside></div></div><section className="section shell"><div className="section-heading"><div><p className="eyebrow">Continue exploring</p><h2>Related pieces</h2></div></div><ProductGrid products={product.related} /></section><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd).replaceAll("<", "\\u003c") }} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs).replaceAll("<", "\\u003c") }} /></>;
}
