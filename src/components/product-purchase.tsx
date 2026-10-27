"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatPkr } from "@/lib/format";
import { csrfFetch, responseMessage } from "./csrf-fetch";

type Option = { id: number; name: string; required: number; values: Array<{ id: number; value: string }> };
type Variant = { id: number; title: string; sku: string; pricePkr: number; compareAtPkr: number | null; stock: number; options: Record<string, string> };

export function ProductPurchase({ title, slug, options, variants, whatsappNumber }: { title: string; slug: string; options: Option[]; variants: Variant[]; whatsappNumber: string | null }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const variant = useMemo(() => variants.find((candidate) => options.every((option) => selected[option.name] === candidate.options[option.name])), [options, selected, variants]);

  async function add(goToCheckout = false) {
    if (!variant) {
      setStatus("Select every required option before adding this item.");
      return;
    }
    if (quantity > variant.stock) {
      setStatus("The selected quantity is not available.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const response = await csrfFetch("/api/cart/items", { method: "POST", body: JSON.stringify({ variantId: variant.id, quantity }) });
      if (!response.ok) throw new Error(await responseMessage(response));
      if (goToCheckout) router.push("/checkout");
      else setStatus("Added to your shopping bag.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not add this item.");
    } finally {
      setBusy(false);
    }
  }

  const whatsappDigits = whatsappNumber?.replaceAll(/\D/g, "") ?? "";
  const inquiryText = variant
    ? `Hello SHAFFAQ, I would like to ask about ${title} (${variant.sku}; ${Object.entries(variant.options).map(([key, value]) => `${key}: ${value}`).join(", ")}). Please confirm availability. ${typeof window === "undefined" ? "" : window.location.origin}/products/${slug}`
    : `Hello SHAFFAQ, I would like to ask about ${title}. Please confirm options and availability.`;

  return (
    <div className="purchase-panel-controls">
      {options.map((option) => <fieldset className="option-group" key={option.id}><legend>{option.name} <span aria-hidden="true">*</span></legend><div>{option.values.map((value) => {
        const matching = variants.filter((candidate) => candidate.options[option.name] === value.value);
        const unavailable = matching.every((candidate) => candidate.stock < 1);
        return <button key={value.id} type="button" disabled={unavailable} className={selected[option.name] === value.value ? "selected" : ""} aria-pressed={selected[option.name] === value.value} onClick={() => setSelected((current) => ({ ...current, [option.name]: value.value }))}>{value.value}{unavailable ? " — sold out" : ""}</button>;
      })}</div></fieldset>)}
      <div className="selected-variant" aria-live="polite">
        {variant ? <><p className="purchase-price">{formatPkr(variant.pricePkr)}</p><p>SKU: {variant.sku}</p><p>{variant.stock > 0 ? `${variant.stock} available in this selection` : "This selection is sold out"}</p></> : <p>Select options to see price, SKU, and stock.</p>}
      </div>
      <label className="quantity-field"><span>Quantity</span><input type="number" min={1} max={Math.min(20, variant?.stock ?? 20)} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} /></label>
      <button className="button button--dark button--full" type="button" disabled={busy || !variant || variant.stock < 1} onClick={() => add(false)}>{busy ? "Adding…" : "Add to bag"}</button>
      <button className="button button--outline button--full" type="button" disabled={busy || !variant || variant.stock < 1} onClick={() => add(true)}>Buy now</button>
      {whatsappDigits ? <a className="whatsapp-link" href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent(inquiryText)}`} target="_blank" rel="noreferrer">Ask about this product on WhatsApp</a> : null}
      {status ? <p className="form-status" role="status">{status}</p> : null}
      <p className="fine-print">Cash on delivery is confirmed by SHAFFAQ after submission. A WhatsApp inquiry does not confirm an order or payment.</p>
    </div>
  );
}
