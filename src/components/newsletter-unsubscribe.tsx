"use client";

import { useState } from "react";
import { csrfFetch, responseMessage } from "./csrf-fetch";

export function NewsletterUnsubscribe({ token }: { token: string }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function unsubscribe() { setBusy(true); setMessage(""); try { const response = await csrfFetch("/api/newsletter/unsubscribe", { method: "POST", body: JSON.stringify({ token }) }); if (!response.ok) throw new Error(await responseMessage(response)); setMessage("Newsletter consent has been withdrawn. No email was sent."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not unsubscribe."); } finally { setBusy(false); } }
  return <div><button className="button button--dark" type="button" disabled={busy} onClick={unsubscribe}>{busy ? "Updating…" : "Unsubscribe"}</button>{message ? <p className="form-status" role="status">{message}</p> : null}</div>;
}
