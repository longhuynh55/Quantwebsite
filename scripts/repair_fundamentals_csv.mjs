#!/usr/bin/env node

import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import readline from "readline";
import Papa from "papaparse";
import { fileURLToPath } from "url";

function csvEscape(value) {
  const s = value === null || value === undefined ? "" : String(value);
  if (s.includes('"')) {
    const escaped = s.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  if (s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s}"`;
  }
  return s;
}

function isRowStart(line) {
  const s = (line ?? "").trimStart();
  return /^[A-Z][A-Z0-9]{0,9},\d{4},[1-4],/.test(s);
}

function parseCsvLine(line) {
  const parsed = Papa.parse(line, { header: false, skipEmptyLines: false });
  const row = parsed.data?.[0];
  return Array.isArray(row) ? row : [];
}

function isNumericLike(value) {
  const s = String(value ?? "").trim();
  if (!s) return false;
  return /^-?\d+(?:\.\d+)?(?:[eE]-?\d+)?$/.test(s);
}

export async function repairFundamentalsCsvFile({ srcPath, destPath, reportPath }) {
  await fsPromises.mkdir(path.dirname(destPath), { recursive: true });

  const input = fs.createReadStream(srcPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  const out = fs.createWriteStream(destPath, { encoding: "utf8" });

  const report = {
    srcPath: path.resolve(srcPath),
    destPath: path.resolve(destPath),
    expectedColumns: 0,
    physicalLinesRead: 0,
    logicalRowsWritten: 0,
    continuationLinesMerged: 0,
    paddedShortRows: 0,
    trimmedTrailingEmptyExtras: 0,
    shiftedLastValueFromExtra: 0,
    truncatedNonEmptyExtras: 0,
    truncatedSamples: [],
  };

  let headerLine = null;
  let expectedCols = 0;
  let currentRow = "";

  function flushRow() {
    const raw = currentRow.trimEnd();
    currentRow = "";
    if (!raw) return;

    let fields = parseCsvLine(raw);

    // Normalize field count to match header.
    if (expectedCols > 0 && fields.length < expectedCols) {
      report.paddedShortRows += 1;
      fields = fields.concat(Array(expectedCols - fields.length).fill(""));
    }

    if (expectedCols > 0 && fields.length > expectedCols) {
      // Remove trailing empty extras introduced by trailing commas.
      while (fields.length > expectedCols && String(fields[fields.length - 1] ?? "").trim() === "") {
        fields.pop();
        report.trimmedTrailingEmptyExtras += 1;
      }
    }

    if (expectedCols > 0 && fields.length > expectedCols) {
      const extras = fields.slice(expectedCols);
      const extraNonEmpty = extras.filter((v) => String(v ?? "").trim() !== "");

      // Common corruption pattern: one meaningful value + trailing empty at the end.
      // If the last expected column is empty, move that extra into it.
      const lastExpected = String(fields[expectedCols - 1] ?? "").trim();
      if (
        lastExpected === "" &&
        extraNonEmpty.length === 1 &&
        isNumericLike(extraNonEmpty[0]) &&
        extras.slice(1).every((v) => String(v ?? "").trim() === "")
      ) {
        fields[expectedCols - 1] = extraNonEmpty[0];
        fields = fields.slice(0, expectedCols);
        report.shiftedLastValueFromExtra += 1;
      } else {
        // Fallback: truncate and record evidence (better than misaligned maps at runtime).
        report.truncatedNonEmptyExtras += 1;
        if (report.truncatedSamples.length < 5) {
          report.truncatedSamples.push({
            ticker: fields[0],
            yearReport: fields[1],
            lengthReport: fields[2],
            expectedCols,
            actualCols: fields.length,
            extras: extras.slice(0, 5),
          });
        }
        fields = fields.slice(0, expectedCols);
      }
    }

    if (expectedCols > 0 && fields.length > expectedCols) {
      fields = fields.slice(0, expectedCols);
    }

    out.write(fields.map(csvEscape).join(",") + "\n");
    report.logicalRowsWritten += 1;
  }

  for await (const line of rl) {
    report.physicalLinesRead += 1;

    if (headerLine === null) {
      headerLine = line.replace(/^\uFEFF/, "");
      const headerFields = parseCsvLine(headerLine);
      expectedCols = headerFields.length;
      report.expectedColumns = expectedCols;
      out.write(headerLine.trimEnd() + "\n");
      continue;
    }

    if (isRowStart(line)) {
      flushRow();
      currentRow = line;
    } else {
      if (currentRow) report.continuationLinesMerged += 1;
      currentRow += line;
    }
  }

  flushRow();
  await new Promise((resolve) => out.end(resolve));

  if (reportPath) {
    await fsPromises.mkdir(path.dirname(reportPath), { recursive: true });
    await fsPromises.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  }

  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const src = args[0];
  const dest = args[1];
  if (!src || !dest) {
    console.error("Usage: node scripts/repair_fundamentals_csv.mjs <src.csv> <dest.csv> [report.json]");
    process.exit(2);
  }
  const report = await repairFundamentalsCsvFile({
    srcPath: src,
    destPath: dest,
    reportPath: args[2] ?? null,
  });
  console.log(`[repair] wrote ${report.logicalRowsWritten} rows: ${dest}`);
  if (args[2]) console.log(`[repair] report: ${args[2]}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
