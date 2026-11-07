import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { RichText } from "@/components/rich-text";
import { formatDate } from "@/lib/format";
import { getBlogPost } from "@/server/store";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return { title: "Journal" };
  const description = post.seoDescription ?? post.excerpt ?? post.title;
  return {
    title: post.seoTitle ?? post.title,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: { title: post.title, description, type: "article", url: `/blog/${slug}`, images: post.coverImagePath ? [post.coverImagePath] : [] },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? process.env.APP_ORIGIN ?? "https://shaffaqmodestwear.pk";
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.seoDescription ?? post.excerpt ?? undefined,
    image: post.coverImagePath ? [new URL(post.coverImagePath, origin).toString()] : undefined,
    datePublished: new Date(post.publishedAt).toISOString(),
    dateModified: new Date(post.updatedAt).toISOString(),
    author: { "@type": "Organization", name: post.author ?? "SHAFFAQ" },
    publisher: { "@type": "Organization", name: "SHAFFAQ" },
    mainEntityOfPage: `${origin}/blog/${slug}`,
  };
  return (
    <>
      <article className="inner-page blog-post shell">
        <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/blog">Journal</Link><span>/</span><span aria-current="page">{post.title}</span></nav>
        <header className="blog-post__header"><p className="eyebrow">SHAFFAQ Journal</p><h1>{post.title}</h1><p className="blog-post__meta">{formatDate(post.publishedAt)}{post.author ? ` · ${post.author}` : ""}</p></header>
        {post.coverImagePath ? <div className="blog-post__cover"><Image src={post.coverImagePath} alt={post.coverImageAlt ?? post.title} fill sizes="(max-width: 820px) 100vw, 820px" style={{ objectFit: "cover" }} priority /></div> : null}
        <RichText className="prose policy-copy" text={post.body} />
        <p className="blog-post__back"><Link className="text-link" href="/blog">← Back to the Journal</Link></p>
      </article>
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replaceAll("<", "\\u003c") }} />
    </>
  );
}
