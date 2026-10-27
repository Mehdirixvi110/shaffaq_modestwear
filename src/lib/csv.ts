const DANGEROUS_CELL = /^[=+\-@\t\r]/;

export function safeSpreadsheetCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return DANGEROUS_CELL.test(text) ? `'${text}` : text;
}

export function csvEscape(value: unknown) {
  const text = safeSpreadsheetCell(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createCsv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(cell); cell = ""; }
    else if (character === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += character;
  }
  if (quoted) throw new Error("CSV_UNCLOSED_QUOTE");
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((entry) => entry.some((value) => value.trim() !== ""));
}
