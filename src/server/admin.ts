import type { NextRequest } from "next/server";
import { database, type DatabaseConnection } from "@/db";
import type { AdminActor } from "./auth";
import { requireAdminRequest } from "./auth";
import { assertMutationRequest } from "./protection";

export async function authorizeAdminMutation(request: NextRequest) {
  assertMutationRequest(request);
  return requireAdminRequest(request);
}

export function withAdminAudit<T>(actor: AdminActor, action: string, entityType: string, entityId: string | null, detail: Record<string, unknown>, mutation: (connection: DatabaseConnection) => T | Promise<T>) {
  return database.transaction(async () => {
    const result = await mutation(database);
    await database.prepare("INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, detail_json) VALUES (?, ?, ?, ?, ?)")
      .run(actor.id, action, entityType, entityId, JSON.stringify(detail));
    return result;
  }).immediate();
}
