import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { DatabaseConnection } from "../src/db/provider";

type SeedAsset = {
  source: string;
  destination: string;
  publicPath: string;
  sha256: string;
  displayName: string;
};

const assets: SeedAsset[] = [
  { source: "Logo.jpg", destination: "public/brand/logo.jpg", publicPath: "/brand/logo.jpg", sha256: "292a9226ac25353e0b67009800d7582144989e30f803687e9356848d90a0c21e", displayName: "Authoritative SHAFFAQ logo" },
  { source: "Pictures/WhatsApp Image 2026-10-18 at 1.46.37 AM (2).jpeg", destination: "public/media/hero-desktop.jpeg", publicPath: "/media/hero-desktop.jpeg", sha256: "20fb7278cff6faa0bf848d5da6f8f4bd3d757be88ce8f9a7af3315e480ad49c1", displayName: "Sample desktop campaign" },
  { source: "Pictures/Designer_creating_social_media_post_20261018153053.jpg", destination: "public/media/hero-mobile.jpg", publicPath: "/media/hero-mobile.jpg", sha256: "2081c2e05288f238b8064fa113b47750177831d5b3aa45f380cf680028fdfb26", displayName: "Sample mobile campaign" },
  { source: "Pictures/Classic Abaya_ Timeless Elegance.png", destination: "public/media/sample-look-01.png", publicPath: "/media/sample-look-01.png", sha256: "65e6c1496310e16e5e3dd0f2288889ea826ad42eae9a995aec4b250fa5b58b03", displayName: "Sample look 01" },
  { source: "Pictures/Classic White Abaya Details.png", destination: "public/media/sample-look-02.png", publicPath: "/media/sample-look-02.png", sha256: "34e11f2be8d7a76555f91afa092784c52da55751c451fbf67342aa814dedcf4f", displayName: "Sample look 02" },
  { source: "Pictures/Olive Green Classic Abaya Showcase.png", destination: "public/media/sample-look-03.png", publicPath: "/media/sample-look-03.png", sha256: "a917b35ac45d01799b26a105cdbb3e37e5792e7e1c51db8cd3267becfac1663f", displayName: "Sample look 03" },
  { source: "Versatile for Every Occasion/1.png", destination: "public/media/sample-look-04.png", publicPath: "/media/sample-look-04.png", sha256: "f44498a0fa7197e297a362815086472977b077611edab8a1ca25a6d2c3d45661", displayName: "Sample look 04" },
  { source: "Versatile for Every Occasion/2.png", destination: "public/media/sample-look-05.png", publicPath: "/media/sample-look-05.png", sha256: "066e6bc576762a8ec6dd88e9ddd7aaa3b8057041b7940216e6ed21b2bb03022f", displayName: "Sample look 05" },
  { source: "Versatile for Every Occasion/3.png", destination: "public/media/sample-look-06.png", publicPath: "/media/sample-look-06.png", sha256: "f9f5336729b907019ef31b29e6cf96af787335a4fc0801d48c7eea7af00ff834", displayName: "Sample look 06" },
  { source: "Pictures/WhatsApp Image 2026-10-26 at 3.24.47 PM.jpeg", destination: "public/media/campaign-wide.jpeg", publicPath: "/media/campaign-wide.jpeg", sha256: "66a56102e5690e936be704c760d0a5f479d69da07635bb4ad54e55dff2d7d90e", displayName: "Sample wide campaign" },
];

function digest(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function verifySeedAssets(copyAssets = true) {
  for (const asset of assets) {
    const source = resolve(process.cwd(), asset.source);
    const destination = resolve(process.cwd(), asset.destination);
    if (digest(source) !== asset.sha256) throw new Error(`Seed asset checksum mismatch: ${asset.source}`);
    if (copyAssets) {
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(source, destination);
    }
    if (digest(destination) !== asset.sha256) throw new Error(`Checked-in seed asset checksum mismatch: ${asset.destination}`);
  }
}

const sampleDescription = "Sample catalogue item for setup. Replace this editable name, description, price, imagery, and stock before accepting real orders.";

export async function seedDatabase(connection: DatabaseConnection, options: { enforceBusinessSettings: boolean }) {
  await connection.transaction(async () => {
    await connection.prepare(`INSERT OR IGNORE INTO settings (
      id, store_name, descriptor, announcement, hero_eyebrow, hero_title, hero_body,
      hero_cta_label, hero_cta_url, hero_desktop_path, hero_mobile_path,
      header_logo_path, header_logo_alt, footer_logo_path, footer_logo_alt, og_image_path, og_image_alt,
      shipping_pkr, free_shipping_threshold_pkr, cod_enabled,
      whatsapp_number, contact_email, contact_phone
    ) VALUES (1, 'SHAFFAQ', 'Abayas & Scarves',
      'Sample storefront — review catalogue and policy details before launch.',
      'SHAFFAQ — SAMPLE EDIT', 'Elegance, in Every Layer.',
      'A preview of the SHAFFAQ catalogue experience.', 'Explore the edit',
      '/collections/new-edit', '/media/hero-desktop.jpeg', '/media/hero-mobile.jpg',
      NULL, 'SHAFFAQ', NULL, 'SHAFFAQ Abayas & Scarves', NULL, NULL,
      250, 6000, 1, '923233367659', 'info@shaffaqmodestwear.pk', '923233367659')`).run();

    await connection.prepare(`UPDATE settings SET
      header_logo_path = CASE WHEN header_logo_path = '/brand/logo.jpg' THEN NULL ELSE header_logo_path END,
      footer_logo_path = CASE WHEN footer_logo_path = '/brand/logo.jpg' THEN NULL ELSE footer_logo_path END,
      header_logo_alt=COALESCE(header_logo_alt,'SHAFFAQ'),
      footer_logo_alt=COALESCE(footer_logo_alt,'SHAFFAQ Abayas & Scarves') WHERE id=1`).run();

    if (options.enforceBusinessSettings) {
      await connection.prepare(`UPDATE settings SET shipping_pkr = 250, free_shipping_threshold_pkr = 6000, cod_enabled = 1,
        whatsapp_number = '923233367659', contact_email = 'info@shaffaqmodestwear.pk', contact_phone = '923233367659',
        updated_at = unixepoch() * 1000 WHERE id = 1`).run();
    }

    const categoryRows = [
      ["the-edit", "The Edit", "A sample category ready for owner edits.", "/media/sample-look-01.png", 0],
      ["everyday-layers", "Everyday Layers", "A sample category ready for owner edits.", "/media/sample-look-03.png", 1],
      ["occasion-selection", "Occasion Selection", "A sample category ready for owner edits.", "/media/sample-look-05.png", 2],
    ] as const;
    const insertCategory = connection.prepare("INSERT OR IGNORE INTO categories (slug, name, description, image_path, position, visible, updated_at) VALUES (?, ?, ?, ?, ?, 1, unixepoch() * 1000)");
    for (const row of categoryRows) await insertCategory.run(...row);

    const collectionRows = [
      ["new-edit", "New Edit", "A sample collection for the initial storefront.", "/media/sample-look-02.png", 0],
      ["versatile-selection", "Versatile Selection", "A sample collection for the initial storefront.", "/media/sample-look-06.png", 1],
    ] as const;
    const insertCollection = connection.prepare("INSERT OR IGNORE INTO collections (slug, name, description, image_path, position, visible, updated_at) VALUES (?, ?, ?, ?, ?, 1, unixepoch() * 1000)");
    for (const row of collectionRows) await insertCollection.run(...row);

    const categoryId = (await connection.prepare("SELECT id FROM categories WHERE slug = 'the-edit'").get<{ id: number }>())?.id;
    const everydayId = (await connection.prepare("SELECT id FROM categories WHERE slug = 'everyday-layers'").get<{ id: number }>())?.id;
    const occasionId = (await connection.prepare("SELECT id FROM categories WHERE slug = 'occasion-selection'").get<{ id: number }>())?.id;
    const newEditId = (await connection.prepare("SELECT id FROM collections WHERE slug = 'new-edit'").get<{ id: number }>())?.id;
    const versatileId = (await connection.prepare("SELECT id FROM collections WHERE slug = 'versatile-selection'").get<{ id: number }>())?.id;
    if (!categoryId || !everydayId || !occasionId || !newEditId || !versatileId) throw new Error("Seed taxonomies are unavailable.");

    const sampleProducts = [
      { slug: "sample-look-01-espresso", title: "Sample Look 01 — Espresso", image: "/media/sample-look-01.png", categoryId, collectionId: newEditId, price: 6450 },
      { slug: "sample-look-02-ivory", title: "Sample Look 02 — Ivory", image: "/media/sample-look-02.png", categoryId, collectionId: newEditId, price: 6750 },
      { slug: "sample-look-03-olive", title: "Sample Look 03 — Olive", image: "/media/sample-look-03.png", categoryId: everydayId, collectionId: newEditId, price: 6250 },
      { slug: "sample-look-04-neutral", title: "Sample Look 04 — Neutral", image: "/media/sample-look-04.png", categoryId: everydayId, collectionId: versatileId, price: 6950 },
      { slug: "sample-look-05-deep", title: "Sample Look 05 — Deep", image: "/media/sample-look-05.png", categoryId: occasionId, collectionId: versatileId, price: 7250 },
      { slug: "sample-look-06-soft", title: "Sample Look 06 — Soft", image: "/media/sample-look-06.png", categoryId: occasionId, collectionId: versatileId, price: 7050 },
    ];

    const insertProduct = connection.prepare("INSERT OR IGNORE INTO products (slug, title, description, category_id, collection_id, status, is_featured, is_sample, seo_title, seo_description) VALUES (?, ?, ?, ?, ?, 'PUBLISHED', 1, 1, ?, ?)");
    const insertImage = connection.prepare("INSERT INTO product_images (product_id, path, alt, position) VALUES (?, ?, ?, 0)");
    const insertOption = connection.prepare("INSERT INTO product_options (product_id, name, required, position) VALUES (?, 'Size', 1, 0)");
    const insertValue = connection.prepare("INSERT INTO option_values (option_id, value, position) VALUES (?, ?, ?)");
    const insertVariant = connection.prepare("INSERT INTO variants (product_id, title, sku, price_pkr, stock, active, position) VALUES (?, ?, ?, ?, ?, 1, ?)");
    const linkValue = connection.prepare("INSERT INTO variant_option_values (variant_id, option_value_id) VALUES (?, ?)");

    for (const [productIndex, product] of sampleProducts.entries()) {
      const result = await insertProduct.run(product.slug, product.title, sampleDescription, product.categoryId, product.collectionId, `${product.title} | SHAFFAQ`, sampleDescription);
      if (result.changes === 0) continue;
      const productId = result.lastInsertRowid;
      await insertImage.run(productId, product.image, `${product.title}, sample catalogue photograph`);
      const optionId = (await insertOption.run(productId)).lastInsertRowid;
      for (const [position, size] of ["52", "54", "56"].entries()) {
        const valueId = (await insertValue.run(optionId, size, position)).lastInsertRowid;
        const variantId = (await insertVariant.run(productId, `Size ${size}`, `SAMPLE-${String(productIndex + 1).padStart(3, "0")}-${size}`, product.price, 5 + position, position)).lastInsertRowid;
        await linkValue.run(variantId, valueId);
      }
    }

    await connection.prepare(`INSERT OR IGNORE INTO variant_option_values (variant_id, option_value_id)
      SELECT variants.id, option_values.id FROM variants
      INNER JOIN products ON products.id = variants.product_id
      INNER JOIN product_options ON product_options.product_id = products.id AND product_options.name = 'Size'
      INNER JOIN option_values ON option_values.option_id = product_options.id AND variants.title = 'Size ' || option_values.value
      WHERE products.is_sample = 1 AND variants.sku LIKE 'SAMPLE-%'`).run();

    const sectionRows = [
      ["CATEGORY_GRID", "Shop the edit", "Explore the sample catalogue by mood.", null, null, null, 0],
      ["FEATURED", "New to SHAFFAQ", "Sample products are clearly labelled and ready to edit.", null, "View all", "/search", 1],
      ["CAMPAIGN", "The SHAFFAQ Edit", "A sample campaign section ready for your collection story.", "/media/campaign-wide.jpeg", "Explore", "/collections/versatile-selection", 2],
      ["EDITORIAL", "Versatile by design", "A visual sample area for owner-approved editorial content.", "/media/sample-look-06.png", "Discover the collection", "/collections/versatile-selection", 3],
      ["REVIEWS", "Customer notes", "No verified reviews yet.", null, null, null, 4],
      ["SERVICES", "Shopping information", "Shipping and cash-on-delivery terms come from the settings you configure.", null, null, null, 5],
    ] as const;
    const insertSection = connection.prepare("INSERT OR IGNORE INTO homepage_sections (type, title, body, image_path, link_label, link_url, position, visible) VALUES (?, ?, ?, ?, ?, ?, ?, 1)");
    for (const row of sectionRows) await insertSection.run(...row);

    // Original, branded starter copy for every information page. Informational pages
    // (about/faq/size-guide/care/contact) ship ready (is_template = 0); legal/business
    // pages (shipping/returns/privacy/terms/payments) keep is_template = 1 so the owner
    // sees a review banner and confirms them with legal/tax advice before relying on them.
    // Content is paragraphs joined by "\n" (the /pages/[slug] renderer splits on newlines).
    const policyRows: Array<readonly [string, string, string, number]> = [
      ["about", "About SHAFFAQ", [
        "SHAFFAQ is a Pakistani modestwear label built on a simple belief: modesty and elegance belong together.",
        "",
        "We design abayas and scarves for everyday wear and for the moments that matter — pieces with clean lines, a considered drape, and a calm, timeless palette.",
        "",
        "Each style is made in small batches with close attention to fabric, finish, and fit, so every piece feels as good as it looks.",
        "",
        "We are proud to serve customers across Pakistan with cash on delivery and friendly support on WhatsApp. Thank you for letting SHAFFAQ be part of your wardrobe.",
      ].join("\n"), 0],
      ["faq", "Frequently Asked Questions", [
        "How do I place an order?",
        "Browse the collection, choose your size, add it to your bag, and check out. You can also send us your order on WhatsApp and we'll complete it for you.",
        "",
        "Which payment methods can I use?",
        "Cash on delivery is available all over Pakistan. Any additional methods appear at checkout only when enabled by the store.",
        "",
        "How much is delivery and how long does it take?",
        "Delivery charges are calculated from the current rates and shown before you confirm your order. Delivery times vary by city and courier. See the Shipping page for details.",
        "",
        "Can I change or cancel my order?",
        "Contact us as soon as possible on WhatsApp or by phone. If your order hasn't shipped yet, we'll do our best to help.",
        "",
        "What if my piece doesn't fit?",
        "Please check our Size guide before ordering. If something isn't right, see the Returns & exchanges page to request an exchange.",
        "",
        "How do I care for my abaya or scarf?",
        "See the Care guide for simple steps to keep every piece looking its best.",
        "",
        "How can I reach you?",
        "Message us on WhatsApp or use the details on the Contact page. We're happy to help with sizing, styling, and orders.",
      ].join("\n"), 0],
      ["size-guide", "Size Guide", [
        "SHAFFAQ abayas are designed to fall gracefully with a relaxed, modest silhouette. If you are between sizes, we recommend sizing up for a looser drape.",
        "",
        "How to measure",
        "Use a soft measuring tape over light clothing and keep it level.",
        "",
        "Bust — measure around the fullest part of your chest.",
        "Waist — measure around the narrowest part of your waistline.",
        "Hips — measure around the fullest part of your hips.",
        "Length — measure from the shoulder straight down to just below the ankle for your preferred abaya length.",
        "",
        "Reading the fit",
        "Abayas are meant to sit away from the body rather than fitted, so allow a comfortable margin over your measurements and room to move at the sleeves.",
        "",
        "Still unsure?",
        "Send us your measurements on WhatsApp and we'll recommend the right size before you order.",
      ].join("\n"), 0],
      ["care", "Care Guide", [
        "A little care keeps your abayas and scarves looking elegant for longer. Always check the care label on your garment first.",
        "",
        "Washing",
        "Hand wash, or use a gentle cold delicate cycle with a mild detergent. Avoid bleach and fabric softener.",
        "",
        "Drying",
        "Do not wring. Reshape while damp and air-dry flat or on a padded hanger, away from direct sunlight.",
        "",
        "Ironing",
        "Iron on a low setting, inside out where possible. For delicate fabrics, place a thin cloth between the iron and the garment.",
        "",
        "Storing",
        "Keep pieces on a hanger in a cool, dry place. Fold scarves loosely to avoid hard creases.",
        "",
        "Delicate and embellished pieces",
        "For chiffon or heavily embellished styles, we recommend gentle hand washing or professional dry cleaning.",
      ].join("\n"), 0],
      ["shipping", "Shipping", [
        "SHAFFAQ delivers all over Pakistan.",
        "",
        "Delivery charges",
        "Shipping is calculated from the current store rates and shown clearly before you confirm your order. Where a free-delivery order value applies, it is shown at checkout.",
        "",
        "Cash on delivery",
        "Cash on delivery is available nationwide. Please keep the exact amount ready for the courier.",
        "",
        "Dispatch and tracking",
        "Orders are prepared and handed to our courier partner after confirmation. We'll share updates and any tracking information through WhatsApp or your contact details.",
        "",
        "Delivery times",
        "Delivery times vary by city and courier, and remote areas may take longer. If your order is delayed, contact us and we'll follow up with the courier.",
        "",
        "Addresses",
        "Please provide a complete address and a reachable phone number. Orders that cannot be delivered due to incorrect details may be returned to us.",
      ].join("\n"), 1],
      ["returns", "Returns & Exchanges", [
        "We want you to love your SHAFFAQ pieces. If something isn't right, we're here to help.",
        "",
        "Eligibility",
        "Items must be unworn, unwashed, and in their original condition with any tags attached. Please raise your request within the window confirmed by the store.",
        "",
        "How to request",
        "Contact us on WhatsApp or by phone with your order number and the reason for the return or exchange, and we'll guide you through the next steps.",
        "",
        "Exchanges",
        "Exchanges are subject to availability. If your preferred size or colour is unavailable, we'll discuss the best option with you.",
        "",
        "Refunds",
        "For cash-on-delivery orders, any agreed refund is arranged through a method confirmed with you.",
        "",
        "Non-returnable items",
        "For hygiene reasons, some items may not be eligible for return. Any such exceptions are made clear before purchase.",
      ].join("\n"), 1],
      ["privacy", "Privacy", [
        "SHAFFAQ respects your privacy. This page explains what we collect and why.",
        "",
        "What we collect",
        "To process your order we collect your name, contact number, and delivery address, and — if you choose to provide it — your email. We also keep a record of your orders.",
        "",
        "How we use it",
        "We use your details to confirm and deliver orders, provide support, and, where you have opted in, send occasional updates. We do not sell your personal information.",
        "",
        "WhatsApp",
        "If you contact us on WhatsApp, your messages are also handled under WhatsApp's own terms.",
        "",
        "Data retention",
        "We keep order records for as long as needed to run the business and to meet legal requirements.",
        "",
        "Your choices",
        "You can ask us to update your details or unsubscribe from marketing at any time using the options on our Contact page.",
        "",
        "Payments",
        "Cash on delivery does not require you to share card or bank details with us online.",
      ].join("\n"), 1],
      ["terms", "Terms & Conditions", [
        "These terms govern your use of the SHAFFAQ storefront and your orders.",
        "",
        "Products and pricing",
        "We aim to describe and price every item accurately. Colours may vary slightly between screens. Prices are shown in Pakistani Rupees (PKR).",
        "",
        "Orders",
        "Submitting an order is an offer to purchase, and an order is confirmed once we accept it. We may decline or cancel an order — for example, if an item is out of stock or details cannot be verified.",
        "",
        "Cash on delivery",
        "Where cash on delivery is used, payment is collected by the courier at the time of delivery. Please keep the exact amount ready.",
        "",
        "Cancellations and returns",
        "Cancellations, returns, and exchanges are handled as described on our Returns & exchanges page.",
        "",
        "Acceptable use",
        "Please use the site lawfully and do not attempt to disrupt or misuse it.",
        "",
        "Contact",
        "For any questions about these terms, reach us using the details on the Contact page.",
      ].join("\n"), 1],
      ["payments", "Payment Information", [
        "SHAFFAQ keeps payment simple and secure.",
        "",
        "Cash on delivery",
        "Cash on delivery is available all over Pakistan. You pay the courier in cash when your order arrives, so no card or bank details are shared online. Please keep the exact amount ready.",
        "",
        "Other methods",
        "Additional payment methods — such as bank transfer or online payment — appear at checkout only when enabled by the store. If a method isn't shown, it isn't currently available.",
        "",
        "Order confirmation",
        "An order is confirmed once we accept it. For cash on delivery, payment is not collected until delivery.",
        "",
        "Questions",
        "If you have any questions about paying for your order, message us on WhatsApp or see the Contact page.",
      ].join("\n"), 1],
      ["contact", "Contact", [
        "We'd love to help with sizing, styling, orders, and anything else.",
        "",
        "WhatsApp",
        "The fastest way to reach us is WhatsApp — tap the chat button or message the number shown on the site.",
        "",
        "Email and phone",
        "You'll find our public email and phone in the site footer and, where configured, below.",
        "",
        "Orders and support",
        "Please have your order number ready so we can help you quickly. For returns or exchanges, see the Returns & exchanges page.",
        "",
        "Send us a message",
        "Use the form below and we'll get back to you as soon as we can.",
      ].join("\n"), 0],
    ];
    // Insert fresh, and refresh only rows still carrying the seed placeholder so a
    // re-seed never clobbers content the owner has already edited.
    const insertPolicy = connection.prepare("INSERT OR IGNORE INTO policies (slug, title, content, is_template) VALUES (?, ?, ?, ?)");
    const refreshTemplatePolicy = connection.prepare("UPDATE policies SET title = ?, content = ?, is_template = ? WHERE slug = ? AND content LIKE 'Template requiring%'");
    for (const [slug, title, content, isTemplate] of policyRows) {
      await insertPolicy.run(slug, title, content, isTemplate);
      await refreshTemplatePolicy.run(title, content, isTemplate, slug);
    }

    const insertMedia = connection.prepare("INSERT OR IGNORE INTO media_files (display_name, storage_key, public_path, mime, bytes, sha256) VALUES (?, NULL, ?, ?, ?, ?)");
    for (const asset of assets) {
      const destination = resolve(process.cwd(), asset.destination);
      await insertMedia.run(asset.displayName, asset.publicPath, destination.endsWith(".png") ? "image/png" : "image/jpeg", statSync(destination).size, asset.sha256);
    }

    const liveSettings = await connection.prepare("SELECT shipping_pkr AS shippingPkr, free_shipping_threshold_pkr AS freeShippingThresholdPkr FROM settings WHERE id = 1").get<{ shippingPkr: number; freeShippingThresholdPkr: number | null }>();
    if (!liveSettings) throw new Error("Store settings are unavailable during seed.");
    await connection.prepare(`INSERT INTO shipping_regions (code, name, countries_json, currency, rate_pkr, free_shipping_threshold_pkr, enabled, live_checkout)
      VALUES ('PK', 'Pakistan', '["PK"]', 'PKR', ?, ?, 1, 1) ON CONFLICT(code) DO NOTHING`).run(liveSettings.shippingPkr, liveSettings.freeShippingThresholdPkr);
    if (options.enforceBusinessSettings) {
      await connection.prepare("UPDATE shipping_regions SET rate_pkr = 250, free_shipping_threshold_pkr = 6000, enabled = 1, live_checkout = 1, updated_at = unixepoch() * 1000 WHERE code = 'PK'").run();
    }
    await connection.prepare(`INSERT OR IGNORE INTO stock_movements (variant_id, delta, stock_before, stock_after, reason, source, source_key)
      SELECT id, stock, 0, stock, 'Opening balance adopted when inventory movement tracking was enabled.', 'INITIAL', 'BASELINE:' || id
      FROM variants WHERE NOT EXISTS (SELECT 1 FROM stock_movements sm WHERE sm.variant_id = variants.id)`).run();
  }).immediate();

  return { assets: assets.length, sampleProducts: 6 };
}
