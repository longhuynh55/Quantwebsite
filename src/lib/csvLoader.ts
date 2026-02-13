import Papa from "papaparse";

export type RawCsvRow = Record<string, string | undefined>;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

export interface ParseResult<T> {
  rows: T[];
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  rejectionReasons: Record<string, number>;
  parseErrorCount: number;
}

function incrementReason(reasons: Record<string, number>, reason: string): void {
  reasons[reason] = (reasons[reason] || 0) + 1;
}

function normalizeRow(row: Record<string, unknown>): RawCsvRow {
  const normalized: RawCsvRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      normalized[key] = trimmed === "" ? undefined : trimmed;
    } else if (value === null || value === undefined) {
      normalized[key] = undefined;
    } else {
      normalized[key] = String(value).trim() || undefined;
    }
  }
  return normalized;
}

export function parseCsvWithValidation<T>(
  content: string,
  validateRow: (row: RawCsvRow, rowNumber: number) => ValidationResult<T>
): ParseResult<T> {
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim().toLowerCase(),
  });

  const rows: T[] = [];
  const rejectionReasons: Record<string, number> = {};
  let rejectedRows = 0;

  for (const error of parsed.errors) {
    const code = error.code || "unknown";
    incrementReason(rejectionReasons, `parse_${code}`);
  }

  for (let i = 0; i < parsed.data.length; i++) {
    const raw = normalizeRow(parsed.data[i] as Record<string, unknown>);
    const rowNumber = i + 2; // +1 for zero-indexing, +1 for header row
    const result = validateRow(raw, rowNumber);
    if (result.ok) {
      rows.push(result.value);
    } else {
      rejectedRows += 1;
      incrementReason(rejectionReasons, result.reason);
    }
  }

  const totalRows = parsed.data.length;
  return {
    rows,
    totalRows,
    acceptedRows: rows.length,
    rejectedRows,
    rejectionReasons,
    parseErrorCount: parsed.errors.length,
  };
}
