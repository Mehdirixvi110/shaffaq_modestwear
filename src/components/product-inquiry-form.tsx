"use client";

import { useEffect, useId, useRef, useState } from "react";
import { whatsappUrl } from "@/lib/whatsapp";
import { csrfFetch, responseMessage } from "./csrf-fetch";

type InquiryVariant = { id: number; sku: string; options: Record<string, string> };
type Source = "PRODUCT_INQUIRY" | "CONTACT";

export function ProductInquiry({
  productId,
  title,
  whatsappNumber,
  variant = null,
  source = "PRODUCT_INQUIRY",
}: {
  productId?: number;
  title?: string;
  slug?: string;
  whatsappNumber: string | null;
  variant?: InquiryVariant | null;
  source?: Source;
}) {
  const isContact = source === "CONTACT";
  const headingId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [done, setDone] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    firstFieldRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function closeModal() {
    setOpen(false);
  }

  // Restore focus to the trigger only after the dialog has actually been open.
  useEffect(() => {
    if (!open && wasOpenRef.current) triggerRef.current?.focus();
    wasOpenRef.current = open;
  }, [open]);

  const selectionLine = variant
    ? Object.entries(variant.options)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ")
    : "";

  const whatsappText = (() => {
    const who = name.trim() ? `${name.trim()} here. ` : "";
    if (isContact) return `Hello SHAFFAQ, ${who}I'd like to request a call back.`;
    const parts = [`Hello SHAFFAQ, ${who}I would like to ask about ${title ?? "a product"}`];
    if (variant) parts.push(` (${variant.sku}${selectionLine ? `; ${selectionLine}` : ""})`);
    parts.push(".");
    return parts.join("");
  })();
  const whatsappHref = whatsappUrl(whatsappNumber, whatsappText);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const response = await csrfFetch("/api/leads", {
        method: "POST",
        body: JSON.stringify({
          source,
          productId: productId ?? null,
          variantId: variant?.id ?? null,
          customerName: name,
          phone,
          city,
          message,
          company,
        }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setDone(true);
      setStatus("Thanks — we'll contact you shortly.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The request could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  const triggerLabel = isContact ? "Request a call" : "Inquire about this product";

  return (
    <div className="inquiry">
      <button
        ref={triggerRef}
        type="button"
        className="button button--outline button--full inquiry-trigger"
        onClick={() => {
          setOpen(true);
          setDone(false);
          setStatus("");
        }}
      >
        {triggerLabel}
      </button>

      {open ? (
        <div className="inquiry-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
          <div
            ref={dialogRef}
            className="inquiry-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
          >
            <div className="inquiry-dialog__head">
              <h2 id={headingId}>{isContact ? "Request a call" : "Inquire about this product"}</h2>
              <button type="button" className="inquiry-close" aria-label="Close" onClick={closeModal}>×</button>
            </div>

            {variant ? (
              <p className="inquiry-selection">
                {title ? <strong>{title}</strong> : null}
                {selectionLine ? <span> — {selectionLine}</span> : null}
                <span className="inquiry-sku"> (SKU: {variant.sku})</span>
              </p>
            ) : null}

            {done ? (
              <p className="form-status" role="status" aria-live="polite">Thanks — we&apos;ll contact you shortly.</p>
            ) : (
              <form className="inquiry-form" onSubmit={submit} noValidate>
                <label>
                  <span>Name <span aria-hidden="true">*</span></span>
                  <input ref={firstFieldRef} type="text" name="name" required maxLength={100} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <label>
                  <span>Phone <span aria-hidden="true">*</span></span>
                  <input type="tel" name="phone" required autoComplete="tel" inputMode="tel" placeholder="03001234567" value={phone} onChange={(event) => setPhone(event.target.value)} />
                </label>
                <label>
                  <span>City</span>
                  <input type="text" name="city" maxLength={100} autoComplete="address-level2" value={city} onChange={(event) => setCity(event.target.value)} />
                </label>
                <label>
                  <span>Message</span>
                  <textarea name="message" maxLength={1000} rows={3} value={message} onChange={(event) => setMessage(event.target.value)} />
                </label>
                <div className="inquiry-honeypot" aria-hidden="true">
                  <label>
                    Company
                    <input type="text" name="company" tabIndex={-1} autoComplete="off" value={company} onChange={(event) => setCompany(event.target.value)} />
                  </label>
                </div>
                <button className="button button--dark button--full" type="submit" disabled={busy}>{busy ? "Sending…" : "Send request"}</button>
                {whatsappHref ? (
                  <a className="whatsapp-link" href={whatsappHref} target="_blank" rel="noreferrer">Chat on WhatsApp instead</a>
                ) : null}
                <p className="inquiry-live" role="status" aria-live="polite">{status}</p>
                <p className="fine-print">Submitting this form is an inquiry only; it does not confirm an order or payment.</p>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
