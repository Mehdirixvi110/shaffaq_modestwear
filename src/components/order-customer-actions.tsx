"use client";

import { useState } from "react";
import { csrfFetch, responseMessage } from "./csrf-fetch";

type Item = { id: number; productTitle: string; reviewId: string | null; reviewStatus: string | null };
type Request = { id: string; kind: string; status: string; reason: string; resolutionNote?: string | null };

export function OrderCustomerActions({ reference, delivered, items, requests }: { reference: string; delivered: boolean; items: Item[]; requests: Request[] }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function requestReturn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; setBusy(true); setMessage(""); const form = new FormData(formElement);
    try { const response = await csrfFetch(`/orders/${reference}/requests`, { method: "POST", body: JSON.stringify({ kind: form.get("kind"), reason: form.get("reason") }) }); if (!response.ok) throw new Error(await responseMessage(response)); setMessage("Your request was recorded for review. No courier collection has been arranged."); formElement.reset(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not submit this request."); } finally { setBusy(false); }
  }
  async function review(event: React.FormEvent<HTMLFormElement>, item: Item) {
    event.preventDefault(); setBusy(true); setMessage(""); const form = new FormData(event.currentTarget);
    try { const response = await csrfFetch(`/orders/${reference}/reviews`, { method: "POST", body: JSON.stringify({ orderItemId: item.id, rating: Number(form.get("rating")), title: String(form.get("title") ?? "").trim() || null, body: form.get("body") }) }); if (!response.ok) throw new Error(await responseMessage(response)); setMessage("Thank you. Your review is pending moderation and is not public yet."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not submit this review."); } finally { setBusy(false); }
  }
  if (!delivered) return <section className="customer-actions"><h2>Returns, exchanges, and reviews</h2><p>These secure order actions become available after SHAFFAQ records delivery.</p></section>;
  return <section className="customer-actions"><h2>After-delivery requests</h2>{requests.length ? <ul className="request-list">{requests.map((entry) => <li key={entry.id}><strong>{entry.kind}</strong> · {entry.status}<br /><small>{entry.reason}{entry.resolutionNote ? ` · Resolution: ${entry.resolutionNote}` : ""}</small></li>)}</ul> : null}<form className="customer-action-form" onSubmit={requestReturn}><label><span>Request type</span><select name="kind"><option value="RETURN">Return</option><option value="EXCHANGE">Exchange</option></select></label><label><span>Reason</span><textarea name="reason" required minLength={10} maxLength={1000} rows={3} /></label><button className="button button--outline" disabled={busy}>Submit request</button></form><p className="fine-print">Submitting records a request only. It does not arrange courier collection or guarantee approval.</p>
    <h2>Review delivered items</h2>{items.map((item) => item.reviewId ? <p key={item.id}><strong>{item.productTitle}</strong>: review {item.reviewStatus?.toLowerCase()}.</p> : <form className="customer-action-form" key={item.id} onSubmit={(event) => review(event, item)}><h3>{item.productTitle}</h3><label><span>Rating</span><select name="rating" defaultValue="5"><option value="5">5 — Excellent</option><option value="4">4 — Good</option><option value="3">3 — Fair</option><option value="2">2 — Poor</option><option value="1">1 — Very poor</option></select></label><label><span>Review title (optional)</span><input name="title" maxLength={120} /></label><label><span>Review</span><textarea name="body" required minLength={10} maxLength={3000} rows={4} /></label><button className="button button--dark" disabled={busy}>Submit genuine review</button></form>)}
    {message ? <p className="form-status" role="status" aria-live="polite">{message}</p> : null}</section>;
}
