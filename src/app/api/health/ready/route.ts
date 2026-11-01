import { NextResponse } from "next/server";
import { database } from "@/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await database.prepare("SELECT 1").get();
    const migrated = database.provider === "sqlite"
      ? await database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'settings'").get()
      : await database.prepare("SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'settings'").get();
    if (!migrated) throw new Error("Schema is missing");
    return NextResponse.json({ status: "ready", database: database.provider });
  } catch {
    return NextResponse.json({ status: "not-ready" }, { status: 503 });
  }
}
