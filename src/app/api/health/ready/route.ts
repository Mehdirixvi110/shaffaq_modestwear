import { NextResponse } from "next/server";
import { sqlite } from "@/db";

export function GET() {
  try {
    sqlite.prepare("SELECT 1").get();
    const migrated = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'settings'").get();
    if (!migrated) throw new Error("Schema is missing");
    return NextResponse.json({ status: "ready" });
  } catch {
    return NextResponse.json({ status: "not-ready" }, { status: 503 });
  }
}
