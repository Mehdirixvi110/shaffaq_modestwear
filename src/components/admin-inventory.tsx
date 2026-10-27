"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { csrfFetch, responseMessage } from "./csrf-fetch";

type Variant = { id: number; productTitle: string; variantTitle: string; sku: string; stock: number; lowStockThreshold: number; version: number; active: number; updatedAt: number };
type Movement = { id: number; variantId: number; productTitle: string; sku: string; delta: number; stockBefore: number; stockAfter: number; reason: string; source: string; actorEmail: string | null; createdAt: number };

export function AdminInventory({ variants, movements }: { variants: Variant[]; movements: Movement[] }) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  async function adjust(event: React.FormEvent<HTMLFormElement>, variant: Variant) {
    event.preventDefault();
    setBusyId(variant.id); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await csrfFetch(`/api/admin/inventory/${variant.id}`, { method: "PATCH", body: JSON.stringify({ action: "ADJUST", delta: Number(form.get("delta")), reason: form.get("reason"), expectedVersion: variant.version, idempotencyKey: crypto.randomUUID() }) });
      if (!response.ok) throw new Error(await responseMessage(response));
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not adjust stock."); setBusyId(null); }
  }

  async function threshold(event: React.FormEvent<HTMLFormElement>, variant: Variant) {
    event.preventDefault();
    setBusyId(variant.id); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await csrfFetch(`/api/admin/inventory/${variant.id}`, { method: "PATCH", body: JSON.stringify({ action: "THRESHOLD", lowStockThreshold: Number(form.get("threshold")), expectedVersion: variant.version }) });
      if (!response.ok) throw new Error(await responseMessage(response));
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update threshold."); setBusyId(null); }
  }

  return <>
    {message ? <p className="form-status" role="alert">{message}</p> : null}
    <div className="inventory-list">{variants.map((variant) => <article className="admin-card inventory-card" key={variant.id}>
      <div><p className="eyebrow">{variant.sku}</p><h2>{variant.productTitle}</h2><p>{variant.variantTitle} · {variant.active ? "Active" : "Inactive"}</p><p className={variant.stock <= variant.lowStockThreshold ? "stock-low" : "stock-ok"}><strong>{variant.stock}</strong> in stock · alert at {variant.lowStockThreshold}</p><small>Version {variant.version} · {formatDate(variant.updatedAt)}</small></div>
      <form onSubmit={(event) => adjust(event, variant)}><label><span>Adjustment (+ or −)</span><input name="delta" type="number" required step="1" min="-1000000" max="1000000" /></label><label><span>Reason (required)</span><input name="reason" required maxLength={500} /></label><button className="button button--dark" disabled={busyId === variant.id}>Adjust</button></form>
      <form onSubmit={(event) => threshold(event, variant)}><label><span>Low-stock threshold</span><input name="threshold" type="number" required min="0" max="1000000" defaultValue={variant.lowStockThreshold} /></label><button className="button button--outline" disabled={busyId === variant.id}>Save threshold</button></form>
    </article>)}</div>
    <section className="admin-section"><h2>Immutable stock movements</h2>{movements.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>When</th><th>Product / SKU</th><th>Source</th><th>Change</th><th>Balance</th><th>Reason</th><th>Actor</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{formatDate(movement.createdAt)}</td><td>{movement.productTitle}<br /><small>{movement.sku}</small></td><td>{movement.source.replaceAll("_", " ")}</td><td>{movement.delta > 0 ? `+${movement.delta}` : movement.delta}</td><td>{movement.stockBefore} → {movement.stockAfter}</td><td>{movement.reason}</td><td>{movement.actorEmail ?? "System"}</td></tr>)}</tbody></table></div> : <div className="admin-card">No stock movements have been recorded yet.</div>}</section>
  </>;
}
