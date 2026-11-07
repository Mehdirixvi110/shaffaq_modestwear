import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata: Metadata = { title: "Reset admin password", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function AdminForgotPage() {
  return <main className="login-page"><div className="login-card"><p className="eyebrow">Protected administration</p><h1>Reset password</h1><ForgotPasswordForm /><p><Link className="text-link" href="/admin/login">Back to sign in</Link></p></div></main>;
}
