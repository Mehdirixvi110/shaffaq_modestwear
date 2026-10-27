"use client";

import { useState } from "react";
import { csrfFetch, responseMessage } from "./csrf-fetch";

type Request = { id: string; status: string; version: number };

export function AdminReturnActions({ request }: { request: Request }) {
  const [note, setNote] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function action(name: string) { setBusy(true); setMessage(""); try { const response = await csrfFetch(`/api/admin/returns/${request.id}`, { method: "PATCH", body: JSON.stringify({ action: name, note: note.trim() || null, expectedVersion: request.version }) }); if (!response.ok) throw new Error(await responseMessage(response)); window.location.reload(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update request."); setBusy(false); } }
  return <div><label><span>Resolution note</span><input value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} /></label><div className="admin-actions">{request.status === "REQUESTED" ? <><button className="button button--dark" type="button" disabled={busy} onClick={() => action("APPROVE")}>Approve</button><button className="button button--outline" type="button" disabled={busy || note.trim().length < 3} onClick={() => action("REJECT")}>Reject</button></> : null}{request.status === "APPROVED" ? <button className="button button--dark" type="button" disabled={busy} onClick={() => action("RECEIVE")}>Mark received</button> : null}{request.status === "RECEIVED" ? <button className="button button--dark" type="button" disabled={busy} onClick={() => action("COMPLETE")}>Complete</button> : null}{["REQUESTED", "APPROVED"].includes(request.status) ? <button className="text-button" type="button" disabled={busy || note.trim().length < 3} onClick={() => action("CANCEL")}>Cancel request</button> : null}</div>{message ? <p className="form-status" role="alert">{message}</p> : null}</div>;
}
