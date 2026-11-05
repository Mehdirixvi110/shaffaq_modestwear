import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse, ApiError } from "@/server/http";
import { deleteReview, updateReview } from "@/server/reviews";
import { reviewFields } from "../route";

const schema = z.object({ status: z.enum(["APPROVED", "REJECTED"]), expectedStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]) }).strict();
const putSchema = reviewFields.extend({ expectedVersion: z.number().int().positive() }).strict();
const deleteSchema = z.object({ expectedVersion: z.number().int().positive() }).strict();

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authorizeAdminMutation(request); const id = z.uuid().parse((await context.params).id); const input = schema.parse(await request.json());
    await withAdminAudit(actor, `reviews.${input.status.toLowerCase()}`, "review", id, {}, async (connection) => {
      const update = await connection.prepare("UPDATE reviews SET status = ?, moderated_by = ?, moderated_at = unixepoch() * 1000, version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ? AND status = ?")
        .run(input.status, actor.id, id, input.expectedStatus);
      if (update.changes !== 1) {
        if (!await connection.prepare("SELECT 1 FROM reviews WHERE id = ?").get(id)) throw new ApiError(404, "REVIEW_NOT_FOUND", "Review not found.");
        throw new ApiError(409, "VERSION_CONFLICT", "This review changed in another session. Reload and try again.");
      }
    });
    return NextResponse.json({ id, status: input.status });
  } catch (error) { return apiErrorResponse(error); }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authorizeAdminMutation(request); const id = z.uuid().parse((await context.params).id);
    const { expectedVersion, ...fields } = putSchema.parse(await request.json());
    const result = await withAdminAudit(actor, "reviews.update", "review", id, { status: fields.status, featured: fields.featured }, (connection) => updateReview(connection, id, fields, expectedVersion));
    return NextResponse.json(result);
  } catch (error) { return apiErrorResponse(error); }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authorizeAdminMutation(request); const id = z.uuid().parse((await context.params).id);
    const { expectedVersion } = deleteSchema.parse(await request.json());
    const result = await withAdminAudit(actor, "reviews.delete", "review", id, {}, (connection) => deleteReview(connection, id, expectedVersion));
    return NextResponse.json(result);
  } catch (error) { return apiErrorResponse(error); }
}
