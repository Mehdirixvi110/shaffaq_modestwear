import { AdminBlogManager } from "@/components/admin-blog-manager";
import { getAdminBlogPosts, getAdminLookups } from "@/server/admin-data";

export default async function AdminBlogPage() {
  const [posts, lookups] = await Promise.all([getAdminBlogPosts(), getAdminLookups()]);
  return <><header className="admin-heading"><div><p className="eyebrow">Journal</p><h1>Blog</h1><p>Write SEO-friendly posts. Drafts stay hidden until you publish them.</p></div></header><AdminBlogManager initialPosts={posts} media={lookups.media} /></>;
}
