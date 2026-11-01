import { z } from "zod";
import type { DatabaseConnection } from "@/db";
import { canonicalHash } from "@/lib/security";
import { parseCsv } from "@/lib/csv";
import { slugSchema } from "@/lib/validation";
import { adjustStock } from "./inventory";
import { ApiError } from "./http";

const headers = ["product_slug", "title", "description", "status", "category_slug", "collection_slug", "image_path", "featured", "sample", "seo_title", "seo_description", "option_name", "option_value", "sku", "price_pkr", "compare_at_pkr", "stock", "low_stock_threshold", "active"] as const;

const rowSchema = z.object({
  productSlug: slugSchema,
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(20_000),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  categorySlug: slugSchema.nullable(),
  collectionSlug: slugSchema.nullable(),
  imagePath: z.string().trim().max(500).nullable(),
  featured: z.boolean(), sample: z.boolean(),
  seoTitle: z.string().trim().max(160).nullable(), seoDescription: z.string().trim().max(300).nullable(),
  optionName: z.string().trim().min(1).max(80), optionValue: z.string().trim().min(1).max(80),
  sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9._-]+$/).max(64),
  pricePkr: z.number().int().min(0).max(9_000_000_000), compareAtPkr: z.number().int().min(0).max(9_000_000_000).nullable(),
  stock: z.number().int().min(0).max(1_000_000), lowStockThreshold: z.number().int().min(0).max(1_000_000), active: z.boolean(),
}).strict().refine((row) => row.compareAtPkr === null || row.compareAtPkr > row.pricePkr, { message: "Compare-at price must exceed price." });

export type ProductImportRow = z.infer<typeof rowSchema>;
export type ProductImportError = { row: number; messages: string[] };

function bool(value: string) {
  if (["1", "true", "yes"].includes(value.trim().toLowerCase())) return true;
  if (["0", "false", "no"].includes(value.trim().toLowerCase())) return false;
  return value;
}
function number(value: string) { return /^\d+$/.test(value.trim()) ? Number(value) : value; }
function optionalNumber(value: string) { return value.trim() === "" ? null : number(value); }
function nullable(value: string) { return value.trim() || null; }

export async function parseProductImport(connection: DatabaseConnection, text: string) {
  if (Buffer.byteLength(text, "utf8") > 2 * 1024 * 1024) throw new ApiError(413, "IMPORT_TOO_LARGE", "Product CSV must be 2 MiB or smaller.");
  let parsed: string[][];
  try { parsed = parseCsv(text.replace(/^\uFEFF/, "")); } catch { throw new ApiError(422, "INVALID_CSV", "The CSV contains an unclosed quoted field."); }
  if (!parsed.length) return { rows: [] as ProductImportRow[], errors: [{ row: 1, messages: ["CSV is empty."] }] as ProductImportError[] };
  const actualHeaders = parsed[0].map((value) => value.trim());
  if (actualHeaders.length !== headers.length || headers.some((header, index) => actualHeaders[index] !== header)) {
    return { rows: [] as ProductImportRow[], errors: [{ row: 1, messages: [`Headers must exactly match: ${headers.join(",")}`] }] as ProductImportError[] };
  }
  const rows: ProductImportRow[] = [];
  const errors: ProductImportError[] = [];
  const seenSkus = new Set<string>();
  const productSignatures = new Map<string, string>();
  for (const [index, cells] of parsed.slice(1).entries()) {
    const rowNumber = index + 2;
    if (cells.length !== headers.length) { errors.push({ row: rowNumber, messages: [`Expected ${headers.length} columns; received ${cells.length}.`] }); continue; }
    const candidate = {
      productSlug: cells[0], title: cells[1], description: cells[2], status: cells[3], categorySlug: nullable(cells[4]), collectionSlug: nullable(cells[5]), imagePath: nullable(cells[6]),
      featured: bool(cells[7]), sample: bool(cells[8]), seoTitle: nullable(cells[9]), seoDescription: nullable(cells[10]), optionName: cells[11], optionValue: cells[12], sku: cells[13],
      pricePkr: number(cells[14]), compareAtPkr: optionalNumber(cells[15]), stock: number(cells[16]), lowStockThreshold: number(cells[17]), active: bool(cells[18]),
    };
    const result = rowSchema.safeParse(candidate);
    if (!result.success) { errors.push({ row: rowNumber, messages: result.error.issues.map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`) }); continue; }
    const row = result.data;
    if (seenSkus.has(row.sku)) { errors.push({ row: rowNumber, messages: [`Duplicate SKU ${row.sku} in file.`] }); continue; }
    seenSkus.add(row.sku);
    const signature = canonicalHash({ title: row.title, description: row.description, status: row.status, categorySlug: row.categorySlug, collectionSlug: row.collectionSlug, imagePath: row.imagePath, featured: row.featured, sample: row.sample, seoTitle: row.seoTitle, seoDescription: row.seoDescription, optionName: row.optionName });
    const previous = productSignatures.get(row.productSlug);
    if (previous && previous !== signature) { errors.push({ row: rowNumber, messages: [`Product fields for ${row.productSlug} differ between rows.`] }); continue; }
    productSignatures.set(row.productSlug, signature);
    if (row.categorySlug && !await connection.prepare("SELECT 1 FROM categories WHERE slug = ? AND archived = 0").get(row.categorySlug)) errors.push({ row: rowNumber, messages: [`Unknown active category: ${row.categorySlug}.`] });
    if (row.collectionSlug && !await connection.prepare("SELECT 1 FROM collections WHERE slug = ? AND archived = 0").get(row.collectionSlug)) errors.push({ row: rowNumber, messages: [`Unknown active collection: ${row.collectionSlug}.`] });
    if (row.imagePath && !await connection.prepare("SELECT 1 FROM media_files WHERE public_path = ? AND replaced_at IS NULL").get(row.imagePath)) errors.push({ row: rowNumber, messages: [`Unknown available media path: ${row.imagePath}.`] });
    const skuOwner = await connection.prepare("SELECT p.slug FROM variants v JOIN products p ON p.id = v.product_id WHERE v.sku = ?").get<{ slug: string }>(row.sku);
    if (skuOwner && skuOwner.slug !== row.productSlug) errors.push({ row: rowNumber, messages: [`SKU ${row.sku} belongs to ${skuOwner.slug}.`] });
    rows.push(row);
  }
  return { rows, errors };
}

export async function productImportFingerprint(connection: DatabaseConnection, text: string, rows: ProductImportRow[]) {
  const slugs = [...new Set(rows.map((row) => row.productSlug))];
  const skus = rows.map((row) => row.sku);
  const [products, variants] = await Promise.all([
    slugs.length ? connection.prepare(`SELECT slug, version FROM products WHERE slug IN (${slugs.map(() => "?").join(",")}) ORDER BY slug`).all(...slugs) : Promise.resolve([]),
    skus.length ? connection.prepare(`SELECT sku, version, stock FROM variants WHERE sku IN (${skus.map(() => "?").join(",")}) ORDER BY sku`).all(...skus) : Promise.resolve([]),
  ]);
  const references = rows.map((row) => ({ categorySlug: row.categorySlug, collectionSlug: row.collectionSlug, imagePath: row.imagePath })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return canonicalHash({ text, products, variants, references });
}

export async function previewProductImport(connection: DatabaseConnection, text: string) {
  const result = await parseProductImport(connection, text);
  return { rowCount: result.rows.length, errors: result.errors, previewHash: result.errors.length ? null : await productImportFingerprint(connection, text, result.rows) };
}

export async function commitProductImport(connection: DatabaseConnection, text: string, previewHash: string) {
  const parsed = await parseProductImport(connection, text);
  if (parsed.errors.length) throw new ApiError(422, "IMPORT_INVALID", "The import has row errors. Preview and correct it before confirming.");
  const currentHash = await productImportFingerprint(connection, text, parsed.rows);
  if (currentHash !== previewHash) throw new ApiError(409, "IMPORT_PREVIEW_STALE", "Catalogue data changed after preview. Preview the file again before confirming.");
  const groups = new Map<string, ProductImportRow[]>();
  for (const row of parsed.rows) groups.set(row.productSlug, [...(groups.get(row.productSlug) ?? []), row]);
  let productCount = 0; let variantCount = 0;
  for (const [slug, productRows] of groups) {
    const first = productRows[0];
    const categoryId = first.categorySlug ? (await connection.prepare("SELECT id FROM categories WHERE slug = ? AND archived = 0").get<{ id: number }>(first.categorySlug))?.id ?? null : null;
    const collectionId = first.collectionSlug ? (await connection.prepare("SELECT id FROM collections WHERE slug = ? AND archived = 0").get<{ id: number }>(first.collectionSlug))?.id ?? null : null;
    let product = await connection.prepare("SELECT id FROM products WHERE slug = ?").get<{ id: number }>(slug);
    if (product) await connection.prepare("UPDATE products SET title = ?, description = ?, category_id = ?, collection_id = ?, status = ?, is_featured = ?, is_sample = ?, seo_title = ?, seo_description = ?, version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ?")
      .run(first.title, first.description, categoryId, collectionId, first.status, first.featured ? 1 : 0, first.sample ? 1 : 0, first.seoTitle, first.seoDescription, product.id);
    else {
      const inserted = await connection.prepare("INSERT INTO products (slug, title, description, category_id, collection_id, status, is_featured, is_sample, seo_title, seo_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(slug, first.title, first.description, categoryId, collectionId, first.status, first.featured ? 1 : 0, first.sample ? 1 : 0, first.seoTitle, first.seoDescription);
      product = { id: inserted.lastInsertRowid };
    }
    await connection.prepare("DELETE FROM product_images WHERE product_id = ?").run(product.id);
    if (first.imagePath) await connection.prepare("INSERT INTO product_images (product_id, path, alt, position) VALUES (?, ?, ?, 0)").run(product.id, first.imagePath, first.title);
    let option = await connection.prepare("SELECT id FROM product_options WHERE product_id = ? ORDER BY position, id LIMIT 1").get<{ id: number }>(product.id);
    if (option) await connection.prepare("UPDATE product_options SET name = ?, required = 1 WHERE id = ?").run(first.optionName, option.id);
    else option = { id: (await connection.prepare("INSERT INTO product_options (product_id, name, required, position) VALUES (?, ?, 1, 0)").run(product.id, first.optionName)).lastInsertRowid };
    for (const [position, row] of productRows.entries()) {
      let value = await connection.prepare("SELECT id FROM option_values WHERE option_id = ? AND value = ?").get<{ id: number }>(option.id, row.optionValue);
      if (value) await connection.prepare("UPDATE option_values SET position = ? WHERE id = ?").run(position, value.id);
      else value = { id: (await connection.prepare("INSERT INTO option_values (option_id, value, position) VALUES (?, ?, ?)").run(option.id, row.optionValue, position)).lastInsertRowid };
      let variant = await connection.prepare("SELECT id, stock, version FROM variants WHERE sku = ? AND product_id = ?").get<{ id: number; stock: number; version: number }>(row.sku, product.id);
      if (variant) {
        await connection.prepare("UPDATE variants SET title = ?, price_pkr = ?, compare_at_pkr = ?, low_stock_threshold = ?, active = ?, position = ?, version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ?")
          .run(`${first.optionName} ${row.optionValue}`, row.pricePkr, row.compareAtPkr, row.lowStockThreshold, row.active ? 1 : 0, position, variant.id);
        variant.version += 1;
      } else {
        const inserted = await connection.prepare("INSERT INTO variants (product_id, title, sku, price_pkr, compare_at_pkr, stock, low_stock_threshold, active, position) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)")
          .run(product.id, `${first.optionName} ${row.optionValue}`, row.sku, row.pricePkr, row.compareAtPkr, row.lowStockThreshold, row.active ? 1 : 0, position);
        variant = { id: inserted.lastInsertRowid, stock: 0, version: 1 };
      }
      if (variant.stock !== row.stock) await adjustStock(connection, { variantId: variant.id, delta: row.stock - variant.stock, expectedVersion: variant.version, reason: `Confirmed product CSV import ${previewHash.slice(0, 12)}.`, source: "PRODUCT_IMPORT", sourceKey: `PRODUCT_IMPORT:${previewHash}:${row.sku}` });
      await connection.prepare("DELETE FROM variant_option_values WHERE variant_id = ?").run(variant.id);
      await connection.prepare("INSERT INTO variant_option_values (variant_id, option_value_id) VALUES (?, ?)").run(variant.id, value.id);
      variantCount += 1;
    }
    productCount += 1;
  }
  return { productCount, variantCount };
}
