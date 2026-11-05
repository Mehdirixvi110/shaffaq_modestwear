import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nullableText } from "@/lib/validation";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse, ApiError } from "@/server/http";

const schema = z.object({
  status: z.enum(["NEW", "CONTACTED", "CLOSED"]),
  adminNotes: nullableText(2000),
  expectedVersion: z.number().int().positive(),
}).strict();

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authorizeAdminMutation(request);
    const id = z.uuid().parse((await context.params).id);
    const { status, adminNotes, expectedVersion } = schema.parse(await request.json());
    const result = await withAdminAudit(actor, "leads.update", "lead", id, { status }, async (connection) => {
      const update = await connection.prepare("UPDATE leads SET status = ?, admin_notes = ?, version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ? AND version = ?")
        .run(status, adminNotes, id, expectedVersion);
      if (update.changes !== 1) {
        if (!await connection.prepare("SELECT 1 FROM leads WHERE id = ?").get(id)) throw new ApiError(404, "LEAD_NOT_FOUND", "Lead not found.");
        throw new ApiError(409, "VERSION_CONFLICT", "This lead changed in another session. Reload and try again.");
      }
      return { id, version: expectedVersion + 1 };
    });
    return NextResponse.json(result);
  } catch (error) { return apiErrorResponse(error); }
}
