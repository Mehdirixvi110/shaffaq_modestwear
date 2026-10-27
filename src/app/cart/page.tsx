import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CartClient } from "@/components/cart-client";
import { readCart } from "@/server/cart";
import { CART_COOKIE } from "@/server/protection";

export const metadata: Metadata = { title: "Shopping bag", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const store = await cookies();
  return <div className="inner-page shell"><CartClient initialCart={readCart(store.get(CART_COOKIE)?.value)} /></div>;
}
