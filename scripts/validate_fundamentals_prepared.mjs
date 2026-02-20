#!/usr/bin/env node

import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import Papa from "papaparse";

const STATEMENTS = [
  { key: "bs", file: "HOSE_VERIFIED_BalanceSheet_Quarterly_2018_2025.csv" },
  { key: "is", file: "HOSE_VERIFIED_IncomeStatement_Quarterly_2018_2025.csv" },
  { key: "cf", file: "HOSE_VERIFIED_CashFlow_Quarterly_2018_2025.csv" },
];

const SYMBOL_RE = /^[A-Z][A-Z0-9]{0,9}$/;

function getDataDir() {
  const configured = process.env.DATA_DIR?.trim();
  if (configured) return path.resolve(configured);
  return path.join(process.cwd(), "public", "data");
}

async function fileExists(filePath) {
  try {
    await fsPromises.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function normalizeSymbol(raw) {
  if (raw === undefined || raw === null) return null;
  const symbol = String(raw).trim().toUpperCase();
  if (!SYMBOL_RE.test(symbol)) return null;
  return symbol;
}

function parseIntStrict(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!/^-?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function readCsv(filePath) {
  const content = await fsPromises.readFile(filePath, "utf8");
  const parsed = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim().toLowerCase(),
  });
  return parsed;
}

function fail(message) {
  console.error(`[validate] ERROR: ${message}`);
  process.exitCode = 2;
}

function warn(message) {
  console.warn(`[validate] WARN: ${message}`);
}

async function main() {
  const dataDir = getDataDir();
  const requireFullCoverage = (process.env.FUNDAMENTALS_REQUIRE_FULL_COVERAGE ?? "").trim().toLowerCase() === "true";

  console.log(`[validate] dataDir=${dataDir}`);

  const metadataPath = path.join(dataDir, "stock_metadata_2018_2025.csv");
  let activeSymbols = null;
  if (await fileExists(metadataPath)) {
    const metaParsed = await readCsv(metadataPath);
    if (metaParsed.errors.length > 0) {
      warn(`stock_metadata parse errors: ${metaParsed.errors.length}`);
    }
    const set = new Set();
    for (const row of metaParsed.data) {
      const symbol = normalizeSymbol(row?.symbol ?? row?.ticker);
      const status = String(row?.status ?? "").trim().toUpperCase();
      if (symbol && status === "ACTIVE") set.add(symbol);
    }
    activeSymbols = set;
    console.log(`[validate] activeSymbols=${activeSymbols.size}`);
  } else {
    warn("stock_metadata_2018_2025.csv not found; skipping active coverage checks.");
  }

  for (const stmt of STATEMENTS) {
    const filePath = path.join(dataDir, stmt.file);
    if (!(await fileExists(filePath))) {
      fail(`Missing fundamentals file: ${stmt.file}`);
      continue;
    }

    const parsed = await readCsv(filePath);
    if (parsed.errors.length > 0) {
      const top = parsed.errors.slice(0, 3).map((e) => `${e.code}@row${e.row ?? "?"}`).join(", ");
      fail(`${stmt.key} parse errors=${parsed.errors.length} (${top}). Run pnpm run data:prepare:2018_2025 to repair.`);
      continue;
    }

    const fields = parsed.meta.fields ?? [];
    const required = ["ticker", "yearreport", "lengthreport"];
    for (const col of required) {
      if (!fields.includes(col)) fail(`${stmt.key} missing required column: ${col}`);
    }

    const seen = new Set();
    const symbolsWithRows = new Set();
    let invalidKeyRows = 0;
    let invalidTickerRows = 0;
    let duplicateKeys = 0;

    for (const row of parsed.data) {
      const ticker = normalizeSymbol(row?.ticker) ?? normalizeSymbol(row?.symbol);
      if (!ticker) {
        invalidTickerRows += 1;
        continue;
      }
      symbolsWithRows.add(ticker);

      const year = parseIntStrict(row?.yearreport);
      const quarter = parseIntStrict(row?.lengthreport);
      if (!year || year < 1900 || year > 2100 || !quarter || quarter < 1 || quarter > 4) {
        invalidKeyRows += 1;
        continue;
      }

      const key = `${ticker}|${year}|${quarter}`;
      if (seen.has(key)) duplicateKeys += 1;
      else seen.add(key);
    }

    if (invalidTickerRows > 0) fail(`${stmt.key} invalid ticker rows: ${invalidTickerRows}`);
    if (invalidKeyRows > 0) fail(`${stmt.key} invalid (yearReport,lengthReport) rows: ${invalidKeyRows}`);
    if (duplicateKeys > 0) fail(`${stmt.key} duplicate keys (ticker,yearReport,lengthReport): ${duplicateKeys}`);

    console.log(
      `[validate] ${stmt.key}: rows=${parsed.data.length}, symbols=${symbolsWithRows.size}, duplicateKeys=${duplicateKeys}`
    );

    if (activeSymbols && requireFullCoverage) {
      const missing = [];
      for (const sym of activeSymbols) {
        if (!symbolsWithRows.has(sym)) missing.push(sym);
      }
      if (missing.length > 0) fail(`${stmt.key} missing active symbols: ${missing.length} (sample=${missing.slice(0, 10).join(",")})`);
    }
  }

  if (process.exitCode && process.exitCode !== 0) {
    console.error("[validate] FAILED");
    process.exit(process.exitCode);
  }
  console.log("[validate] OK");
}

main().catch((err) => {
  console.error(`[validate] ERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});


