import { describe, expect, it } from "vitest";
import { translateSqliteQuery } from "../src/db/provider";

describe("database provider SQL compatibility", () => {
  it("binds parameters without touching quoted question marks", () => {
    expect(translateSqliteQuery("SELECT '?' AS literal, value AS camelCase FROM example WHERE id = ? AND name = ?"))
      .toBe("SELECT '?' AS literal, value AS \"camelCase\" FROM example WHERE id = $1 AND name = $2");
  });

  it("ports SQLite time, case-insensitive search, and aggregation primitives", () => {
    const translated = translateSqliteQuery("SELECT GROUP_CONCAT(name || ': ' || value, ', ') AS options FROM rows WHERE title LIKE ? AND updated_at < unixepoch() * 1000");
    expect(translated).toContain("STRING_AGG(name || ': ' || value, ', ')");
    expect(translated).toContain("title ILIKE $1");
    expect(translated).toContain("floor(extract(epoch from clock_timestamp()) * 1000)::bigint");
  });

  it("turns ignored inserts into conflict-safe PostgreSQL inserts with returned identity", () => {
    expect(translateSqliteQuery("INSERT OR IGNORE INTO items (slug) VALUES (?)", true))
      .toBe("INSERT INTO items (slug) VALUES ($1) ON CONFLICT DO NOTHING RETURNING *");
  });
});
