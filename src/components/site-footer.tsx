import Image from "next/image";
import Link from "next/link";
import type { StoreSettings } from "@/server/store";
import { NewsletterForm } from "./newsletter-form";

const groups = (settings: StoreSettings) => [
  { title: "Explore", links: [["Shop all", "/search"], ["New edit", "/collections/new-edit"], ["Wishlist", "/wishlist"], ["About", "/pages/about"], ["Contact", "/pages/contact"]] },
  { title: "Customer care", links: [["FAQ", "/pages/faq"], ["Shipping", "/pages/shipping"], ["Returns", settings.returnsPolicyUrl], ["Exchanges", settings.exchangesPolicyUrl], ["Payment information", "/pages/payments"]] },
  { title: "Legal", links: [["Privacy", "/pages/privacy"], ["Terms & conditions", "/pages/terms"], ["Admin", "/admin"]] },
];

export function SiteFooter({ settings }: { settings: StoreSettings }) {
  return (
    <footer className="site-footer">
      <div className="footer-grid shell">
        <section className="footer-brand" aria-labelledby="footer-brand-title">
          <Image src="/brand/logo.jpg" width={300} height={168} alt="SHAFFAQ Abayas & Scarves" />
          <h2 id="footer-brand-title" className="sr-only">SHAFFAQ</h2>
          <p>{settings.descriptor}</p>
          {settings.contactEmail ? <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a> : <p className="muted">Contact details can be added in Admin Settings.</p>}
          <div className="social-links">{settings.instagramUrl ? <a href={settings.instagramUrl} rel="noreferrer">Instagram</a> : null}{settings.facebookUrl ? <a href={settings.facebookUrl} rel="noreferrer">Facebook</a> : null}{settings.tiktokUrl ? <a href={settings.tiktokUrl} rel="noreferrer">TikTok</a> : null}</div>
        </section>
        <section className="footer-newsletter"><h2>Newsletter consent</h2><NewsletterForm /></section>
        {groups(settings).map((group) => (
          <details className="footer-group" key={group.title} open>
            <summary>{group.title}</summary>
            <ul>{group.links.map(([label, href]) => <li key={href}><Link href={href}>{label}</Link></li>)}</ul>
          </details>
        ))}
      </div>
      <div className="footer-bottom shell">
        <span>© {new Date().getFullYear()} SHAFFAQ</span>
        <span>Pakistan · PKR</span>
        <span>Online payments are not enabled.</span>
      </div>
    </footer>
  );
}
