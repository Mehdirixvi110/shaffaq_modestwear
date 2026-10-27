import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse, ApiError } from "@/server/http";

const schema = z.object({ status: z.enum(["APPROVED", "REJECTED"]), expectedStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]) }).strict();

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = authorizeAdminMutation(request); const id = z.uuid().parse((await context.params).id); const input = schema.parse(await request.json());
    withAdminAudit(actor, `reviews.${input.status.toLowerCase()}`, "review", id, {}, (connection) => {
      const update = connection.prepare("UPDATE reviews SET status = ?, moderated_by = ?, moderated_at = unixepoch() * 1000 WHERE id = ? AND status = ?")
        .run(input.status, actor.id, id, input.expectedStatus);
      if (update.changes !== 1) {
        if (!connection.prepare("SELECT 1 FROM reviews WHERE id = ?").get(id)) throw new ApiError(404, "REVIEW_NOT_FOUND", "Review not found.");
        throw new ApiError(409, "VERSION_CONFLICT", "This review changed in another session. Reload and try again.");
      }
    });
    return NextResponse.json({ id, status: input.status });
  } catch (error) { return apiErrorResponse(error); }
}
