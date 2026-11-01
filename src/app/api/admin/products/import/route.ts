import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database } from "@/db";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse } from "@/server/http";
import { commitProductImport, previewProductImport } from "@/server/product-import";

const schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("PREVIEW"), csv: z.string().max(2_100_000) }).strict(),
  z.object({ mode: z.literal("COMMIT"), csv: z.string().max(2_100_000), previewHash: z.string().regex(/^[a-f0-9]{64}$/), confirmed: z.literal(true) }).strict(),
]);

export async function POST(request: NextRequest) {
  try {
    const actor = await authorizeAdminMutation(request); const input = schema.parse(await request.json());
    if (input.mode === "PREVIEW") return NextResponse.json(await previewProductImport(database, input.csv));
    const result = await withAdminAudit(actor, "catalog.products.import", "product_import", input.previewHash, {}, (connection) => commitProductImport(connection, input.csv, input.previewHash));
    return NextResponse.json(result);
  } catch (error) { return apiErrorResponse(error); }
}
