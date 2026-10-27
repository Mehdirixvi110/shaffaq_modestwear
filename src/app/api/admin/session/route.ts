import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/server/auth";
import { apiErrorResponse } from "@/server/http";

export const dynamic = "force-dynamic";
export function GET(request: NextRequest) { try { const actor = requireAdminRequest(request); return NextResponse.json({ user: actor, permissions: ["catalog.manage", "cms.manage", "orders.manage", "settings.manage", "media.manage"] }, { headers: { "Cache-Control": "no-store" } }); } catch (error) { return apiErrorResponse(error); } }
