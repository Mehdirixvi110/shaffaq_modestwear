"use client";

import { useState } from "react";
import { formatDate, formatPkr } from "@/lib/format";
import { csrfFetch, responseMessage } from "./csrf-fetch";

type Coupon = { id: number; code: string; description: string | null; type: "PERCENT" | "FIXED" | "FREE_SHIPPING"; value: number; enabled: number; startsAt: number | null; endsAt: number | null; minimumSubtotalPkr: number; usageLimit: number | null; perContactLimit: number | null; archived: number; version: number; usageCount: number; productIds: number[]; collectionIds: number[]; updatedAt: number };
type Lookup = { products: Array<{ id: number; title: string }>; collections: Array<{ id: number; name: string }> };

function localDate(value: number | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function fields(form: HTMLFormElement) {
  const data = new FormData(form);
  const starts = String(data.get("startsAt") ?? "");
  const ends = String(data.get("endsAt") ?? "");
  const limit = String(data.get("usageLimit") ?? "");
  const contactLimit = String(data.get("perContactLimit") ?? "");
  return {
    code: data.get("code"), description: String(data.get("description") ?? "").trim() || null,
    type: data.get("type"), value: Number(data.get("value")), enabled: data.get("enabled") === "on",
    startsAt: starts ? new Date(starts).getTime() : null, endsAt: ends ? new Date(ends).getTime() : null,
    minimumSubtotalPkr: Number(data.get("minimumSubtotalPkr")), usageLimit: limit ? Number(limit) : null,
    perContactLimit: contactLimit ? Number(contactLimit) : null,
    productIds: data.getAll("productIds").map(Number), collectionIds: data.getAll("collectionIds").map(Number),
  };
}

export function AdminCoupons({ initialCoupons, products, collections }: { initialCoupons: Coupon[] } & Lookup) {
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const [message, setMessage] = useState("");

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusyId("new"); setMessage("");
    try { const response = await csrfFetch("/api/admin/coupons", { method: "POST", body: JSON.stringify(fields(event.currentTarget)) }); if (!response.ok) throw new Error(await responseMessage(response)); window.location.reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not create coupon."); setBusyId(null); }
  }
  async function save(event: React.FormEvent<HTMLFormElement>, coupon: Coupon) {
    event.preventDefault(); setBusyId(coupon.id); setMessage("");
    try { const response = await csrfFetch("/api/admin/coupons", { method: "PATCH", body: JSON.stringify({ operation: "SAVE", id: coupon.id, expectedVersion: coupon.version, fields: fields(event.currentTarget) }) }); if (!response.ok) throw new Error(await responseMessage(response)); window.location.reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save coupon."); setBusyId(null); }
  }
  async function archive(coupon: Coupon) {
    setBusyId(coupon.id); setMessage("");
    try { const response = await csrfFetch("/api/admin/coupons", { method: "PATCH", body: JSON.stringify({ operation: coupon.archived ? "RESTORE" : "ARCHIVE", id: coupon.id, expectedVersion: coupon.version }) }); if (!response.ok) throw new Error(await responseMessage(response)); window.location.reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not update coupon."); setBusyId(null); }
  }

  const editor = (coupon?: Coupon) => <div className="admin-form-grid">
    <label><span>Code</span><input name="code" defaultValue={coupon?.code} required minLength={2} maxLength={40} pattern="[A-Za-z0-9_-]+" /></label>
    <label><span>Type</span><select name="type" defaultValue={coupon?.type ?? "PERCENT"}><option value="PERCENT">Percentage</option><option value="FIXED">Fixed PKR amount</option><option value="FREE_SHIPPING">Free shipping</option></select></label>
    <label><span>Value (percent or PKR; 0 for free shipping)</span><input name="value" type="number" min="0" max="100000000" defaultValue={coupon?.value ?? 10} required /></label>
    <label><span>Minimum subtotal (PKR)</span><input name="minimumSubtotalPkr" type="number" min="0" defaultValue={coupon?.minimumSubtotalPkr ?? 0} required /></label>
    <label><span>Starts at (optional)</span><input name="startsAt" type="datetime-local" defaultValue={localDate(coupon?.startsAt)} /></label>
    <label><span>Ends at (optional)</span><input name="endsAt" type="datetime-local" defaultValue={localDate(coupon?.endsAt)} /></label>
    <label><span>Total usage limit (optional)</span><input name="usageLimit" type="number" min="1" defaultValue={coupon?.usageLimit ?? ""} /></label>
    <label><span>Per-contact limit (optional)</span><input name="perContactLimit" type="number" min="1" defaultValue={coupon?.perContactLimit ?? ""} /></label>
    <label className="checkbox-field"><input name="enabled" type="checkbox" defaultChecked={coupon ? Boolean(coupon.enabled) : true} /> Enabled</label>
    <label className="full"><span>Internal description</span><textarea name="description" rows={2} maxLength={500} defaultValue={coupon?.description ?? ""} /></label>
    <label><span>Product scope (optional)</span><select name="productIds" multiple size={Math.min(8, Math.max(4, products.length))} defaultValue={coupon?.productIds.map(String) ?? []}>{products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}</select></label>
    <label><span>Collection scope (optional)</span><select name="collectionIds" multiple size={Math.min(8, Math.max(4, collections.length))} defaultValue={coupon?.collectionIds.map(String) ?? []}>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label>
    <p className="fine-print full">With no scope selected, the coupon applies across the catalogue. Ctrl or Command selects multiple entries.</p>
  </div>;

  return <>{message ? <p className="form-status" role="alert">{message}</p> : null}<details className="admin-card create-panel"><summary>Create coupon</summary><form className="admin-form admin-form--nested" onSubmit={create}>{editor()}<button className="button button--dark" disabled={busyId === "new"}>Create coupon</button></form></details>
    <div className="taxonomy-list">{initialCoupons.map((coupon) => <details className="admin-card" key={coupon.id}><summary><strong>{coupon.code}</strong> <span className="status-pill">{coupon.archived ? "Archived" : coupon.enabled ? "Enabled" : "Disabled"}</span> <small>{coupon.type === "PERCENT" ? `${coupon.value}%` : coupon.type === "FIXED" ? formatPkr(coupon.value) : "Free shipping"} · used {coupon.usageCount}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""} · updated {formatDate(coupon.updatedAt)}</small></summary><form className="admin-form admin-form--nested" onSubmit={(event) => save(event, coupon)}>{editor(coupon)}<div className="admin-actions"><button className="button button--dark" disabled={busyId === coupon.id}>Save</button><button className="button button--outline" type="button" disabled={busyId === coupon.id} onClick={() => archive(coupon)}>{coupon.archived ? "Restore" : "Archive"}</button></div></form></details>)}</div>
  </>;
}
