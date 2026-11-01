import type { Metadata, Viewport } from "next";
import { AppChrome } from "@/components/app-chrome";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getNavigation, getSettings } from "@/server/store";
import "./globals.css";

const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? process.env.APP_ORIGIN ?? "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    metadataBase: new URL(origin),
    title: { default: settings.seoTitle, template: `%s | ${settings.storeName}` },
    description: settings.seoDescription,
    alternates: { canonical: "/" },
    openGraph: { title: settings.storeName, description: settings.seoDescription, type: "website", url: "/", siteName: settings.storeName },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f8f2ea" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [settings, navigation] = await Promise.all([getSettings(), getNavigation()]);
  return (
    <html lang="en-PK">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <AppChrome
          header={<SiteHeader announcement={settings.maintenanceMode ? settings.maintenanceMessage ?? "Checkout is temporarily unavailable." : settings.announcement} navigation={navigation} />}
          footer={<SiteFooter settings={settings} />}
        >
          {children}
        </AppChrome>
      </body>
    </html>
  );
}
