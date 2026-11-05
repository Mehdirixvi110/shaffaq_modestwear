import { randomUUID } from "node:crypto";
import type { DatabaseConnection } from "@/db";
import { ApiError } from "./http";

export type AdminReviewInput = {
  customerName: string;
  city: string | null;
  rating: number;
  title: string | null;
  body: string;
  reviewDate: number;
  productId: number | null;
  featured: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

async function assertProductExists(connection: DatabaseConnection, productId: number | null) {
  if (productId === null) return;
  const product = await connection.prepare("SELECT 1 FROM products WHERE id = ?").get(productId);
  if (!product) throw new ApiError(422, "INVALID_PRODUCT", "The selected product no longer exists.");
}

async function assertGoneOrConflict(connection: DatabaseConnection, id: string): Promise<never> {
  if (!await connection.prepare("SELECT 1 FROM reviews WHERE id = ?").get(id)) throw new ApiError(404, "REVIEW_NOT_FOUND", "Review not found.");
  throw new ApiError(409, "VERSION_CONFLICT", "This review changed in another session. Reload and try again.");
}

export async function createAdminReview(connection: DatabaseConnection, input: AdminReviewInput) {
  await assertProductExists(connection, input.productId);
  const id = randomUUID();
  await connection.prepare(`INSERT INTO reviews (id, product_id, customer_name, source, city, rating, title, body, status, featured, review_date, version)
    VALUES (?, ?, ?, 'ADMIN', ?, ?, ?, ?, ?, ?, ?, 1)`)
    .run(id, input.productId, input.customerName, input.city, input.rating, input.title, input.body, input.status, input.featured ? 1 : 0, input.reviewDate);
  return id;
}

export async function updateReview(connection: DatabaseConnection, id: string, input: AdminReviewInput, expectedVersion: number) {
  await assertProductExists(connection, input.productId);
  const update = await connection.prepare(`UPDATE reviews SET product_id = ?, customer_name = ?, city = ?, rating = ?, title = ?, body = ?, status = ?, featured = ?, review_date = ?, version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ? AND version = ?`)
    .run(input.productId, input.customerName, input.city, input.rating, input.title, input.body, input.status, input.featured ? 1 : 0, input.reviewDate, id, expectedVersion);
  if (update.changes !== 1) await assertGoneOrConflict(connection, id);
  return { id, version: expectedVersion + 1 };
}

export async function deleteReview(connection: DatabaseConnection, id: string, expectedVersion: number) {
  const result = await connection.prepare("DELETE FROM reviews WHERE id = ? AND version = ?").run(id, expectedVersion);
  if (result.changes !== 1) await assertGoneOrConflict(connection, id);
  return { id };
}
