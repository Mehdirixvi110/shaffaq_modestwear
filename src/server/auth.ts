import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { sqlite } from "@/db";
import { canAccessAdmin, hashToken } from "@/lib/security";
import { ApiError } from "./http";
import { SESSION_COOKIE } from "./protection";

export type AdminActor = { id: number; email: string; displayName: string };

type SessionRow = AdminActor & { role: string; expiresAt: number };

function findSession(rawToken: string | undefined) {
  if (!rawToken) return null;
  return sqlite.prepare(`
    SELECT users.id, users.email, users.display_name AS displayName, users.role, sessions.expires_at AS expiresAt
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `).get(hashToken(rawToken)) as SessionRow | undefined;
}

function actorFromRow(row: SessionRow | null | undefined) {
  if (!row || !canAccessAdmin(row.role, row.expiresAt)) return null;
  return { id: row.id, email: row.email, displayName: row.displayName };
}

export function requireAdminRequest(request: NextRequest) {
  const row = findSession(request.cookies.get(SESSION_COOKIE)?.value);
  const actor = actorFromRow(row);
  if (!actor) throw new ApiError(401, "ADMIN_AUTH_REQUIRED", "Administrator sign-in is required.");
  return actor;
}

export async function getAdminPageActor() {
  const store = await cookies();
  return actorFromRow(findSession(store.get(SESSION_COOKIE)?.value));
}

export function deleteSession(rawToken: string | undefined) {
  if (!rawToken) return;
  sqlite.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(rawToken));
}
