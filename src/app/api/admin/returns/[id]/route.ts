import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse, ApiError } from "@/server/http";

const schema = z.object({ action: z.enum(["APPROVE", "REJECT", "RECEIVE", "COMPLETE", "CANCEL"]), note: z.string().trim().max(1000).nullable(), expectedVersion: z.number().int().positive() }).strict();
const transitions: Record<string, Partial<Record<string, string>>> = {
  REQUESTED: { APPROVE: "APPROVED", REJECT: "REJECTED", CANCEL: "CANCELLED" },
  APPROVED: { RECEIVE: "RECEIVED", CANCEL: "CANCELLED" },
  RECEIVED: { COMPLETE: "COMPLETED" },
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authorizeAdminMutation(request); const id = z.uuid().parse((await context.params).id); const input = schema.parse(await request.json());
    if (["REJECT", "CANCEL"].includes(input.action) && (!input.note || input.note.length < 3)) throw new ApiError(422, "NOTE_REQUIRED", "A reason is required for rejection or cancellation.");
    const result = await withAdminAudit(actor, `returns.${input.action.toLowerCase()}`, "return_request", id, { note: input.note }, async (connection) => {
      const current = await connection.prepare(`SELECT order_id AS orderId, kind, status, version FROM return_requests WHERE id = ?${connection.provider === "postgres" ? " FOR UPDATE" : ""}`).get<{ orderId: string; kind: string; status: string; version: number }>(id);
      if (!current) throw new ApiError(404, "REQUEST_NOT_FOUND", "Return or exchange request not found.");
      if (current.version !== input.expectedVersion) throw new ApiError(409, "VERSION_CONFLICT", "This request changed in another session. Reload and try again.");
      const status = transitions[current.status]?.[input.action];
      if (!status) throw new ApiError(409, "ILLEGAL_TRANSITION", "This request cannot move to that status.");
      const update = await connection.prepare("UPDATE return_requests SET status = ?, resolution_note = COALESCE(?, resolution_note), actor_user_id = ?, version = version + 1, updated_at = unixepoch() * 1000 WHERE id = ? AND version = ?")
        .run(status, input.note, actor.id, id, input.expectedVersion);
      if (update.changes !== 1) throw new ApiError(409, "VERSION_CONFLICT", "This request changed in another session. Reload and try again.");
      await connection.prepare("INSERT INTO order_history (order_id, event, note, actor_user_id) VALUES (?, ?, ?, ?)").run(current.orderId, `${current.kind}_${status}`, input.note, actor.id);
      return { id, status, version: input.expectedVersion + 1 };
    });
    return NextResponse.json(result);
  } catch (error) { return apiErrorResponse(error); }
}
