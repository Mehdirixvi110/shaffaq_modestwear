import { formatPkr } from "@/lib/format";
import type { StoreSettings } from "@/server/store";

// Delivery/offer messages derived from the store's real shipping configuration so
// the marquee always reflects the live settings (no separate field to keep in sync).
// The owner's free-text promos stay on the `announcement` bar; this strip is for
// delivery facts (COD, flat/free rate, free-over threshold).
export function buildDeliveryMessages(settings: StoreSettings): string[] {
  const messages: string[] = [];
  if (settings.codEnabled) messages.push("Cash on delivery all over Pakistan");
  messages.push(settings.shippingPkr > 0 ? `Flat ${formatPkr(settings.shippingPkr)} delivery nationwide` : "Free delivery all over Pakistan");
  if (settings.freeShippingThresholdPkr && settings.freeShippingThresholdPkr > 0) {
    messages.push(`Free delivery on orders over ${formatPkr(settings.freeShippingThresholdPkr)}`);
  }
  if (settings.whatsappNumber) messages.push("Order & get help on WhatsApp");
  messages.push("Handcrafted modestwear, delivered to your door");
  return messages;
}

// Pure-CSS scrolling marquee (no client JS). The track is duplicated so the loop is
// seamless; prefers-reduced-motion stops the animation and shows the messages static.
export function DeliveryMarquee({ messages }: { messages: string[] }) {
  if (!messages.length) return null;
  const track = (
    <div className="delivery-marquee__track" aria-hidden="true">
      {messages.map((message, index) => <span className="delivery-marquee__item" key={index}>{message}</span>)}
    </div>
  );
  // Scale duration with content length for a roughly constant reading speed.
  const seconds = Math.max(20, Math.round(messages.join("   ").length / 3));
  return (
    <div className="delivery-marquee" role="region" aria-label="Delivery and offers">
      <div className="delivery-marquee__viewport">
        <div className="delivery-marquee__row" style={{ animationDuration: `${seconds}s` }}>
          {track}
          {track}
        </div>
      </div>
      <span className="sr-only">{messages.join(". ")}.</span>
    </div>
  );
}
