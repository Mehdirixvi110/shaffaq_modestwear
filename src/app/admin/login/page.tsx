import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getAdminPageActor } from "@/server/auth";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await getAdminPageActor()) redirect("/admin");
  return <main className="login-page"><div className="login-card"><p className="eyebrow">Protected administration</p><h1>SHAFFAQ</h1><LoginForm /><p className="fine-print">The first administrator is created only through the environment-backed bootstrap command.</p><p><Link className="text-link" href="/">Return to storefront</Link></p></div></main>;
}
