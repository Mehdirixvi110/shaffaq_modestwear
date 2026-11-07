import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { getBlogPosts } from "@/server/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Journal",
  description: "Style notes, modestwear guides, and stories from SHAFFAQ.",
  alternates: { canonical: "/blog" },
};

export default async function BlogIndexPage() {
  const posts = await getBlogPosts();
  return (
    <div className="inner-page shell">
      <header className="page-heading"><p className="eyebrow">SHAFFAQ Journal</p><h1>Journal</h1><p>Style notes, modestwear guides, and stories from SHAFFAQ.</p></header>
      {posts.length ? (
        <div className="blog-grid">
          {posts.map((post) => (
            <article className="blog-card" key={post.id}>
              <Link href={`/blog/${post.slug}`} className="blog-card__media" aria-label={post.title}>
                {post.coverImagePath ? <Image src={post.coverImagePath} alt={post.coverImageAlt ?? post.title} fill sizes="(max-width: 767px) 100vw, (max-width: 1024px) 50vw, 33vw" style={{ objectFit: "cover" }} /> : <span className="blog-card__placeholder" aria-hidden="true">SHAFFAQ</span>}
              </Link>
              <div className="blog-card__body">
                <p className="blog-card__meta">{formatDate(post.publishedAt)}{post.author ? ` · ${post.author}` : ""}</p>
                <h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
                {post.excerpt ? <p>{post.excerpt}</p> : null}
                <Link className="text-link" href={`/blog/${post.slug}`}>Read more →</Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state"><p className="eyebrow">Coming soon</p><h2>No posts yet</h2><p>New stories and guides are on the way.</p></div>
      )}
    </div>
  );
}
