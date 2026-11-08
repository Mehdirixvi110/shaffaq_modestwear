"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavLeaf = { label: string; href: string };
type NavEntry = { label: string; href?: string; badge?: boolean; children?: NavLeaf[] };

// Curated primary navigation. Leaf hrefs resolve to real destinations: /search (with an
// optional sort), the seeded collections, the customisation page, and the blog.
const NAV: NavEntry[] = [
  { label: "New Arrivals", href: "/search?sort=newest", badge: true },
  { label: "Shop All", href: "/search" },
  {
    label: "Abaya Collection",
    children: [
      { label: "Premium Collection", href: "/collections/premium-abayas" },
      { label: "Occasion Wears", href: "/collections/occasion-abayas" },
      { label: "Everyday Abayas", href: "/collections/everyday-abayas" },
      { label: "Office Wears", href: "/collections/office-abayas" },
    ],
  },
  {
    label: "Hijab Collection",
    children: [
      { label: "Printed Scarves", href: "/collections/printed-scarves" },
      { label: "Plain Scarves", href: "/collections/plain-scarves" },
      { label: "Occasion Wears", href: "/collections/occasion-scarves" },
      { label: "Summer Collection", href: "/collections/summer-scarves" },
      { label: "Winter Collection", href: "/collections/winter-scarves" },
      { label: "Premium Wear", href: "/collections/premium-scarves" },
    ],
  },
  { label: "Bundle Offers", href: "/collections/bundle-offers" },
  { label: "Clearance Sales", href: "/collections/clearance-sales" },
  { label: "Exclusive Customisation", href: "/pages/customisation" },
  { label: "Blogs", href: "/blog" },
];

function CartIcon() {
  return (
    <svg className="cart-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="9.5" cy="20" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20" r="1.3" fill="currentColor" stroke="none" />
      <path d="M2.5 3.5H5l2.1 10.4a1.6 1.6 0 0 0 1.6 1.3h8a1.6 1.6 0 0 0 1.5-1.2L21.5 7H6" />
    </svg>
  );
}

export function SiteHeader({ announcement, logoPath, logoAlt }: { announcement: string | null; logoPath: string; logoAlt: string }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const isHome = pathname === "/";

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 40);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  // Close any open desktop dropdown when the route changes (e.g. after clicking a sub-link).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync transient menu state to the route
    setOpenMenu(null);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = drawerRef.current?.querySelector<HTMLElement>("button, a");
    first?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>("button, a")].filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const firstItem = focusable[0];
      const lastItem = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const trigger = triggerRef.current;
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [drawerOpen]);

  return (
    <>
      {announcement && <div className="announcement" role="status">{announcement}</div>}
      <header className={`site-header ${isHome && !scrolled ? "site-header--over-hero" : "site-header--solid"}`}>
        <div className="header-inner">
          <button ref={triggerRef} className="icon-button menu-trigger" type="button" aria-label="Open navigation" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>
            <span aria-hidden="true">☰</span>
          </button>
          <Link className="header-logo" href="/" aria-label="SHAFFAQ home">
            <Image src={logoPath} alt={logoAlt} width={172} height={54} priority />
            <span className="header-wordmark">SHAFFAQ</span>
          </Link>
          <nav className="desktop-navigation" aria-label="Primary navigation">
            {NAV.map((entry) => entry.children ? (
              <div key={entry.label} className={`nav-dropdown ${openMenu === entry.label ? "nav-dropdown--open" : ""}`}>
                <button type="button" className="nav-trigger" aria-haspopup="true" aria-expanded={openMenu === entry.label} onClick={() => setOpenMenu((current) => current === entry.label ? null : entry.label)}>
                  {entry.label}<span className="nav-caret" aria-hidden="true">▾</span>
                </button>
                <div className="nav-panel">
                  {entry.children.map((child) => <Link key={child.href} href={child.href} onClick={() => setOpenMenu(null)}>{child.label}</Link>)}
                </div>
              </div>
            ) : (
              <Link key={entry.label} href={entry.href!} className={entry.badge ? "nav-new" : undefined}>
                {entry.label}{entry.badge ? <span className="nav-badge" aria-hidden="true">New</span> : null}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <Link className="icon-link" href="/search" aria-label="Search"><span aria-hidden="true">⌕</span><span className="header-action-label">Search</span></Link>
            <Link className="icon-link" href="/wishlist" aria-label="Wishlist"><span aria-hidden="true">♡</span><span className="header-action-label">Wishlist</span></Link>
            <Link className="icon-link" href="/cart" aria-label="Cart"><CartIcon /><span className="header-action-label">Cart</span></Link>
          </div>
        </div>
      </header>
      {drawerOpen && (
        <div className="drawer-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDrawerOpen(false); }}>
          <div ref={drawerRef} className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Site navigation">
            <div className="drawer-heading">
              <span className="serif">SHAFFAQ</span>
              <button type="button" className="icon-button" aria-label="Close navigation" onClick={() => setDrawerOpen(false)}>×</button>
            </div>
            <nav aria-label="Mobile navigation" onClick={() => setDrawerOpen(false)}>
              {NAV.map((entry) => entry.children ? (
                <details key={entry.label} onClick={(event) => event.stopPropagation()}>
                  <summary>{entry.label}</summary>
                  <div>{entry.children.map((child) => <Link key={child.href} href={child.href} onClick={() => setDrawerOpen(false)}>{child.label}</Link>)}</div>
                </details>
              ) : (
                <Link key={entry.label} href={entry.href!} className={entry.badge ? "nav-new" : undefined}>
                  {entry.label}{entry.badge ? <span className="nav-badge" aria-hidden="true">New</span> : null}
                </Link>
              ))}
              <Link href="/pages/about">About SHAFFAQ</Link>
              <Link href="/pages/contact">Contact</Link>
            </nav>
            <div className="drawer-footer"><Link href="/search">Search</Link><Link href="/wishlist">Wishlist</Link><Link href="/cart">Cart</Link></div>
          </div>
        </div>
      )}
    </>
  );
}
