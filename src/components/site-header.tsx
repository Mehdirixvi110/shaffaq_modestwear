"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Navigation = {
  categories: Array<{ id: number; slug: string; name: string }>;
  collections: Array<{ id: number; slug: string; name: string }>;
};

export function SiteHeader({ announcement, navigation }: { announcement: string | null; navigation: Navigation }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
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
            <Image src="/brand/logo.jpg" alt="" width={172} height={54} priority />
            <span className="header-wordmark">SHAFFAQ</span>
          </Link>
          <nav className="desktop-navigation" aria-label="Primary navigation">
            <Link href="/collections/new-edit">New edit</Link>
            <Link href="/search">Shop all</Link>
            {navigation.categories.slice(0, 3).map((category) => <Link key={category.id} href={`/categories/${category.slug}`}>{category.name}</Link>)}
          </nav>
          <div className="header-actions">
            <Link className="icon-link" href="/search" aria-label="Search"><span aria-hidden="true">⌕</span><span className="header-action-label">Search</span></Link>
            <Link className="icon-link" href="/wishlist" aria-label="Wishlist"><span aria-hidden="true">♡</span><span className="header-action-label">Wishlist</span></Link>
            <Link className="icon-link" href="/cart" aria-label="Shopping bag"><span aria-hidden="true">◇</span><span className="header-action-label">Bag</span></Link>
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
              <Link href="/collections/new-edit">New edit</Link>
              <Link href="/search">Shop all</Link>
              <details open>
                <summary>Categories</summary>
                <div>{navigation.categories.map((category) => <Link key={category.id} href={`/categories/${category.slug}`}>{category.name}</Link>)}</div>
              </details>
              <details>
                <summary>Collections</summary>
                <div>{navigation.collections.map((collection) => <Link key={collection.id} href={`/collections/${collection.slug}`}>{collection.name}</Link>)}</div>
              </details>
              <Link href="/pages/about">About SHAFFAQ</Link>
              <Link href="/pages/contact">Contact</Link>
            </nav>
            <div className="drawer-footer"><Link href="/search">Search</Link><Link href="/wishlist">Wishlist</Link><Link href="/cart">Shopping bag</Link></div>
          </div>
        </div>
      )}
    </>
  );
}
