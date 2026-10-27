import Image from "next/image";
import Link from "next/link";
import { getApprovedReviews, listCategoryTiles, type ProductSummary } from "@/server/store";
import { ProductGrid } from "./product-grid";

type HomeSection = {
  id: number;
  type: "CATEGORY_GRID" | "FEATURED" | "CAMPAIGN" | "EDITORIAL" | "REVIEWS" | "SERVICES";
  title: string | null;
  body: string | null;
  imagePath: string | null;
  linkLabel: string | null;
  linkUrl: string | null;
};

export function HomeSections({ sections, featured }: { sections: HomeSection[]; featured: ProductSummary[] }) {
  const categories = listCategoryTiles();
  const approvedReviews = getApprovedReviews(undefined, 6);
  return sections.map((section) => {
    if (section.type === "CATEGORY_GRID") return (
      <section className="section shell" key={section.id} aria-labelledby={`section-${section.id}`}>
        <div className="section-heading"><div><p className="eyebrow">Find your way in</p><h2 id={`section-${section.id}`}>{section.title}</h2></div>{section.body ? <p>{section.body}</p> : null}</div>
        <div className="category-grid">{categories.map((category) => (
          <Link className="category-tile" href={`/categories/${category.slug}`} key={category.id}>
            {category.imagePath ? <Image src={category.imagePath} alt="" fill sizes="(max-width: 767px) 82vw, 33vw" /> : null}
            <span><small>Category</small><strong>{category.name}</strong></span>
          </Link>
        ))}</div>
      </section>
    );
    if (section.type === "FEATURED") return (
      <section className="section shell" key={section.id} aria-labelledby={`section-${section.id}`}>
        <div className="section-heading"><div><p className="eyebrow">Curated now</p><h2 id={`section-${section.id}`}>{section.title}</h2></div>{section.linkLabel && section.linkUrl ? <Link className="text-link" href={section.linkUrl}>{section.linkLabel} →</Link> : null}</div>
        {section.body ? <p className="section-note">{section.body}</p> : null}
        <ProductGrid products={featured} />
      </section>
    );
    if (section.type === "CAMPAIGN") return (
      <section className="campaign" key={section.id} aria-labelledby={`section-${section.id}`}>
        {section.imagePath ? <Image src={section.imagePath} alt="" fill sizes="100vw" /> : null}<div className="campaign-shade" />
        <div className="campaign-copy shell"><p className="eyebrow">A SHAFFAQ chapter</p><h2 id={`section-${section.id}`}>{section.title}</h2>{section.body ? <p>{section.body}</p> : null}{section.linkLabel && section.linkUrl ? <Link className="button button--outline-light" href={section.linkUrl}>{section.linkLabel}</Link> : null}</div>
      </section>
    );
    if (section.type === "EDITORIAL") return (
      <section className="section editorial shell" key={section.id} aria-labelledby={`section-${section.id}`}>
        <div className="editorial-image">{section.imagePath ? <Image src={section.imagePath} alt="SHAFFAQ sample editorial" fill sizes="(max-width: 767px) 100vw, 55vw" /> : null}</div>
        <div className="editorial-copy"><p className="eyebrow">Editorial</p><h2 id={`section-${section.id}`}>{section.title}</h2>{section.body ? <p>{section.body}</p> : null}{section.linkLabel && section.linkUrl ? <Link className="text-link" href={section.linkUrl}>{section.linkLabel} →</Link> : null}</div>
      </section>
    );
    if (section.type === "REVIEWS") return approvedReviews.length ? (
      <section className="section shell" key={section.id} aria-labelledby={`section-${section.id}`}><div className="section-heading"><div><p className="eyebrow">Customer notes</p><h2 id={`section-${section.id}`}>{section.title}</h2></div></div><div className="review-grid">{approvedReviews.map((review) => <article className="review-card" key={review.id}><strong aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</strong>{review.title ? <h3>{review.title}</h3> : null}<p>{review.body}</p><small>{review.customerName} · verified delivered order · {review.productTitle}</small></article>)}</div></section>
    ) : (
      <section className="section review-empty shell" key={section.id} aria-labelledby={`section-${section.id}`}><p className="eyebrow">Customer notes</p><h2 id={`section-${section.id}`}>{section.title}</h2><p>{section.body ?? "No approved reviews yet."}</p><span>Reviews appear only after submission through a delivered-order capability and administrator moderation.</span></section>
    );
    return (
      <section className="services" key={section.id} aria-labelledby={`section-${section.id}`}><div className="shell"><div className="section-heading"><div><p className="eyebrow">Before you order</p><h2 id={`section-${section.id}`}>{section.title}</h2></div>{section.body ? <p>{section.body}</p> : null}</div><div className="service-grid"><article><span>01</span><h3>Pakistan checkout</h3><p>Address and shipping details are confirmed before submission.</p></article><article><span>02</span><h3>Cash on delivery</h3><p>Available only while enabled in store settings.</p></article><article><span>03</span><h3>Direct support</h3><p>A configured WhatsApp link can create an inquiry, never a payment claim.</p></article></div></div></section>
    );
  });
}
