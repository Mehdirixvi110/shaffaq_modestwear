import Image from "next/image";
import Link from "next/link";
import type { StoreSettings } from "@/server/store";

export function Hero({ settings }: { settings: StoreSettings }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      {settings.heroDesktopPath ? <Image className="hero-image hero-image--desktop" src={settings.heroDesktopPath} alt="SHAFFAQ sample campaign" fill priority sizes="100vw" /> : null}
      {settings.heroMobilePath ? <Image className="hero-image hero-image--mobile" src={settings.heroMobilePath} alt="SHAFFAQ sample mobile campaign" fill priority sizes="100vw" /> : null}
      <div className="hero-shade" />
      <div className="hero-content shell">
        <div className="hero-panel">
          {settings.heroEyebrow ? <p className="eyebrow">{settings.heroEyebrow}</p> : null}
          <h1 id="hero-title">{settings.heroTitle}</h1>
          {settings.heroBody ? <p>{settings.heroBody}</p> : null}
          {settings.heroCtaLabel && settings.heroCtaUrl ? <Link className="button button--light" href={settings.heroCtaUrl}>{settings.heroCtaLabel}</Link> : null}
        </div>
      </div>
    </section>
  );
}
