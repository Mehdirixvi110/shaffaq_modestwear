import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse, ApiError } from "@/server/http";

const schema = z.object({ title: z.string().trim().min(1).max(160), content: z.string().trim().min(20).max(30000), reviewed: z.boolean() }).strict();
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) { try { const actor = authorizeAdminMutation(request); const id = z.coerce.number().int().positive().parse((await context.params).id); const input = schema.parse(await request.json()); withAdminAudit(actor, "cms.policy.update", "policy", String(id), { reviewed: input.reviewed }, (connection) => { const result = connection.prepare("UPDATE policies SET title=?, content=?, is_template=?, updated_at=unixepoch()*1000 WHERE id=?").run(input.title, input.content, input.reviewed ? 0 : 1, id); if (!result.changes) throw new ApiError(404, "POLICY_NOT_FOUND", "Policy not found."); }); return NextResponse.json({ id }); } catch (error) { return apiErrorResponse(error); } }
