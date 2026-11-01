import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pagination } from "@/components/pagination";
import { ProductGrid } from "@/components/product-grid";
import { getCollection, listProducts } from "@/server/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string; sort?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollection(slug);
  return collection ? { title: collection.name, description: collection.description, alternates: { canonical: `/collections/${slug}` } } : { title: "Collection" };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params; const query = await searchParams;
  const page = query.page && /^\d+$/.test(query.page) ? Number(query.page) : 1;
  const [collection, result] = await Promise.all([getCollection(slug), listProducts({ collectionSlug: slug, sort: query.sort, page })]);
  if (!collection) notFound();
  return <div className="inner-page shell"><header className="page-heading"><p className="eyebrow">Collection</p><h1>{collection.name}</h1>{collection.description ? <p>{collection.description}</p> : null}<p>{result.count} products</p></header><div className="simple-sort"><a href={`/collections/${slug}`}>Configured default</a><a href={`/collections/${slug}?sort=featured`}>Featured</a><a href={`/collections/${slug}?sort=newest`}>Newest</a><a href={`/collections/${slug}?sort=price-asc`}>Price low</a><a href={`/collections/${slug}?sort=price-desc`}>Price high</a></div><ProductGrid products={result.products} /><Pagination page={result.page} pages={result.pages} makeHref={(next) => `/collections/${slug}?${new URLSearchParams({ ...(query.sort ? { sort: query.sort } : {}), page: String(next) })}`} /></div>;
}
