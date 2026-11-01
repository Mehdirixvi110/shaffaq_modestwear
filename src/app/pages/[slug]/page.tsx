import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/format";
import { getPolicy } from "@/server/store";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params; const page = await getPolicy(slug);
  return page ? { title: page.title, description: page.content.slice(0, 150), alternates: { canonical: `/pages/${slug}` } } : { title: "Page" };
}

export default async function ContentPage({ params }: Props) {
  const { slug } = await params; const page = await getPolicy(slug); if (!page) notFound();
  return <article className="inner-page prose shell"><p className="eyebrow">SHAFFAQ information</p><h1>{page.title}</h1>{page.isTemplate ? <div className="notice-box">This is a persisted template requiring business, legal, and tax review before public launch.</div> : null}<div className="policy-copy">{page.content.split("\n").map((paragraph, index) => paragraph ? <p key={index}>{paragraph}</p> : <br key={index} />)}</div><p className="updated-at">Last updated {formatDate(page.updatedAt)}</p></article>;
}
