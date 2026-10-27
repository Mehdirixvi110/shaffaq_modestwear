import type { Metadata } from "next";
import { cookies } from "next/headers";
import { WishlistGrid } from "@/components/wishlist-grid";
import { WISHLIST_COOKIE } from "@/server/protection";
import { readWishlist } from "@/server/wishlist";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const store = await cookies(); const wishlist = readWishlist(store.get(WISHLIST_COOKIE)?.value);
  return <div className="inner-page shell"><header className="page-heading"><p className="eyebrow">Saved on this device</p><h1>Wishlist</h1><p>This anonymous wishlist is database-backed and linked to an opaque browser cookie. It is not a customer account and does not sync across devices.</p></header><WishlistGrid initialItems={wishlist.items} /></div>;
}
