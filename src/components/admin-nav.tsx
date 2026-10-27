"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { csrfFetch } from "./csrf-fetch";

export function AdminNav({ email }: { email: string }) {
  const router = useRouter();
  async function logout() {
    await csrfFetch("/api/auth/logout", { method: "POST", body: "{}" });
    router.push("/admin/login");
    router.refresh();
  }
  return <aside className="admin-sidebar"><Link className="admin-brand" href="/admin">SHAFFAQ</Link><nav aria-label="Administration"><Link href="/admin">Dashboard</Link><Link href="/admin/products">Products</Link><Link href="/admin/categories">Categories</Link><Link href="/admin/collections">Collections</Link><Link href="/admin/inventory">Inventory</Link><Link href="/admin/coupons">Coupons</Link><Link href="/admin/orders">Orders</Link><Link href="/admin/returns">Returns & exchanges</Link><Link href="/admin/customers">Customers</Link><Link href="/admin/reviews">Reviews</Link><Link href="/admin/newsletter">Newsletter</Link><Link href="/admin/homepage">Homepage</Link><Link href="/admin/media">Media</Link><Link href="/admin/policies">Policies</Link><Link href="/admin/settings">Settings</Link><Link href="/">View storefront</Link></nav><div className="admin-user"><p>{email}</p><button className="text-button" type="button" onClick={logout}>Sign out</button></div></aside>;
}
