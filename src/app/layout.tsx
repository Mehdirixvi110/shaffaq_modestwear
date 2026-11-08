import type { Metadata, Viewport } from "next";
import { AppChrome } from "@/components/app-chrome";
import { DeliveryMarquee, buildDeliveryMessages } from "@/components/delivery-marquee";
import { PurchaseNotifications } from "@/components/purchase-notifications";
import { WhatsappChatButton } from "@/components/whatsapp-chat-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSettings } from "@/server/store";
import "./globals.css";

const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? process.env.APP_ORIGIN ?? "https://shaffaqmodestwear.pk";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    metadataBase: new URL(origin),
    title: { default: settings.seoTitle, template: `%s | ${settings.storeName}` },
    description: settings.seoDescription,
    alternates: { canonical: "/" },
    openGraph: { title: settings.storeName, description: settings.seoDescription, type: "website", url: "/", siteName: settings.storeName, images: [{ url: settings.ogImagePath ?? "/brand/logo.jpg", alt: settings.ogImageAlt ?? settings.storeName }] },
    twitter: { card: "summary_large_image", title: settings.storeName, description: settings.seoDescription, images: [settings.ogImagePath ?? "/brand/logo.jpg"] },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f8f2ea" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSettings();
  const marqueeMessages = settings.maintenanceMode ? [] : buildDeliveryMessages(settings);
  return (
    <html lang="en-PK">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <AppChrome
          header={<><DeliveryMarquee messages={marqueeMessages} /><SiteHeader announcement={settings.maintenanceMode ? settings.maintenanceMessage ?? "Checkout is temporarily unavailable." : settings.announcement} logoPath={settings.headerLogoPath ?? "/brand/logo.jpg"} logoAlt={settings.headerLogoAlt ?? ""} /></>}
          footer={<SiteFooter settings={settings} />}
        >
          {children}
        </AppChrome>
        <PurchaseNotifications />
        <WhatsappChatButton whatsappNumber={settings.whatsappNumber} />
      </body>
    </html>
  );
}
