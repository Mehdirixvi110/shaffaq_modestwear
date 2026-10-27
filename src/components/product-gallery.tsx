"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function ProductGallery({ images, title }: { images: Array<{ id: number; path: string; alt: string }>; title: string }) {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const current = images[active];
  useEffect(() => {
    if (!zoomed) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setZoomed(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [zoomed]);
  if (!current) return <div className="product-main-image image-placeholder">Image pending</div>;
  return (
    <div className="product-gallery">
      <div className="product-thumbnails" aria-label={`${title} images`}>{images.map((image, index) => <button type="button" key={image.id} className={index === active ? "active" : ""} aria-label={`Show image ${index + 1}`} aria-pressed={index === active} onClick={() => setActive(index)}><Image src={image.path} alt="" fill sizes="84px" /></button>)}</div>
      <button className="product-main-image" type="button" onClick={() => setZoomed(true)} aria-label="Open larger product image"><Image src={current.path} alt={current.alt} fill priority sizes="(max-width: 1023px) 100vw, 58vw" /><span>View larger</span></button>
      {zoomed ? <div className="zoom-layer" role="dialog" aria-modal="true" aria-label="Larger product image" onClick={() => setZoomed(false)}><button type="button" aria-label="Close larger image">×</button><div><Image src={current.path} alt={current.alt} fill sizes="95vw" /></div></div> : null}
    </div>
  );
}
