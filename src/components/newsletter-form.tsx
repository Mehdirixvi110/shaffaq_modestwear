"use client";

import Link from "next/link";
import { useState } from "react";
import { csrfFetch, responseMessage } from "./csrf-fetch";

export function NewsletterForm() {
  const [message, setMessage] = useState("");
  const [unsubscribeUrl, setUnsubscribeUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setMessage("");
    const form = new FormData(formElement);
    try {
      const response = await csrfFetch("/api/newsletter", { method: "POST", body: JSON.stringify({ email: form.get("email"), consent: form.get("consent") === "on", source: "FOOTER" }) });
      if (!response.ok) throw new Error(await responseMessage(response));
      const result = (await response.json()) as { message: string; unsubscribeUrl: string };
      setMessage(result.message);
      setUnsubscribeUrl(result.unsubscribeUrl);
      formElement.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not subscribe you right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="newsletter-form" onSubmit={submit}>
      <label><span className="sr-only">Email address</span><input name="email" type="email" required maxLength={254} placeholder="Your email address" /></label>
      <label className="newsletter-consent"><input name="consent" type="checkbox" required /> <span>Yes, email me SHAFFAQ new arrivals and offers.</span></label>
      <button className="button button--light" disabled={busy}>{busy ? "Subscribing…" : "Subscribe"}</button>
      {message ? <p role="status">{message}</p> : null}
      {unsubscribeUrl ? <p className="fine-print"><Link href={unsubscribeUrl}>Save your unsubscribe link</Link></p> : null}
    </form>
  );
}
