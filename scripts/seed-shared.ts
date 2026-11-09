import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { DatabaseConnection } from "../src/db/provider";
import { seedEditorialContent } from "./content-data";

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

const sampleDescription = "A beautifully crafted SHAFFAQ piece designed for comfort and everyday elegance.";

export async function seedDatabase(connection: DatabaseConnection, options: { enforceBusinessSettings: boolean }) {
  await connection.transaction(async () => {
    await connection.prepare(`INSERT OR IGNORE INTO settings (
      id, store_name, descriptor, announcement, hero_eyebrow, hero_title, hero_body,
      hero_cta_label, hero_cta_url, hero_desktop_path, hero_mobile_path,
      header_logo_path, header_logo_alt, footer_logo_path, footer_logo_alt, og_image_path, og_image_alt,
      shipping_pkr, free_shipping_threshold_pkr, cod_enabled,
      whatsapp_number, contact_email, contact_phone
    ) VALUES (1, 'SHAFFAQ', 'Abayas & Scarves',
      NULL,
      'The SHAFFAQ Edit', 'Elegance, in Every Layer.',
      'Abayas and scarves designed for everyday elegance.', 'Explore the edit',
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
      ["the-edit", "The Edit", "A curated edit of SHAFFAQ favourites.", "/media/sample-look-01.png", 0],
      ["everyday-layers", "Everyday Layers", "Easy, everyday modest layers.", "/media/sample-look-03.png", 1],
      ["occasion-selection", "Occasion Selection", "Standout pieces for special occasions.", "/media/sample-look-05.png", 2],
    ] as const;
    const insertCategory = connection.prepare("INSERT OR IGNORE INTO categories (slug, name, description, image_path, position, visible, updated_at) VALUES (?, ?, ?, ?, ?, 1, unixepoch() * 1000)");
    for (const row of categoryRows) await insertCategory.run(...row);

    const collectionRows = [
      ["new-edit", "New Edit", "The newest additions to the SHAFFAQ edit.", "/media/sample-look-02.png", 0],
      ["versatile-selection", "Versatile Selection", "Versatile pieces for every day.", "/media/sample-look-06.png", 1],
      // Navigation-backed collections. They start empty; assign products to them in Admin ->
      // Collections. The storefront nav (src/components/site-header.tsx) links to these slugs.
      ["premium-abayas", "Premium Collection", "Our finest premium abayas.", "/media/sample-look-01.png", 2],
      ["occasion-abayas", "Occasion Wears", "Standout abayas for special occasions.", "/media/sample-look-05.png", 3],
      ["everyday-abayas", "Everyday Abayas", "Comfortable abayas for daily wear.", "/media/sample-look-03.png", 4],
      ["office-abayas", "Office Wears", "Polished abayas for the workplace.", "/media/sample-look-04.png", 5],
      ["printed-scarves", "Printed Scarves", "Printed hijabs and scarves.", "/media/sample-look-02.png", 6],
      ["plain-scarves", "Plain Scarves", "Classic plain hijabs and scarves.", "/media/sample-look-06.png", 7],
      ["occasion-scarves", "Occasion Wears", "Scarves for special occasions.", "/media/sample-look-05.png", 8],
      ["summer-scarves", "Summer Collection", "Light, breathable scarves for warm days.", "/media/sample-look-03.png", 9],
      ["winter-scarves", "Winter Collection", "Warm scarves for cooler weather.", "/media/sample-look-01.png", 10],
      ["premium-scarves", "Premium Wear", "Our premium hijab range.", "/media/sample-look-04.png", 11],
      ["bundle-offers", "Bundle Offers", "Curated bundles at a better price.", "/media/campaign-wide.jpeg", 12],
      ["clearance-sales", "Clearance Sales", "Final-reduction pieces while stocks last.", "/media/sample-look-02.png", 13],
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
      await insertImage.run(productId, product.image, product.title);
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
      ["CATEGORY_GRID", "Shop the edit", "Explore the collection by mood.", null, null, null, 0],
      ["FEATURED", "New to SHAFFAQ", "Discover our latest arrivals.", null, "View all", "/search", 1],
      ["CAMPAIGN", "The SHAFFAQ Edit", "Timeless modest wear, crafted with care.", "/media/campaign-wide.jpeg", "Explore", "/collections/versatile-selection", 2],
      ["EDITORIAL", "Versatile by design", "Pieces that move from day to evening with ease.", "/media/sample-look-06.png", "Discover the collection", "/collections/versatile-selection", 3],
      ["REVIEWS", "Customer notes", "What our customers are saying.", null, null, null, 4],
      ["SERVICES", "Shopping information", "Nationwide delivery and cash on delivery across Pakistan.", null, null, null, 5],
    ] as const;
    const insertSection = connection.prepare("INSERT OR IGNORE INTO homepage_sections (type, title, body, image_path, link_label, link_url, position, visible) VALUES (?, ?, ?, ?, ?, ?, ?, 1)");
    for (const row of sectionRows) await insertSection.run(...row);

    // Information pages + starter blog posts come from the shared editorial source
    // (scripts/content-data.ts), so the full seed and the content-only sync stay identical.
    await seedEditorialContent(connection);

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
