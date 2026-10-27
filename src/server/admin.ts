import type Database from "better-sqlite3";
import type { NextRequest } from "next/server";
import { sqlite } from "@/db";
import type { AdminActor } from "./auth";
import { requireAdminRequest } from "./auth";
import { assertMutationRequest } from "./protection";

export function authorizeAdminMutation(request: NextRequest) {
  assertMutationRequest(request);
  return requireAdminRequest(request);
}

export function withAdminAudit<T>(actor: AdminActor, action: string, entityType: string, entityId: string | null, detail: Record<string, unknown>, mutation: (connection: Database.Database) => T) {
  const execute = sqlite.transaction(() => {
    const result = mutation(sqlite);
    sqlite.prepare(`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, detail_json) VALUES (?, ?, ?, ?, ?)`)
      .run(actor.id, action, entityType, entityId, JSON.stringify(detail));
    return result;
  });
  return execute.immediate();
}
