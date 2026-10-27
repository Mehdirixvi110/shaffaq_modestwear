import type { Metadata } from "next";
import { NewsletterUnsubscribe } from "@/components/newsletter-unsubscribe";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <div className="inner-page shell"><div className="empty-state"><p className="eyebrow">Newsletter consent</p><h1>Unsubscribe</h1><p>Use this private capability link to withdraw the newsletter consent associated with it.</p><NewsletterUnsubscribe token={token} /></div></div>;
}
