"use client";

import Link from "next/link";
import { useState } from "react";
import { csrfFetch, responseMessage } from "./csrf-fetch";

type Step = "request" | "reset" | "done";

export function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const value = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    try {
      const response = await csrfFetch("/api/admin/password/forgot", { method: "POST", body: JSON.stringify({ email: value }) });
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(data.message || (await responseMessage(response)));
      setEmail(value);
      setStep("reset");
      setMessage(data.message || "If that email is registered, a reset code has been sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send a reset code.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await csrfFetch("/api/admin/password/reset", { method: "POST", body: JSON.stringify({ email, code: form.get("code"), password: form.get("password") }) });
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(data.message || (await responseMessage(response)));
      setStep("done");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not reset the password.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return (
      <div>
        <p className="form-status" role="status">Password updated. You can now sign in with your new password.</p>
        <Link className="button button--dark button--full" href="/admin/login">Go to sign in</Link>
      </div>
    );
  }

  if (step === "reset") {
    return (
      <form onSubmit={submitReset}>
        <p className="fine-print">Enter the 6-digit code sent to {email}, then choose a new password (at least 14 characters).</p>
        <label><span>Reset code</span><input name="code" inputMode="numeric" autoComplete="one-time-code" required /></label>
        <label>
          <span>New password</span>
          <span className="password-field">
            <input type={showPassword ? "text" : "password"} name="password" required autoComplete="new-password" minLength={14} />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-pressed={showPassword} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button>
          </span>
        </label>
        <button className="button button--dark button--full" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
        {message ? <p className="form-status" role="status">{message}</p> : null}
        <p><button type="button" className="text-button" onClick={() => { setStep("request"); setMessage(""); }}>Use a different email</button></p>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode}>
      <p className="fine-print">Enter your admin email and we&apos;ll send a reset code.</p>
      <label><span>Email</span><input type="email" name="email" required autoComplete="username" defaultValue={email} /></label>
      <button className="button button--dark button--full" disabled={busy}>{busy ? "Sending…" : "Send reset code"}</button>
      {message ? <p className="form-status" role="status">{message}</p> : null}
    </form>
  );
}
