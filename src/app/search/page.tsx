import type { Metadata } from "next";
import { CollectionToolbar } from "@/components/collection-toolbar";
import { Pagination } from "@/components/pagination";
import { ProductGrid } from "@/components/product-grid";
import { listProducts } from "@/server/store";

export const metadata: Metadata = { title: "Shop the edit", alternates: { canonical: "/search" } };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const size = typeof params.size === "string" ? params.size : "";
  const sort = typeof params.sort === "string" ? params.sort : "featured";
  const page = typeof params.page === "string" && /^\d+$/.test(params.page) ? Number(params.page) : 1;
  const result = listProducts({ q: q.length >= 2 ? q : undefined, size: ["52", "54", "56"].includes(size) ? size : undefined, sort, page });
  const makeHref = (nextPage: number) => {
    const query = new URLSearchParams();
    if (q) query.set("q", q); if (size) query.set("size", size); if (sort !== "featured") query.set("sort", sort); query.set("page", String(nextPage));
    return `/search?${query.toString()}`;
  };
  return <div className="inner-page shell"><header className="page-heading"><p className="eyebrow">SHAFFAQ catalogue</p><h1>{q ? `Results for “${q}”` : "Shop the edit"}</h1><p aria-live="polite">{result.count} {result.count === 1 ? "product" : "products"}</p></header><CollectionToolbar q={q} size={size} sort={sort} /><ProductGrid products={result.products} /><Pagination page={result.page} pages={result.pages} makeHref={makeHref} /></div>;
}
