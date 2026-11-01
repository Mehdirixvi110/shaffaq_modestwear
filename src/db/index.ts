import { validateRuntimeConfiguration } from "@/config/runtime";
import { createDatabaseConnection, type DatabaseConnection } from "./provider";

validateRuntimeConfiguration();

type DatabaseGlobal = typeof globalThis & {
  __shaffaqDatabase?: DatabaseConnection & { close(): Promise<void> };
};

const globalDatabase = globalThis as DatabaseGlobal;
export const database = globalDatabase.__shaffaqDatabase ?? createDatabaseConnection();

if (process.env.NODE_ENV !== "production") globalDatabase.__shaffaqDatabase = database;

export type { DatabaseConnection, PreparedQuery, RunResult } from "./provider";
