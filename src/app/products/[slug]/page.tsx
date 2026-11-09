import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ProductGallery } from "@/components/product-gallery";
import { ProductGrid } from "@/components/product-grid";
import { ProductPurchase } from "@/components/product-purchase";
import { WishlistButton } from "@/components/wishlist-button";
import { getApprovedReviews, getProduct, getProductCustomerRatingSummary, getProductRatingSummary, getSettings } from "@/server/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  return product ? { title: product.seoTitle ?? product.title, description: product.seoDescription ?? product.description, alternates: { canonical: `/products/${slug}` }, openGraph: { title: product.title, description: product.description, images: product.imagePath ? [product.imagePath] : [] } } : { title: "Product" };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params; const product = await getProduct(slug); if (!product) notFound(); const [settings, reviews, ratingSummary, customerRatingSummary] = await Promise.all([getSettings(), getApprovedReviews(product.id), getProductRatingSummary(product.id), getProductCustomerRatingSummary(product.id)]);
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? process.env.APP_ORIGIN ?? "https://shaffaqmodestwear.pk";
  const averageRating = ratingSummary.count > 0 && ratingSummary.average !== null ? Math.round(ratingSummary.average * 10) / 10 : 0;
  // aggregateRating is a machine-readable trust signal for search engines, so it must reflect
  // ONLY genuine customer reviews (source='CUSTOMER'). ADMIN-curated reviews still drive the
  // visible on-page stars above, but are excluded from this JSON-LD; when there are zero
  // customer reviews the aggregateRating key is omitted entirely (never emitted with count 0).
  const customerAverage = customerRatingSummary.count > 0 && customerRatingSummary.average !== null ? Math.round(customerRatingSummary.average * 10) / 10 : 0;
  const productJsonLd = { "@context": "https://schema.org", "@type": "Product", name: product.title, description: product.description, image: product.images.map((image) => new URL(image.path, origin).toString()), sku: product.variants[0]?.sku, brand: { "@type": "Brand", name: "SHAFFAQ" }, offers: { "@type": "AggregateOffer", priceCurrency: "PKR", lowPrice: product.pricePkr, highPrice: Math.max(...product.variants.map((variant) => variant.pricePkr)), availability: product.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${origin}/products/${slug}` }, ...(customerRatingSummary.count > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: customerAverage, reviewCount: customerRatingSummary.count } } : {}) };
  const breadcrumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: origin }, { "@type": "ListItem", position: 2, name: "Shop", item: `${origin}/search` }, { "@type": "ListItem", position: 3, name: product.title, item: `${origin}/products/${slug}` }] };
  return <><div className="product-page shell"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/search">Shop</Link><span>/</span><span aria-current="page">{product.title}</span></nav><div className="product-layout"><ProductGallery images={product.images} title={product.title} /><aside className="product-details"><p className="eyebrow">{product.collectionName ?? "SHAFFAQ edit"}</p><h1>{product.title}</h1>{ratingSummary.count > 0 ? <p className="product-rating" aria-label={`Rated ${averageRating} out of 5 from ${ratingSummary.count} ${ratingSummary.count === 1 ? "review" : "reviews"}`}><span aria-hidden="true">{"★".repeat(Math.round(averageRating))}{"☆".repeat(5 - Math.round(averageRating))}</span> {averageRating.toFixed(1)} ({ratingSummary.count})</p> : null}<p className="product-description">{product.description}</p><ProductPurchase productId={product.id} title={product.title} slug={product.slug} options={product.options} variants={product.variants} whatsappNumber={settings.whatsappNumber} /><WishlistButton productId={product.id} /><details><summary>Size guidance</summary><p>Only the currently configured option labels are shown. Add an owner-reviewed size guide before launch.</p></details><details><summary>Shipping and returns</summary><p>Shipping is calculated from current settings. Review the editable <Link href="/pages/shipping">Shipping policy</Link>, <Link href={settings.returnsPolicyUrl}>Returns policy</Link>, and <Link href={settings.exchangesPolicyUrl}>Exchange policy</Link>.</p></details><details><summary>Reviews ({reviews.length})</summary>{reviews.length ? <div className="product-reviews">{reviews.map((review) => <article key={review.id}><strong>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</strong>{review.title ? <h3>{review.title}</h3> : null}<p>{review.body}</p><small>{review.customerName}{review.source === "CUSTOMER" ? " · verified delivered order" : ""}</small></article>)}</div> : <p>No approved reviews yet. Reviews can be submitted only from a delivered order and appear after moderation.</p>}</details></aside></div></div><section className="section shell"><div className="section-heading"><div><p className="eyebrow">Continue exploring</p><h2>Related pieces</h2></div></div><ProductGrid products={product.related} /></section><script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd).replaceAll("<", "\\u003c") }} /><script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs).replaceAll("<", "\\u003c") }} /></>;
}
