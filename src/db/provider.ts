import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import postgres, { type Sql } from "postgres";
import { databaseProvider } from "../config/runtime";

export type RunResult = {
  changes: number;
  lastInsertRowid: number;
};

export type PreparedQuery = {
  get<T = Record<string, unknown>>(...parameters: unknown[]): Promise<T | undefined>;
  all<T = Record<string, unknown>>(...parameters: unknown[]): Promise<T[]>;
  run(...parameters: unknown[]): Promise<RunResult>;
};

export type DatabaseConnection = {
  readonly provider: "sqlite" | "postgres";
  prepare(query: string): PreparedQuery;
  transaction<T>(callback: () => T | Promise<T>): { immediate(): Promise<T> };
};

type QueryResult = { rows: Array<Record<string, unknown>>; count: number };
type Executor = (query: string, parameters: unknown[], returning: boolean) => Promise<QueryResult>;

type PostgresExecutor = Pick<Sql, "unsafe">;

function postgresError(error: unknown): never {
  if (error && typeof error === "object" && "code" in error && error.code === "23505") {
    const constraint = "constraint_name" in error && typeof error.constraint_name === "string" ? error.constraint_name : "unknown";
    throw new Error(`UNIQUE constraint violation (${constraint}).`, { cause: error });
  }
  throw error;
}

function quoteCamelCaseAliases(query: string) {
  return query.replace(/\bAS\s+([a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*)\b/g, 'AS "$1"');
}

function replacePlaceholders(query: string) {
  let output = "";
  let parameter = 0;
  let singleQuoted = false;
  let doubleQuoted = false;
  for (let index = 0; index < query.length; index += 1) {
    const character = query[index];
    const next = query[index + 1];
    if (character === "'" && !doubleQuoted) {
      output += character;
      if (singleQuoted && next === "'") {
        output += next;
        index += 1;
      } else {
        singleQuoted = !singleQuoted;
      }
      continue;
    }
    if (character === '"' && !singleQuoted) {
      output += character;
      if (doubleQuoted && next === '"') {
        output += next;
        index += 1;
      } else {
        doubleQuoted = !doubleQuoted;
      }
      continue;
    }
    if (character === "?" && !singleQuoted && !doubleQuoted) {
      parameter += 1;
      output += `$${parameter}`;
    } else {
      output += character;
    }
  }
  return output;
}

export function translateSqliteQuery(query: string, returning = false) {
  let translated = query.trim().replace(/;$/, "");
  const ignoredInsert = /^INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(translated);
  translated = translated
    .replace(/^INSERT\s+OR\s+IGNORE\s+INTO\b/i, "INSERT INTO")
    .replace(/unixepoch\(\)\s*\*\s*1000/gi, "floor(extract(epoch from clock_timestamp()) * 1000)::bigint")
    .replace(/GROUP_CONCAT\(([^,]+),\s*'([^']*)'\)/gi, "STRING_AGG($1, '$2')")
    .replace(/\bLIKE\b/gi, "ILIKE");
  translated = quoteCamelCaseAliases(translated);
  if (ignoredInsert && !/\bON\s+CONFLICT\b/i.test(translated)) translated += " ON CONFLICT DO NOTHING";
  if (returning && /^INSERT\b/i.test(translated) && !/\bRETURNING\b/i.test(translated)) translated += " RETURNING *";
  return replacePlaceholders(translated);
}

function postgresExecutor(connection: PostgresExecutor): Executor {
  return async (query, parameters, returning) => {
    try {
      const result = await connection.unsafe(translateSqliteQuery(query, returning), parameters as never[]);
      return { rows: Array.from(result) as Array<Record<string, unknown>>, count: result.count ?? result.length };
    } catch (error) {
      postgresError(error);
    }
  };
}

function sqliteExecutor(connection: Database.Database): Executor {
  return async (query, parameters, returning) => {
    const statement = connection.prepare(query);
    if (/^\s*(SELECT|WITH|PRAGMA)\b/i.test(query)) {
      const rows = statement.all(...parameters) as Array<Record<string, unknown>>;
      return { rows, count: rows.length };
    }
    const result = statement.run(...parameters);
    let rows: Array<Record<string, unknown>> = [];
    if (returning && /^\s*INSERT\b/i.test(query) && Number(result.changes) > 0) {
      rows = [{ id: Number(result.lastInsertRowid) }];
    }
    return { rows, count: Number(result.changes) };
  };
}

function postgresUrlWithSchema(rawUrl: string, schema: string | undefined) {
  if (!schema || schema === "public") return rawUrl;
  if (!/^[a-z][a-z0-9_]{0,62}$/i.test(schema)) throw new Error("DATABASE_SCHEMA must be a simple PostgreSQL identifier.");
  const url = new URL(rawUrl);
  url.searchParams.set("options", `-c search_path=${schema},public`);
  return url.toString();
}

function createPostgresClient(url: string) {
  return postgres(postgresUrlWithSchema(url, process.env.DATABASE_SCHEMA), {
    ssl: "require",
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: () => undefined,
    debug: process.env.DATABASE_DEBUG === "1" ? (_connection, query) => console.error(`[database] ${query}`) : false,
    transform: {
      value: {
        from(value, column) {
          if (column.type === 20 && typeof value === "string") {
            const parsed = Number(value);
            return Number.isSafeInteger(parsed) ? parsed : value;
          }
          return value;
        },
      },
    },
  });
}

export function createDatabaseConnection(options: { provider?: "sqlite" | "postgres"; sqlitePath?: string; postgresUrl?: string } = {}): DatabaseConnection & { close(): Promise<void> } {
  const provider = options.provider ?? databaseProvider();
  const transactionContext = new AsyncLocalStorage<Executor>();
  let nativeSqlite: Database.Database | undefined;
  let postgresClient: Sql | undefined;
  let queue = Promise.resolve();

  const enqueue = <T>(operation: () => Promise<T>) => {
    const result = queue.then(operation, operation);
    queue = result.then(() => undefined, () => undefined);
    return result;
  };

  let rootExecutor: Executor;
  if (provider === "sqlite") {
    const databasePath = resolve(/* turbopackIgnore: true */ process.cwd(), options.sqlitePath ?? process.env.SQLITE_PATH ?? ".data/db/shaffaq.sqlite");
    mkdirSync(dirname(databasePath), { recursive: true });
    nativeSqlite = new Database(databasePath);
    nativeSqlite.pragma("foreign_keys = ON");
    nativeSqlite.pragma("journal_mode = WAL");
    nativeSqlite.pragma("busy_timeout = 5000");
    nativeSqlite.pragma("synchronous = NORMAL");
    nativeSqlite.defaultSafeIntegers(false);
    rootExecutor = sqliteExecutor(nativeSqlite);
  } else {
    const url = options.postgresUrl ?? process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is required when DATABASE_PROVIDER=postgres.");
    postgresClient = createPostgresClient(url);
    rootExecutor = postgresExecutor(postgresClient);
  }

  const execute: Executor = (query, parameters, returning) => {
    const scoped = transactionContext.getStore();
    if (scoped) return scoped(query, parameters, returning);
    return enqueue(() => rootExecutor(query, parameters, returning));
  };

  const connection: DatabaseConnection & { close(): Promise<void> } = {
    provider,
    prepare(query) {
      return {
        async get<T>(...parameters: unknown[]) {
          const result = await execute(query, parameters, false);
          return result.rows[0] as T | undefined;
        },
        async all<T>(...parameters: unknown[]) {
          const result = await execute(query, parameters, false);
          return result.rows as T[];
        },
        async run(...parameters: unknown[]) {
          const result = await execute(query, parameters, true);
          const id = result.rows[0]?.id;
          return { changes: result.count, lastInsertRowid: typeof id === "number" ? id : Number(id ?? 0) };
        },
      };
    },
    transaction<T>(callback: () => T | Promise<T>) {
      return {
        immediate: async () => {
          if (transactionContext.getStore()) return await callback();
          if (provider === "sqlite") {
            return enqueue(async () => {
              const native = nativeSqlite!;
              native.exec("BEGIN IMMEDIATE");
              try {
                const result = await transactionContext.run(sqliteExecutor(native), callback);
                native.exec("COMMIT");
                return result;
              } catch (error) {
                native.exec("ROLLBACK");
                throw error;
              }
            });
          }
          return enqueue(async () => await postgresClient!.begin(async (transaction) => transactionContext.run(postgresExecutor(transaction), callback)) as T);
        },
      };
    },
    async close() {
      await queue;
      if (nativeSqlite) nativeSqlite.close();
      if (postgresClient) await postgresClient.end({ timeout: 5 });
    },
  };
  return connection;
}
