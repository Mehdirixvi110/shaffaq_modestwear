import { describe, expect, it } from "vitest";
import { createCsv, parseCsv } from "../src/lib/csv";

describe("CSV portability", () => {
  it("prefixes spreadsheet formulas and quotes commas", () => {
    expect(createCsv(["name", "note"], [["=HYPERLINK(\"bad\")", "safe, value"]])).toBe("name,note\r\n\"'=HYPERLINK(\"\"bad\"\")\",\"safe, value\"\r\n");
  });

  it("parses quoted fields for preview validation", () => {
    expect(parseCsv('a,b\r\n"one, two","say ""hi"""\r\n')).toEqual([["a", "b"], ["one, two", 'say "hi"']]);
  });
});
