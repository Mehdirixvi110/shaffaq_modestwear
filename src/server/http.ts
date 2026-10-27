import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "VALIDATION_ERROR", message: "Check the submitted fields.", fields: error.flatten().fieldErrors }, { status: 422 });
  }
  if (error instanceof Error && error.message === "STOCK_CHANGED") {
    return NextResponse.json({ error: "STOCK_CHANGED", message: "Stock changed. Review your cart and try again." }, { status: 409 });
  }
  console.error("Unhandled request error", error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "The request could not be completed." }, { status: 500 });
}
