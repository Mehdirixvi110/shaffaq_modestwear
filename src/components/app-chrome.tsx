"use client";

import { usePathname } from "next/navigation";

export function AppChrome({ header, footer, children }: { header: React.ReactNode; footer: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return <>{children}</>;
  return <>{header}<main id="main-content">{children}</main>{footer}</>;
}
