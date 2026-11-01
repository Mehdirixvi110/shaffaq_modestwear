import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/product-grid";
import { getCategory, listProducts } from "@/server/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  return category ? { title: category.name, description: category.description, alternates: { canonical: `/categories/${slug}` } } : { title: "Category" };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const [category, result] = await Promise.all([getCategory(slug), listProducts({ categorySlug: slug })]);
  if (!category) notFound();
  return <div className="inner-page shell"><header className="page-heading"><p className="eyebrow">Category</p><h1>{category.name}</h1>{category.description ? <p>{category.description}</p> : null}<p>{result.count} products</p></header><ProductGrid products={result.products} /></div>;
}
