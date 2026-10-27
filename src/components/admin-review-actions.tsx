"use client";

import { useState } from "react";
import { csrfFetch, responseMessage } from "./csrf-fetch";

export function AdminReviewActions({ id, status }: { id: string; status: "PENDING" | "APPROVED" | "REJECTED" }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function moderate(nextStatus: "APPROVED" | "REJECTED") { setBusy(true); setMessage(""); try { const response = await csrfFetch(`/api/admin/reviews/${id}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus, expectedStatus: status }) }); if (!response.ok) throw new Error(await responseMessage(response)); window.location.reload(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not moderate review."); setBusy(false); } }
  return <div><div className="admin-actions"><button className="button button--dark" type="button" disabled={busy || status === "APPROVED"} onClick={() => moderate("APPROVED")}>Approve</button><button className="button button--outline" type="button" disabled={busy || status === "REJECTED"} onClick={() => moderate("REJECTED")}>Reject</button></div>{message ? <p className="form-status" role="alert">{message}</p> : null}</div>;
}
