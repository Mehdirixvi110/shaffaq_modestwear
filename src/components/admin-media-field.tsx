"use client";

import Image from "next/image";
import { useState } from "react";
import { responseMessage } from "./csrf-fetch";

type Created = { id: number; displayName: string; publicPath: string };

export function AdminMediaField({ label, path, alt, onChange, onAltChange }: {
  label: string;
  path: string | null;
  alt: string | null;
  onChange: (path: string | null) => void;
  onAltChange: (alt: string | null) => void;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setBusy(true); setMessage("");
    const form = new FormData();
    form.append("displayName", `${label} — ${file.name}`.slice(0, 120));
    form.append("file", file);
    try {
      const csrf = await fetch("/api/csrf", { cache: "no-store", credentials: "same-origin" });
      const { csrfToken } = await csrf.json() as { csrfToken: string };
      const response = await fetch("/api/admin/media", { method: "POST", headers: { "X-CSRF-Token": csrfToken }, credentials: "same-origin", body: form });
      if (!response.ok) throw new Error(await responseMessage(response));
      const created = await response.json() as Created;
      onChange(created.publicPath);
      setMessage("Image uploaded, re-encoded, and stored under an immutable random name.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
      input.value = "";
    }
  }

  return (
    <div className="admin-media-field">
      <span className="admin-media-field-label">{label}</span>
      <div className="media-preview"><Image src={path ?? "/brand/logo.jpg"} alt={alt ?? ""} fill sizes="220px" /></div>
      <label><span>Alternative text</span><input value={alt ?? ""} maxLength={180} onChange={(event) => onAltChange(event.target.value || null)} /></label>
      <label><span>Replace image (JPEG, PNG, or WebP, max 10 MiB / 40 MP)</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={upload} /></label>
      <button type="button" className="text-button" onClick={() => onChange(null)}>Use default</button>
      {message ? <p className="form-status" role="status">{message}</p> : null}
    </div>
  );
}
