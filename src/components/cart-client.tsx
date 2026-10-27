"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { formatPkr } from "@/lib/format";
import type { CartState } from "@/server/cart";
import { csrfFetch, responseMessage } from "./csrf-fetch";

export function CartClient({ initialCart }: { initialCart: CartState }) {
  const [cart, setCart] = useState(initialCart);
  const [couponCode, setCouponCode] = useState(initialCart.couponCode ?? "");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  async function update(itemId: number, quantity: number | null) {
    setBusyId(itemId);
    setMessage("");
    try {
      const response = await csrfFetch(`/api/cart/items/${itemId}`, { method: quantity === null ? "DELETE" : "PATCH", body: quantity === null ? undefined : JSON.stringify({ quantity }) });
      if (!response.ok) throw new Error(await responseMessage(response));
      const state = await response.json() as CartState;
      setCart(state);
      if (state.couponError) setMessage(state.couponError);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update your bag.");
    } finally {
      setBusyId(null);
    }
  }

  async function updateCoupon(code: string | null) {
    setCouponBusy(true);
    setMessage("");
    try {
      const response = await csrfFetch("/api/cart/coupon", { method: "PATCH", body: JSON.stringify({ code }) });
      if (!response.ok) throw new Error(await responseMessage(response));
      const state = await response.json() as CartState;
      setCart(state);
      setCouponCode(state.couponCode ?? "");
      setMessage(state.couponCode ? `Coupon ${state.couponCode} applied.` : "Coupon removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not apply this coupon.");
    } finally {
      setCouponBusy(false);
    }
  }

  function applyCoupon(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void updateCoupon(couponCode);
  }

  if (cart.lines.length === 0) return <div className="empty-state cart-empty"><p className="eyebrow">Your bag</p><h1>Your bag is empty</h1><p>Explore the sample edit when you are ready.</p><Link className="button button--dark" href="/search">Shop the edit</Link></div>;
  return (
    <div className="cart-layout">
      <div className="cart-lines">
        {cart.lines.map((line) => <article className="cart-line" key={line.id}>
          <Link className="cart-image" href={`/products/${line.slug}`}>{line.imagePath ? <Image src={line.imagePath} alt={line.imageAlt ?? line.title} fill sizes="140px" /> : null}</Link>
          <div><p className="eyebrow">{line.sku}</p><h2><Link href={`/products/${line.slug}`}>{line.title}</Link></h2><p>{line.options}</p><p>{formatPkr(line.pricePkr)}</p>
            <label><span>Quantity</span><select disabled={busyId === line.id} value={line.quantity} onChange={(event) => update(line.id, Number(event.target.value))}>{Array.from({ length: Math.min(20, line.stock) }, (_, index) => index + 1).map((quantity) => <option key={quantity}>{quantity}</option>)}</select></label>
            <button className="text-button" type="button" disabled={busyId === line.id} onClick={() => update(line.id, null)}>Remove</button>
          </div><strong>{formatPkr(line.pricePkr * line.quantity)}</strong>
        </article>)}
      </div>
      <aside className="cart-summary"><p className="eyebrow">Order summary</p><h2>Review your bag</h2>
        <form className="coupon-form" onSubmit={applyCoupon}><label><span>Coupon code</span><input value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} maxLength={40} autoComplete="off" /></label><div className="button-row"><button className="button button--outline" disabled={couponBusy || couponCode.trim().length < 2}>{couponBusy ? "Checking…" : "Apply"}</button>{cart.couponCode ? <button className="text-button" type="button" disabled={couponBusy} onClick={() => void updateCoupon(null)}>Remove</button> : null}</div></form>
        <dl><div><dt>Subtotal</dt><dd>{formatPkr(cart.subtotalPkr)}</dd></div>{cart.couponSavingsPkr > 0 ? <div><dt>Coupon {cart.couponCode}</dt><dd>−{formatPkr(cart.couponSavingsPkr)}</dd></div> : null}{cart.taxPkr > 0 ? <div><dt>Tax</dt><dd>{formatPkr(cart.taxPkr)}</dd></div> : null}<div><dt>Estimated shipping</dt><dd>{formatPkr(cart.shippingPkr)}</dd></div><div className="total"><dt>Total</dt><dd>{formatPkr(cart.totalPkr)}</dd></div></dl><p className="fine-print">The server recalculates price, coupon eligibility, shipping, tax, and stock at checkout.</p><Link className="button button--dark button--full" href="/checkout">Continue to checkout</Link>{message || cart.couponError ? <p role="status" aria-live="polite" className="form-status">{message || cart.couponError}</p> : null}
      </aside>
    </div>
  );
}
