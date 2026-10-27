"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPkr } from "@/lib/format";
import type { CartState } from "@/server/cart";
import { csrfFetch, responseMessage } from "./csrf-fetch";

type CheckoutResult = { reference: string; redirectTo: string; whatsappUrl: string | null; notice: string; totalPkr: number };

export function CheckoutForm({ cart, codEnabled, whatsappEnabled }: { cart: CartState; codEnabled: boolean; whatsappEnabled: boolean }) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState<"cod" | "whatsapp" | null>(null);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const refreshKey = () => setKey(crypto.randomUUID());

  async function submit(event: React.FormEvent<HTMLFormElement>, channel: "cod" | "whatsapp") {
    event.preventDefault();
    setBusy(channel);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      idempotencyKey: key,
      customerName: form.get("customerName"), email: form.get("email"), phone: form.get("phone"),
      addressLine1: form.get("addressLine1"), addressLine2: form.get("addressLine2"), city: form.get("city"),
      region: form.get("region"), postalCode: form.get("postalCode"), country: "PK", notes: form.get("notes"), couponCode: cart.couponCode,
    };
    try {
      const response = await csrfFetch(`/api/checkout/${channel === "cod" ? "cod" : "whatsapp"}`, { method: "POST", body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(await responseMessage(response));
      const data = await response.json() as CheckoutResult;
      if (channel === "cod") window.location.assign(data.redirectTo);
      else setResult(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  if (result) return <div className="checkout-result"><p className="eyebrow">Inquiry recorded</p><h2>{result.reference}</h2><p>{result.notice}</p><p className="purchase-price">{formatPkr(result.totalPkr)}</p><div className="button-row">{result.whatsappUrl ? <a className="button button--dark" href={result.whatsappUrl} target="_blank" rel="noreferrer">Open WhatsApp</a> : null}<Link className="button button--outline" href={result.redirectTo}>View inquiry</Link></div></div>;

  return (
    <form className="checkout-layout" onSubmit={(event) => submit(event, "cod")} onChange={refreshKey}>
      <div className="checkout-fields">
        <section><p className="eyebrow">Contact</p><h2>Your details</h2><div className="field-grid"><label><span>Full name</span><input name="customerName" required maxLength={100} autoComplete="name" /></label><label><span>Email</span><input name="email" type="email" required maxLength={254} autoComplete="email" /></label><label><span>Pakistan phone</span><input name="phone" required placeholder="03XXXXXXXXX" pattern="(?:\+92|92|0)?3[0-9]{9}" autoComplete="tel" /></label></div></section>
        <section><p className="eyebrow">Delivery</p><h2>Pakistan address</h2><div className="field-grid"><label className="field-wide"><span>Address line 1</span><input name="addressLine1" required minLength={3} maxLength={160} autoComplete="address-line1" /></label><label className="field-wide"><span>Address line 2 <small>(optional)</small></span><input name="addressLine2" maxLength={160} autoComplete="address-line2" /></label><label><span>City</span><input name="city" required minLength={2} maxLength={100} autoComplete="address-level2" /></label><label><span>Region <small>(optional)</small></span><input name="region" maxLength={100} autoComplete="address-level1" /></label><label><span>Postal code <small>(optional)</small></span><input name="postalCode" maxLength={20} autoComplete="postal-code" /></label><label className="field-wide"><span>Order note <small>(optional)</small></span><textarea name="notes" maxLength={1000} rows={3} /></label></div></section>
      </div>
      <aside className="checkout-summary"><p className="eyebrow">Summary</p><h2>{cart.lines.length} {cart.lines.length === 1 ? "item" : "items"}</h2><ul>{cart.lines.map((line) => <li key={line.id}><span>{line.title}<small>{line.options} × {line.quantity}</small></span><strong>{formatPkr(line.pricePkr * line.quantity)}</strong></li>)}</ul><dl><div><dt>Subtotal</dt><dd>{formatPkr(cart.subtotalPkr)}</dd></div>{cart.couponSavingsPkr > 0 ? <div><dt>Coupon {cart.couponCode}</dt><dd>−{formatPkr(cart.couponSavingsPkr)}</dd></div> : null}{cart.taxPkr > 0 ? <div><dt>Tax</dt><dd>{formatPkr(cart.taxPkr)}</dd></div> : null}<div><dt>Shipping</dt><dd>{formatPkr(cart.shippingPkr)}</dd></div><div className="total"><dt>Total</dt><dd>{formatPkr(cart.totalPkr)}</dd></div></dl>
        <p className="fine-print">Prices, coupon eligibility, tax, and stock are recalculated by the server. Cash on delivery remains unpaid until cash is recorded.</p>
        {cart.couponError ? <p className="form-status" role="alert">{cart.couponError} Return to your bag to remove or replace the coupon.</p> : null}
        {codEnabled ? <button className="button button--dark button--full" disabled={busy !== null || Boolean(cart.couponError)} type="submit">{busy === "cod" ? "Submitting…" : "Place cash-on-delivery order"}</button> : <p className="form-status">Cash on delivery is disabled.</p>}
        {whatsappEnabled ? <button className="button button--outline button--full" disabled={busy !== null || Boolean(cart.couponError)} type="button" onClick={(event) => submit({ ...event, preventDefault: () => event.preventDefault(), currentTarget: event.currentTarget.form! } as unknown as React.FormEvent<HTMLFormElement>, "whatsapp")}>{busy === "whatsapp" ? "Creating inquiry…" : "Create WhatsApp inquiry"}</button> : null}
        <p className="whatsapp-notice">A WhatsApp inquiry creates a reference first. It does not confirm an order, reserve stock, or confirm payment.</p>
        {message ? <p className="form-status" role="alert">{message}</p> : null}
      </aside>
    </form>
  );
}
