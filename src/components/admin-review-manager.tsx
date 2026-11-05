"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { AdminReviewActions } from "./admin-review-actions";
import { csrfFetch, responseMessage } from "./csrf-fetch";

type ProductOption = { id: number; title: string };

export type ManagedReview = {
  id: string;
  customerName: string;
  city: string | null;
  rating: number;
  title: string | null;
  body: string;
  reviewDate: number;
  productId: number | null;
  featured: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  version: number;
  source: "CUSTOMER" | "ADMIN";
  productTitle: string | null;
  reference: string | null;
  createdAt: number;
};

const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

function toDateInput(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

function StarInput({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return <span className="review-star-input" role="group" aria-label="Star rating">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" className="review-star-button" aria-pressed={value >= star} aria-label={`${star} star${star === 1 ? "" : "s"}`} onClick={() => onChange(star)}>{value >= star ? "★" : "☆"}</button>)}</span>;
}

function ReviewForm({ review, products, onDone }: { review?: ManagedReview; products: ProductOption[]; onDone: () => void }) {
  const [rating, setRating] = useState(review?.rating ?? 5);
  const [featured, setFeatured] = useState(Boolean(review?.featured));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [defaultDate] = useState(() => toDateInput(review?.reviewDate ?? Date.now()));
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const dateValue = String(data.get("reviewDate") ?? "");
    const productValue = String(data.get("productId") ?? "");
    const payload = {
      customerName: String(data.get("customerName") ?? "").trim(),
      city: String(data.get("city") ?? "").trim() || null,
      rating,
      title: String(data.get("title") ?? "").trim() || null,
      body: String(data.get("body") ?? "").trim(),
      reviewDate: Date.parse(dateValue),
      productId: productValue ? Number(productValue) : null,
      featured,
      status: String(data.get("status") ?? "PENDING"),
    };
    setBusy(true); setMessage("");
    try {
      const response = review
        ? await csrfFetch(`/api/admin/reviews/${review.id}`, { method: "PUT", body: JSON.stringify({ ...payload, expectedVersion: review.version }) })
        : await csrfFetch("/api/admin/reviews", { method: "POST", body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(await responseMessage(response));
      onDone();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save review."); setBusy(false); }
  }
  return <form className="admin-form admin-form--nested" onSubmit={submit}>
    <div className="admin-form-grid">
      <label><span>Display name</span><input name="customerName" defaultValue={review?.customerName ?? ""} maxLength={100} required /></label>
      <label><span>City (optional)</span><input name="city" defaultValue={review?.city ?? ""} maxLength={100} /></label>
      <label><span>Rating</span><StarInput value={rating} onChange={setRating} /></label>
      <label><span>Review date</span><input name="reviewDate" type="date" defaultValue={defaultDate} required /></label>
      <label><span>Title (optional)</span><input name="title" defaultValue={review?.title ?? ""} maxLength={160} /></label>
      <label><span>Linked product (optional)</span><select name="productId" defaultValue={review?.productId ?? ""}><option value="">No product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}</select></label>
      <label><span>Status</span><select name="status" defaultValue={review?.status ?? "APPROVED"}>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
      <label className="checkbox-field"><input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} /> Feature on homepage</label>
      <label className="full"><span>Review body</span><textarea name="body" defaultValue={review?.body ?? ""} maxLength={3000} rows={4} required /></label>
    </div>
    {message ? <p className="form-status" role="alert">{message}</p> : null}
    <button className="button button--dark" disabled={busy}>{review ? "Save review" : "Create review"}</button>
  </form>;
}

export function AdminReviewManager({ reviews, products }: { reviews: ManagedReview[]; products: ProductOption[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  function reload() { window.location.reload(); }
  async function remove(review: ManagedReview) {
    if (!window.confirm("Delete this review permanently? This cannot be undone.")) return;
    setBusyId(review.id); setMessage("");
    try {
      const response = await csrfFetch(`/api/admin/reviews/${review.id}`, { method: "DELETE", body: JSON.stringify({ expectedVersion: review.version }) });
      if (!response.ok) throw new Error(await responseMessage(response));
      reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not delete review."); setBusyId(null); }
  }
  return <section className="admin-section">
    <details className="admin-card create-panel"><summary>Add a curated review</summary><ReviewForm products={products} onDone={reload} /></details>
    {message ? <p className="form-status" role="alert">{message}</p> : null}
    <div className="review-admin-list">{reviews.map((review) => <article className="admin-card" key={review.id}>
      <p className="eyebrow">{review.source === "ADMIN" ? "Curated review" : "Genuine delivered-order submission"}{review.productTitle ? ` · ${review.productTitle}` : ""}{review.reference ? ` · order ${review.reference}` : ""}{review.featured ? " · featured on homepage" : ""}</p>
      <h2>{review.title ? review.title : `${review.rating} out of 5`}</h2>
      <p className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
      <p>{review.body}</p>
      <p className="fine-print">By {review.customerName}{review.city ? ` · ${review.city}` : ""} · {formatDate(review.reviewDate)} · Status: {review.status} · v{review.version}</p>
      <AdminReviewActions id={review.id} status={review.status} />
      <details><summary>Edit review</summary><ReviewForm review={review} products={products} onDone={reload} /></details>
      <button className="text-button" type="button" disabled={busyId === review.id} onClick={() => remove(review)}>Delete review</button>
    </article>)}</div>
    {reviews.length === 0 ? <div className="admin-card">No reviews match this status.</div> : null}
  </section>;
}
