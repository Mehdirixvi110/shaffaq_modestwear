import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getAdminPageActor } from "@/server/auth";
import { googleOAuthConfigured } from "@/server/google-oauth";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  google_unavailable: "Google sign-in is not configured yet.",
  google_state: "Google sign-in session expired. Please try again.",
  google_unverified: "That Google account's email is not verified.",
  google_not_admin: "That Google account is not an administrator for this store.",
  google_failed: "Google sign-in could not be completed. Please try again.",
};

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getAdminPageActor()) redirect("/admin");
  const { error } = await searchParams;
  const googleReady = googleOAuthConfigured();
  const errorMessage = error ? (ERRORS[error] ?? "Sign-in failed.") : null;
  return (
    <main className="login-page">
      <div className="login-card">
        <p className="eyebrow">Protected administration</p>
        <h1>SHAFFAQ</h1>
        {errorMessage ? <p className="form-status" role="alert">{errorMessage}</p> : null}
        {googleReady ? (
          <>
            <a className="button button--google button--full" href="/api/auth/google/start">Sign in with Google</a>
            <p className="auth-divider"><span>or use a password</span></p>
          </>
        ) : null}
        <LoginForm />
        <p className="fine-print"><Link className="text-link" href="/admin/forgot">Forgot your password?</Link></p>
        <p><Link className="text-link" href="/">Return to storefront</Link></p>
      </div>
    </main>
  );
}
