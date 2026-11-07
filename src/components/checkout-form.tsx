"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatPkr } from "@/lib/format";
import {
  ALLOWED_EMAIL_HINT,
  CHECKOUT_NAME_REGEX,
  CHECKOUT_PHONE_REGEX,
  isAllowedConsumerEmail,
} from "@/lib/checkout-contact";
import { PK_CITIES, PK_PROVINCES, provinceForCity } from "@/lib/pk-locations";
import { whatsappUrl } from "@/lib/whatsapp";
import type { CartState } from "@/server/cart";
import { csrfFetch, responseMessage } from "./csrf-fetch";

type CheckoutResult = { reference: string; redirectTo: string; whatsappUrl: string | null; notice: string; totalPkr: number };
type Channel = "cod" | "whatsapp" | "online" | "manual";

// Sentinel dropdown value for "my city isn't listed" — reveals a free-text town
// field and a manual province selector so an unlisted town never blocks checkout.
const OTHER_CITY = "__other__";

type Fields = {
  customerName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  notes: string;
};

const EMPTY_FIELDS: Fields = { customerName: "", email: "", phone: "", addressLine1: "", addressLine2: "", city: "", postalCode: "", notes: "" };

// Device-only autofill (privacy: no server-side phone lookup). We remember the
// delivery contact in this browser's localStorage and prefill it next time.
const STORAGE_KEY = "shaffaq.checkout.contact.v1";
const SAVED_KEYS = ["customerName", "email", "phone", "addressLine1", "addressLine2", "city", "postalCode"] as const;

type SavedContact = { fields: Partial<Fields>; region: string };

function readSavedContact(): SavedContact | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const picked: Partial<Fields> = {};
    for (const key of SAVED_KEYS) {
      const value = parsed[key];
      if (typeof value === "string") picked[key] = value;
    }
    const region = typeof parsed.region === "string" ? parsed.region : "";
    return Object.keys(picked).length ? { fields: picked, region } : null;
  } catch {
    return null;
  }
}

// Cities grouped by province for the dropdown, each group sorted alphabetically.
const CITY_GROUPS = PK_PROVINCES.map((province) => ({
  province,
  cities: PK_CITIES.filter((entry) => entry.province === province).map((entry) => entry.city).sort((a, b) => a.localeCompare(b)),
})).filter((group) => group.cities.length > 0);

export function CheckoutForm({
  cart,
  codEnabled,
  whatsappEnabled,
  onlineEnabled,
  manualEnabled,
  whatsappNumber,
}: {
  cart: CartState;
  codEnabled: boolean;
  whatsappEnabled: boolean;
  onlineEnabled: boolean;
  manualEnabled: boolean;
  whatsappNumber: string | null;
}) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState<Channel | null>(null);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields | "province", string>>>({});
  const [autofilled, setAutofilled] = useState(false);
  const [otherCity, setOtherCity] = useState(false);
  const [manualProvince, setManualProvince] = useState("");

  // One-time prefill from this device's saved contact. localStorage is unavailable
  // during SSR, so this must run after mount rather than as a lazy initializer
  // (which would cause a hydration mismatch). The state writes run once by design.
  useEffect(() => {
    const saved = readSavedContact();
    if (!saved) return;
    const savedCity = saved.fields.city ?? "";
    const isOther = Boolean(savedCity) && !provinceForCity(savedCity);
    /* eslint-disable react-hooks/set-state-in-effect */
    setFields((prev) => ({ ...prev, ...saved.fields }));
    if (isOther) {
      setOtherCity(true);
      setManualProvince(saved.region);
    }
    setAutofilled(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Auto-derived for a listed city; the manual selection when "Other" is chosen.
  const province = otherCity ? manualProvince : (provinceForCity(fields.city) ?? "");

  // A direct "let us fill it for you" WhatsApp link — no form required. This is the
  // owner-requested fallback for customers who would rather not type the form.
  const whatsappFallbackUrl = useMemo(() => {
    const lines = cart.lines.map((line) => `• ${line.title} (${line.options}) × ${line.quantity}`).join("\n");
    const text = `Assalam o Alaikum SHAFFAQ! I'd like to place an order and I'd prefer you help me complete it here on WhatsApp.\n\n${lines}\n\nTotal: ${formatPkr(cart.totalPkr)}`;
    return whatsappUrl(whatsappNumber, text);
  }, [cart.lines, cart.totalPkr, whatsappNumber]);

  function update<K extends keyof Fields>(name: K, value: string) {
    setFields((prev) => ({ ...prev, [name]: value }));
    // A fresh idempotency key after edits avoids a replay conflict on resubmit.
    setKey(crypto.randomUUID());
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }

  function onCitySelect(value: string) {
    setKey(crypto.randomUUID());
    setErrors((prev) => (prev.city ? { ...prev, city: undefined } : prev));
    if (value === OTHER_CITY) {
      setOtherCity(true);
      setFields((prev) => ({ ...prev, city: "" }));
      return;
    }
    setOtherCity(false);
    setManualProvince("");
    setFields((prev) => ({ ...prev, city: value }));
  }

  function onManualProvince(value: string) {
    setKey(crypto.randomUUID());
    setManualProvince(value);
    setErrors((prev) => (prev.province ? { ...prev, province: undefined } : prev));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof Fields | "province", string>> = {};
    const name = fields.customerName.trim();
    if (!name) next.customerName = "Please enter your full name.";
    else if (!CHECKOUT_NAME_REGEX.test(name)) next.customerName = "Name can contain letters only — no numbers or symbols.";

    if (!CHECKOUT_PHONE_REGEX.test(fields.phone.trim())) next.phone = "Enter an 11-digit number starting with 03, e.g. 03001234567.";

    const email = fields.email.trim();
    if (email && !isAllowedConsumerEmail(email)) next.email = `Enter a valid email (${ALLOWED_EMAIL_HINT}) or leave it blank.`;

    if (fields.addressLine1.trim().length < 3) next.addressLine1 = "Enter your full delivery address.";
    if (otherCity) {
      if (fields.city.trim().length < 2) next.city = "Enter your city or town.";
      if (!manualProvince) next.province = "Select your province.";
    } else if (!fields.city.trim()) {
      next.city = "Select your city.";
    } else if (!provinceForCity(fields.city)) {
      next.city = "Select your city from the list.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function saveContact() {
    try {
      const toSave: Record<string, string> = { region: province };
      for (const k of SAVED_KEYS) toSave[k] = fields[k].trim();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // ignore unavailable/full storage — autofill is a convenience, not required.
    }
  }

  function clearSaved() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setFields(EMPTY_FIELDS);
    setErrors({});
    setAutofilled(false);
    setOtherCity(false);
    setManualProvince("");
    setKey(crypto.randomUUID());
  }

  async function submit(channel: Channel) {
    if (!validate()) {
      setMessage("Please correct the highlighted fields.");
      return;
    }
    setBusy(channel);
    setMessage("");
    const payload = {
      idempotencyKey: key,
      customerName: fields.customerName.trim(),
      email: fields.email.trim(),
      phone: fields.phone.trim(),
      addressLine1: fields.addressLine1.trim(),
      addressLine2: fields.addressLine2.trim(),
      city: fields.city.trim(),
      region: province,
      postalCode: fields.postalCode.trim(),
      country: "PK",
      notes: fields.notes.trim(),
      couponCode: cart.couponCode,
    };
    try {
      const endpoint = channel === "whatsapp" ? "/api/checkout/whatsapp" : channel === "online" ? "/api/checkout/online" : channel === "manual" ? "/api/checkout/manual" : "/api/checkout/cod";
      const response = await csrfFetch(endpoint, { method: "POST", body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(await responseMessage(response));
      const data = await response.json() as CheckoutResult;
      saveContact();
      if (channel === "whatsapp") setResult(data);
      else window.location.assign(data.redirectTo);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  if (result) return <div className="checkout-result"><p className="eyebrow">Inquiry recorded</p><h2>{result.reference}</h2><p>{result.notice}</p><p className="purchase-price">{formatPkr(result.totalPkr)}</p><div className="button-row">{result.whatsappUrl ? <a className="button button--dark" href={result.whatsappUrl} target="_blank" rel="noreferrer">Open WhatsApp</a> : null}<Link className="button button--outline" href={result.redirectTo}>View inquiry</Link></div></div>;

  const disabled = busy !== null || Boolean(cart.couponError);

  return (
    <form className="checkout-layout" onSubmit={(event) => { event.preventDefault(); submit("cod"); }}>
      <div className="checkout-fields">
        {whatsappFallbackUrl ? (
          <div className="checkout-whatsapp-fallback">
            <div>
              <p className="eyebrow">Prefer WhatsApp?</p>
              <p>Avoid wasting time on form filling — <strong>we&apos;ll do it for you</strong>. Send us your order on WhatsApp and our team completes it with you.</p>
            </div>
            <a className="button button--dark" href={whatsappFallbackUrl} target="_blank" rel="noreferrer">Order on WhatsApp</a>
          </div>
        ) : null}

        {autofilled ? (
          <p className="checkout-autofill-note">We filled your details from this device. <button type="button" className="link-button" onClick={clearSaved}>Clear</button></p>
        ) : null}

        <section>
          <p className="eyebrow">Contact</p>
          <h2>Your details</h2>
          <div className="field-grid">
            <label>
              <span>Full name</span>
              <input name="customerName" value={fields.customerName} onChange={(event) => update("customerName", event.target.value.replace(/\d/g, ""))} required maxLength={100} autoComplete="name" aria-invalid={errors.customerName ? true : undefined} />
              {errors.customerName ? <em className="field-error">{errors.customerName}</em> : null}
            </label>
            <label>
              <span>Email <small>(optional)</small></span>
              <input name="email" type="email" value={fields.email} onChange={(event) => update("email", event.target.value)} maxLength={254} autoComplete="email" inputMode="email" aria-invalid={errors.email ? true : undefined} />
              {errors.email ? <em className="field-error">{errors.email}</em> : null}
            </label>
            <label>
              <span>Pakistan phone</span>
              <input name="phone" value={fields.phone} onChange={(event) => update("phone", event.target.value.replace(/\D/g, "").slice(0, 11))} required placeholder="03XXXXXXXXX" inputMode="numeric" autoComplete="tel" aria-invalid={errors.phone ? true : undefined} />
              {errors.phone ? <em className="field-error">{errors.phone}</em> : null}
            </label>
          </div>
        </section>

        <section>
          <p className="eyebrow">Delivery</p>
          <h2>Pakistan address</h2>
          <div className="field-grid">
            <label className="field-wide">
              <span>Address line 1</span>
              <input name="addressLine1" value={fields.addressLine1} onChange={(event) => update("addressLine1", event.target.value)} required minLength={3} maxLength={160} autoComplete="address-line1" aria-invalid={errors.addressLine1 ? true : undefined} />
              {errors.addressLine1 ? <em className="field-error">{errors.addressLine1}</em> : null}
            </label>
            <label className="field-wide">
              <span>Address line 2 <small>(optional)</small></span>
              <input name="addressLine2" value={fields.addressLine2} onChange={(event) => update("addressLine2", event.target.value)} maxLength={160} autoComplete="address-line2" />
            </label>
            <label>
              <span>City</span>
              <select value={otherCity ? OTHER_CITY : fields.city} onChange={(event) => onCitySelect(event.target.value)} required autoComplete="address-level2" aria-invalid={!otherCity && errors.city ? true : undefined}>
                <option value="">Select your city</option>
                {CITY_GROUPS.map((group) => (
                  <optgroup key={group.province} label={group.province}>
                    {group.cities.map((city) => <option key={city} value={city}>{city}</option>)}
                  </optgroup>
                ))}
                <option value={OTHER_CITY}>Other / my city isn&apos;t listed</option>
              </select>
              {!otherCity && errors.city ? <em className="field-error">{errors.city}</em> : null}
            </label>
            {otherCity ? (
              <label>
                <span>Area / town</span>
                <input name="city" value={fields.city} onChange={(event) => update("city", event.target.value)} required maxLength={100} autoComplete="address-level2" aria-invalid={errors.city ? true : undefined} />
                {errors.city ? <em className="field-error">{errors.city}</em> : null}
              </label>
            ) : null}
            {otherCity ? (
              <label>
                <span>Province</span>
                <select name="region" value={manualProvince} onChange={(event) => onManualProvince(event.target.value)} required autoComplete="address-level1" aria-invalid={errors.province ? true : undefined}>
                  <option value="">Select your province</option>
                  {PK_PROVINCES.map((prov) => <option key={prov} value={prov}>{prov}</option>)}
                </select>
                {errors.province ? <em className="field-error">{errors.province}</em> : null}
              </label>
            ) : (
              <label>
                <span>Province <small>(auto)</small></span>
                <input value={province} readOnly tabIndex={-1} placeholder="Select a city first" autoComplete="address-level1" />
              </label>
            )}
            <label>
              <span>Postal code <small>(optional)</small></span>
              <input name="postalCode" value={fields.postalCode} onChange={(event) => update("postalCode", event.target.value)} maxLength={20} autoComplete="postal-code" />
            </label>
            <label className="field-wide">
              <span>Order note <small>(optional)</small></span>
              <textarea name="notes" value={fields.notes} onChange={(event) => update("notes", event.target.value)} maxLength={1000} rows={3} />
            </label>
          </div>
        </section>
      </div>

      <aside className="checkout-summary">
        <p className="eyebrow">Summary</p>
        <h2>{cart.lines.length} {cart.lines.length === 1 ? "item" : "items"}</h2>
        <ul>{cart.lines.map((line) => <li key={line.id}><span>{line.title}<small>{line.options} × {line.quantity}</small></span><strong>{formatPkr(line.pricePkr * line.quantity)}</strong></li>)}</ul>
        <dl><div><dt>Subtotal</dt><dd>{formatPkr(cart.subtotalPkr)}</dd></div>{cart.couponSavingsPkr > 0 ? <div><dt>Coupon {cart.couponCode}</dt><dd>−{formatPkr(cart.couponSavingsPkr)}</dd></div> : null}{cart.taxPkr > 0 ? <div><dt>Tax</dt><dd>{formatPkr(cart.taxPkr)}</dd></div> : null}<div><dt>Shipping</dt><dd>{formatPkr(cart.shippingPkr)}</dd></div><div className="total"><dt>Total</dt><dd>{formatPkr(cart.totalPkr)}</dd></div></dl>
        <p className="fine-print">Prices, coupon eligibility, tax, and stock are recalculated by the server. Cash on delivery remains unpaid until cash is recorded.</p>
        {cart.couponError ? <p className="form-status" role="alert">{cart.couponError} Return to your bag to remove or replace the coupon.</p> : null}
        {codEnabled ? <button className="button button--dark button--full" disabled={disabled} type="submit">{busy === "cod" ? "Submitting…" : "Place cash-on-delivery order"}</button> : <p className="form-status">Cash on delivery is disabled.</p>}
        {onlineEnabled ? <button className="button button--outline button--full" disabled={disabled} type="button" onClick={() => submit("online")}>{busy === "online" ? "Starting secure payment…" : "Pay online"}</button> : null}
        {manualEnabled ? <button className="button button--outline button--full" disabled={disabled} type="button" onClick={() => submit("manual")}>{busy === "manual" ? "Placing bank-transfer order…" : "Place bank-transfer order"}</button> : null}
        {whatsappEnabled ? <button className="button button--outline button--full" disabled={disabled} type="button" onClick={() => submit("whatsapp")}>{busy === "whatsapp" ? "Creating inquiry…" : "Create WhatsApp inquiry"}</button> : null}
        <p className="whatsapp-notice">A WhatsApp inquiry creates a reference first. It does not confirm an order, reserve stock, or confirm payment.</p>
        {message ? <p className="form-status" role="alert">{message}</p> : null}
      </aside>
    </form>
  );
}
