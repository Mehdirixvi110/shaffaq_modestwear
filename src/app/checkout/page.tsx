import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { CheckoutForm } from "@/components/checkout-form";
import { readCart } from "@/server/cart";
import { CART_COOKIE } from "@/server/protection";
import { getSettings } from "@/server/store";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const store = await cookies(); const [cart, settings] = await Promise.all([readCart(store.get(CART_COOKIE)?.value), getSettings()]);
  if (!cart.lines.length) return <div className="inner-page shell"><div className="empty-state"><h1>Your bag is empty</h1><Link className="button button--dark" href="/search">Return to the shop</Link></div></div>;
  if (settings.maintenanceMode) return <div className="inner-page shell"><div className="empty-state"><p className="eyebrow">Maintenance</p><h1>Checkout is temporarily paused</h1><p>{settings.maintenanceMessage ?? "Please return later."}</p><Link className="button button--dark" href="/cart">Return to your bag</Link></div></div>;
  return <div className="inner-page shell"><header className="page-heading page-heading--compact"><p className="eyebrow">Secure local checkout</p><h1>Checkout</h1><p>Pakistan delivery · PKR · Cash on delivery</p></header><CheckoutForm cart={cart} codEnabled={Boolean(settings.codEnabled)} whatsappEnabled={Boolean(settings.whatsappNumber)} /></div>;
}
