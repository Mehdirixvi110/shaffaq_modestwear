import Link from "next/link";
import { AdminReviewManager, type ManagedReview } from "@/components/admin-review-manager";
import { database } from "@/db";
import { getAdminReviews } from "@/server/admin-data";

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const query = await searchParams;
  const [reviews, products] = await Promise.all([
    getAdminReviews({ status: query.status }),
    database.prepare("SELECT id, title FROM products WHERE status != 'ARCHIVED' ORDER BY title").all<{ id: number; title: string }>(),
  ]);
  return <><header className="admin-heading"><div><p className="eyebrow">Customer & curated reviews</p><h1>Reviews</h1><p>{reviews.length} reviews in this view. Genuine delivered-order submissions are moderated; curated reviews you add here are clearly marked and never claim a verified delivery.</p></div></header><form className="admin-filter" method="get"><label><span>Status</span><select name="status" defaultValue={query.status ?? ""}><option value="">All</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></label><button className="button button--dark">Filter</button><Link className="text-link" href="/admin/reviews">Clear</Link></form><AdminReviewManager reviews={reviews as unknown as ManagedReview[]} products={products} /></>;
}
