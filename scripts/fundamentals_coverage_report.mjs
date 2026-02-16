#!/usr/bin/env node

import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import Papa from "papaparse";

const FUNDAMENTALS_FILES = {
  bs: "HOSE_VERIFIED_BalanceSheet_Quarterly_2018_2025.csv",
  is: "HOSE_VERIFIED_IncomeStatement_Quarterly_2018_2025.csv",
  cf: "HOSE_VERIFIED_CashFlow_Quarterly_2018_2025.csv",
};

const METADATA_CANDIDATES = [
  "stock_metadata_2018_2025.csv",
  "HOSE_VERIFIED_2020_2025.csv",
];

const SUMMARY_PATH = path.join(process.cwd(), "artifacts", "fundamentals_coverage_summary.json");
const MISSING_PATH = path.join(process.cwd(), "artifacts", "fundamentals_missing_by_symbol.csv");

function uniquePaths(paths) {
  const seen = new Set();
  const out = [];
  for (const p of paths) {
    const resolved = path.resolve(p);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    out.push(resolved);
  }
  return out;
}

function getDataDirCandidates() {
  const configured = process.env.DATA_DIR?.trim();
  const candidates = [];
  if (configured) candidates.push(configured);
  candidates.push(path.join(process.cwd(), "..", "data"));
  candidates.push(path.join(process.cwd(), "public", "data"));
  return uniquePaths(candidates);
}

async function fileExists(filePath) {
  try {
    await fsPromises.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveFirstExistingFile(fileName, dirCandidates) {
  for (const dir of dirCandidates) {
    const filePath = path.join(dir, fileName);
    if (await fileExists(filePath)) {
      return filePath;
    }
  }
  return null;
}

async function resolveFirstExistingFileFromCandidates(fileNames, dirCandidates) {
  for (const fileName of fileNames) {
    const resolved = await resolveFirstExistingFile(fileName, dirCandidates);
    if (resolved) return { fileName, filePath: resolved };
  }
  return { fileName: null, filePath: null };
}

function normalizeSymbol(raw) {
  if (raw === undefined || raw === null) return null;
  const symbol = String(raw).trim().toUpperCase();
  // Symbols should start with a letter; this also prevents numeric fragments from
  // malformed CSV rows from being treated as valid symbols.
  if (!/^[A-Z][A-Z0-9]{0,9}$/.test(symbol)) return null;
  return symbol;
}

async function readCsvRows(filePath) {
  const content = await fsPromises.readFile(filePath, "utf8");
  const parsed = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim().toLowerCase(),
  });
  return parsed.data;
}

async function loadActiveSymbols(metadataPath) {
  if (!metadataPath) return new Set();
  const rows = await readCsvRows(metadataPath);
  const active = new Set();
  for (const row of rows) {
    const symbol = normalizeSymbol(row?.symbol) ?? normalizeSymbol(row?.ticker);
    const status = String(row?.status ?? "").trim().toUpperCase();
    if (!symbol) continue;
    if (status === "ACTIVE") active.add(symbol);
  }
  return active;
}

async function loadStatementSymbols(statementPath) {
  if (!statementPath) return new Set();
  const rows = await readCsvRows(statementPath);
  const symbols = new Set();
  for (const row of rows) {
    // Prefer the leading `ticker` column; fall back to `symbol` for alternate schemas.
    const symbol = normalizeSymbol(row?.ticker) ?? normalizeSymbol(row?.symbol);
    if (symbol) symbols.add(symbol);
  }
  return symbols;
}

function percentage(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function csvEscape(value) {
  const raw = value === null || value === undefined ? "" : String(value);
  if (raw.includes("\"")) {
    const escaped = raw.replace(/"/g, "\"\"");
    return `"${escaped}"`;
  }
  if (raw.includes(",") || raw.includes("\n") || raw.includes("\r")) {
    return `"${raw}"`;
  }
  return raw;
}

async function writeMissingCsv(rows) {
  const headers = [
    "symbol",
    "has_bs",
    "has_is",
    "has_cf",
    "missing_bs",
    "missing_is",
    "missing_cf",
    "has_any",
    "has_all_three",
  ];

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.symbol,
        String(row.has_bs),
        String(row.has_is),
        String(row.has_cf),
        String(row.missing_bs),
        String(row.missing_is),
        String(row.missing_cf),
        String(row.has_any),
        String(row.has_all_three),
      ].map(csvEscape).join(",")
    );
  }
  await fsPromises.writeFile(MISSING_PATH, `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const dataDirCandidates = getDataDirCandidates();

  const metadataFile = await resolveFirstExistingFileFromCandidates(METADATA_CANDIDATES, dataDirCandidates);
  const fundamentalsFiles = {
    bs: await resolveFirstExistingFile(FUNDAMENTALS_FILES.bs, dataDirCandidates),
    is: await resolveFirstExistingFile(FUNDAMENTALS_FILES.is, dataDirCandidates),
    cf: await resolveFirstExistingFile(FUNDAMENTALS_FILES.cf, dataDirCandidates),
  };

  const activeSymbolsSet = await loadActiveSymbols(metadataFile.filePath);
  const bsSymbols = await loadStatementSymbols(fundamentalsFiles.bs);
  const isSymbols = await loadStatementSymbols(fundamentalsFiles.is);
  const cfSymbols = await loadStatementSymbols(fundamentalsFiles.cf);

  const activeSymbols = Array.from(activeSymbolsSet).sort();
  const rows = [];
  const counts = {
    total_active_symbols: activeSymbols.length,
    has_bs: 0,
    has_is: 0,
    has_cf: 0,
    missing_bs: 0,
    missing_is: 0,
    missing_cf: 0,
    has_any: 0,
    has_all_three: 0,
    missing_any: 0,
  };

  for (const symbol of activeSymbols) {
    const has_bs = bsSymbols.has(symbol);
    const has_is = isSymbols.has(symbol);
    const has_cf = cfSymbols.has(symbol);
    const missing_bs = !has_bs;
    const missing_is = !has_is;
    const missing_cf = !has_cf;
    const has_any = has_bs || has_is || has_cf;
    const has_all_three = has_bs && has_is && has_cf;

    if (has_bs) counts.has_bs += 1;
    if (has_is) counts.has_is += 1;
    if (has_cf) counts.has_cf += 1;
    if (missing_bs) counts.missing_bs += 1;
    if (missing_is) counts.missing_is += 1;
    if (missing_cf) counts.missing_cf += 1;
    if (has_any) counts.has_any += 1;
    if (has_all_three) counts.has_all_three += 1;

    rows.push({
      symbol,
      has_bs,
      has_is,
      has_cf,
      missing_bs,
      missing_is,
      missing_cf,
      has_any,
      has_all_three,
    });
  }

  counts.missing_any = counts.total_active_symbols - counts.has_all_three;

  const percentages = {
    has_bs: percentage(counts.has_bs, counts.total_active_symbols),
    has_is: percentage(counts.has_is, counts.total_active_symbols),
    has_cf: percentage(counts.has_cf, counts.total_active_symbols),
    missing_bs: percentage(counts.missing_bs, counts.total_active_symbols),
    missing_is: percentage(counts.missing_is, counts.total_active_symbols),
    missing_cf: percentage(counts.missing_cf, counts.total_active_symbols),
    has_any: percentage(counts.has_any, counts.total_active_symbols),
    has_all_three: percentage(counts.has_all_three, counts.total_active_symbols),
    missing_any: percentage(counts.missing_any, counts.total_active_symbols),
  };

  const summary = {
    generated_at: new Date().toISOString(),
    data_dir_candidates: dataDirCandidates,
    resolved_files: {
      stock_metadata: metadataFile.filePath,
      bs: fundamentalsFiles.bs,
      is: fundamentalsFiles.is,
      cf: fundamentalsFiles.cf,
    },
    counts,
    percentages,
  };

  await fsPromises.mkdir(path.join(process.cwd(), "artifacts"), { recursive: true });
  await fsPromises.writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeMissingCsv(rows);

  console.log(`[coverage] summary: ${SUMMARY_PATH}`);
  console.log(`[coverage] missing-by-symbol: ${MISSING_PATH}`);
  console.log(
    `[coverage] active=${counts.total_active_symbols}, has_all_three=${counts.has_all_three}, missing_any=${counts.missing_any}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
