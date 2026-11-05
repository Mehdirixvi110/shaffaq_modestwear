// Shared WhatsApp deep-link helpers. Keep these pure so storefront components and
// tests can reuse the exact same digit-stripping and wa.me URL construction.

export function whatsappDigits(number: string | null): string {
  return (number ?? "").replaceAll(/\D/g, "");
}

export function whatsappUrl(number: string | null, text: string): string | null {
  const digits = whatsappDigits(number);
  if (!/^\d{10,15}$/.test(digits)) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
