"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { csrfFetch, responseMessage } from "./csrf-fetch";

export type ManagedLead = {
  id: string;
  source: "PRODUCT_INQUIRY" | "CONTACT";
  status: "NEW" | "CONTACTED" | "CLOSED";
  customerName: string;
  phone: string;
  email: string | null;
  city: string | null;
  productId: number | null;
  productNameSnapshot: string | null;
  selectedOptions: string | null;
  variantSku: string | null;
  message: string | null;
  adminNotes: string | null;
  version: number;
  createdAt: number;
  updatedAt: number;
  productTitle: string | null;
};

const STATUSES = ["NEW", "CONTACTED", "CLOSED"] as const;

function parseOptions(raw: string | null): Array<[string, string]> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return Object.entries(parsed).map(([key, value]) => [key, String(value)]);
  } catch { /* ignore malformed JSON */ }
  return [];
}

function LeadCard({ lead }: { lead: ManagedLead }) {
  const [status, setStatus] = useState<ManagedLead["status"]>(lead.status);
  const [adminNotes, setAdminNotes] = useState(lead.adminNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const options = parseOptions(lead.selectedOptions);
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await csrfFetch(`/api/admin/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ status, adminNotes: adminNotes.trim() || null, expectedVersion: lead.version }) });
      if (!response.ok) throw new Error(await responseMessage(response));
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save lead."); setBusy(false); }
  }
  return <article className="admin-card">
    <p className="eyebrow">{lead.productTitle ?? lead.productNameSnapshot ?? "General contact"} · {lead.source === "CONTACT" ? "Contact form" : "Product inquiry"} · {formatDate(lead.createdAt)} · v{lead.version}</p>
    <h2>{lead.customerName}</h2>
    <p className="fine-print">{lead.phone}{lead.email ? ` · ${lead.email}` : ""}{lead.city ? ` · ${lead.city}` : ""}</p>
    {options.length ? <ul className="fine-print">{options.map(([key, value]) => <li key={key}>{key}: {value}</li>)}</ul> : null}
    {lead.variantSku ? <p className="fine-print">SKU: {lead.variantSku}</p> : null}
    {lead.message ? <p>{lead.message}</p> : null}
    <div className="admin-form-grid">
      <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as ManagedLead["status"])}>{STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="full"><span>Internal notes</span><textarea value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} maxLength={2000} rows={3} /></label>
    </div>
    {message ? <p className="form-status" role="alert">{message}</p> : null}
    <button className="button button--dark" type="button" disabled={busy} onClick={save}>Save lead</button>
  </article>;
}

export function AdminLeadManager({ leads }: { leads: ManagedLead[] }) {
  return <section className="admin-section">
    <div className="review-admin-list">{leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)}</div>
    {leads.length === 0 ? <div className="admin-card">No leads match this status.</div> : null}
  </section>;
}
