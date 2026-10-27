"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { csrfFetch, responseMessage } from "./csrf-fetch";

export function LoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); const form = new FormData(event.currentTarget);
    try { const response = await csrfFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) }); if (!response.ok) throw new Error(await responseMessage(response)); router.push("/admin"); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Sign-in failed."); setBusy(false); }
  }
  return <form onSubmit={submit}><label><span>Email</span><input type="email" name="email" required autoComplete="username" /></label><label><span>Password</span><input type="password" name="password" required autoComplete="current-password" /></label><button className="button button--dark button--full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>{message ? <p className="form-status" role="alert">{message}</p> : null}</form>;
}
