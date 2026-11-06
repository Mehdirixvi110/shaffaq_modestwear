"use client";

import Image from "next/image";
import { useState } from "react";
import { formatPkr } from "@/lib/format";
import type { ManualAccountSnapshot } from "@/lib/payments/manual";
import { responseMessage } from "./csrf-fetch";

type Proof = { id: number; publicPath: string; width: number | null; height: number | null };

const ACCOUNT_FIELDS: Array<[keyof ManualAccountSnapshot, string]> = [
  ["bankName", "Bank"],
  ["accountTitle", "Account title"],
  ["accountNumber", "Account number"],
  ["iban", "IBAN"],
  ["easypaisaNumber", "Easypaisa number"],
  ["jazzcashNumber", "JazzCash number"],
];

// Customer bank-transfer panel: the account the customer must pay into (from the
// placement snapshot), the instructions, their uploaded proofs, and a multipart
// CSRF upload. Uploading never changes payment status — it stays unpaid until an
// administrator verifies the transfer.
export function ManualPaymentPanel({ reference, totalPkr, paid, canUpload, account, initialProofs }: { reference: string; totalPkr: number; paid: boolean; canUpload: boolean; account: ManualAccountSnapshot; initialProofs: Proof[] }) {
  const [proofs, setProofs] = useState(initialProofs);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = ACCOUNT_FIELDS.filter(([key]) => account[key]);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setMessage("");
    const form = new FormData(formElement);
    try {
      const csrf = await fetch("/api/csrf", { cache: "no-store", credentials: "same-origin" });
      if (!csrf.ok) throw new Error("Could not initialize a secure upload.");
      const { csrfToken } = await csrf.json() as { csrfToken: string };
      const response = await fetch(`/orders/${reference}/payment-proof`, { method: "POST", headers: { "X-CSRF-Token": csrfToken }, credentials: "same-origin", body: form });
      if (!response.ok) throw new Error(await responseMessage(response));
      const created = await response.json() as { publicPath: string; width: number | null; height: number | null };
      setProofs((current) => [{ id: Date.now(), publicPath: created.publicPath, width: created.width, height: created.height }, ...current]);
      formElement.reset();
      setMessage("Screenshot uploaded. We'll verify your transfer and mark the order paid. It stays unpaid until then.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The upload could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="customer-actions manual-payment-panel">
      <h2>Bank transfer payment</h2>
      {rows.length ? <dl className="order-manual-account"><div className="total"><dt>Amount to transfer</dt><dd>{formatPkr(totalPkr)}</dd></div>{rows.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{account[key]}</dd></div>)}</dl> : <p className="fine-print">Account details will be shared with you shortly.</p>}
      {account.instructions ? <p className="notice-box">{account.instructions}</p> : null}
      {proofs.length ? <div className="order-proof-list"><h3>Your uploaded screenshots</h3><div className="media-grid">{proofs.map((proof) => <a className="admin-card" key={proof.id} href={proof.publicPath} target="_blank" rel="noreferrer"><Image src={proof.publicPath} alt="Payment proof screenshot" width={proof.width ?? 320} height={proof.height ?? 320} style={{ width: "100%", height: "auto" }} /></a>)}</div></div> : null}
      {paid ? <p className="form-status" role="status">Payment verified. Thank you — your transfer has been confirmed.</p>
        : canUpload ? <form className="admin-form" onSubmit={upload} encType="multipart/form-data"><div className="admin-form-grid"><label className="full"><span>Upload payment screenshot (JPEG, PNG, or WebP; max 10 MiB)</span><input name="file" type="file" accept="image/jpeg,image/png,image/webp" required /></label></div><button className="button button--dark" disabled={busy}>{busy ? "Uploading…" : proofs.length ? "Upload another screenshot" : "Upload payment proof"}</button></form>
          : <p className="fine-print">This order is no longer awaiting a bank-transfer screenshot.</p>}
      {message ? <p className="form-status" role="status">{message}</p> : null}
    </section>
  );
}
