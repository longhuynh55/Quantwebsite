#!/usr/bin/env node
/**
 * Prepare 2018-2025 dataset for runtime use.
 *
 * Input (raw):
 *   - HOSE_VERIFIED_OHLCV_INDUSTRY_2018_2025.csv (daily, large, contains repeated industry info per row)
 *   - Optional: HOSE_VERIFIED_2020_2025.csv (to inherit exchange/status/listing_phase/source)
 *   - Optional: quarterly fundamentals CSVs (copy into output dir for /api/fundamentals)
 *
 * Output (prepared):
 *   - ohlcv_2018_2025.csv
 *   - industry_by_symbol_2018_2025.csv
 *   - stock_metadata_2018_2025.csv
 */

import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import Papa from "papaparse";

function usage() {
  return [
    "Usage: node scripts/prepare_data_2018_2025.mjs [options]",
    "",
    "Options:",
    "  --input-ohlcv <path>        Path to HOSE_VERIFIED_OHLCV_INDUSTRY_2018_2025.csv",
    "  --base-metadata <path>      Optional path to HOSE_VERIFIED_2020_2025.csv (inherit status/exchange)",
    "  --fundamentals-dir <path>   Optional dir that contains quarterly fundamentals CSVs (copy to out dir)",
    "  --out-dir <path>            Output directory (default: ./public/data)",
    "  --no-copy-fundamentals      Do not copy fundamentals CSVs into out dir",
  ].join("\n");
}

function parseArgs(argv) {
  const out = {
    inputOhlcv: null,
    baseMetadata: null,
    fundamentalsDir: null,
    outDir: path.join(process.cwd(), "public", "data"),
    copyFundamentals: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input-ohlcv") {
      out.inputOhlcv = argv[++i] ?? null;
    } else if (arg === "--base-metadata") {
      out.baseMetadata = argv[++i] ?? null;
    } else if (arg === "--fundamentals-dir") {
      out.fundamentalsDir = argv[++i] ?? null;
    } else if (arg === "--out-dir") {
      out.outDir = argv[++i] ?? out.outDir;
    } else if (arg === "--no-copy-fundamentals") {
      out.copyFundamentals = false;
    } else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${arg}`);
      console.error(usage());
      process.exit(2);
    }
  }

  // Defaults for this repo layout: ../data/*.csv
  if (!out.inputOhlcv) {
    out.inputOhlcv = path.join(
      process.cwd(),
      "..",
      "data",
      "HOSE_VERIFIED_OHLCV_INDUSTRY_2018_2025.csv"
    );
  }

  if (!out.baseMetadata) {
    const candidates = [
      path.join(process.cwd(), "public", "data", "HOSE_VERIFIED_2020_2025.csv"),
      path.join(process.cwd(), "..", "data", "HOSE_VERIFIED_2020_2025.csv"),
    ];
    out.baseMetadata = candidates.find((p) => fs.existsSync(p)) ?? null;
  }

  if (!out.fundamentalsDir) {
    const candidate = path.join(process.cwd(), "..", "data");
    out.fundamentalsDir = fs.existsSync(candidate) ? candidate : null;
  }

  return out;
}

function normalizeSymbol(raw) {
  if (!raw) return null;
  const sym = String(raw).trim().toUpperCase();
  if (!/^[A-Z]{1,10}$/.test(sym)) return null;
  return sym;
}

function isValidDateStr(raw) {
  return typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw);
}

function parseFiniteNumber(raw) {
  if (raw === undefined || raw === null) return null;
  const n = Number(String(raw).trim());
  return Number.isFinite(n) ? n : null;
}

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

async function readBaseMetadataMap(filePath) {
  if (!filePath) return new Map();
  try {
    const content = await fsPromises.readFile(filePath, "utf8");
    const parsed = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: (h) => h.replace(/^\uFEFF/, "").trim().toLowerCase(),
    });

    const map = new Map();
    for (const row of parsed.data) {
      const symbol = normalizeSymbol(row?.symbol);
      if (!symbol) continue;
      map.set(symbol, {
        exchange: row.exchange ? String(row.exchange).trim() : "",
        status: row.status ? String(row.status).trim() : "",
        listingPhase: row.listing_phase ? String(row.listing_phase).trim() : "",
        source: row.source ? String(row.source).trim() : "",
      });
    }
    return map;
  } catch (err) {
    console.warn(
      `[prepare] base metadata read failed (${filePath}): ${err instanceof Error ? err.message : String(err)}`
    );
    return new Map();
  }
}

async function copyIfExists(srcPath, destPath) {
  try {
    await fsPromises.copyFile(srcPath, destPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  await fsPromises.mkdir(args.outDir, { recursive: true });

  const baseMeta = await readBaseMetadataMap(args.baseMetadata);

  const outOhlcvPath = path.join(args.outDir, "ohlcv_2018_2025.csv");
  const outIndustryPath = path.join(args.outDir, "industry_by_symbol_2018_2025.csv");
  const outMetaPath = path.join(args.outDir, "stock_metadata_2018_2025.csv");

  const ohlcvWriter = fs.createWriteStream(outOhlcvPath, { encoding: "utf8" });
  ohlcvWriter.write("symbol,date,open,high,low,close,volume\n");

  const industryBySymbol = new Map();
  const statsBySymbol = new Map();

  let totalRows = 0;
  let acceptedRows = 0;
  let rejectedRows = 0;
  const rejectionReasons = new Map();
  let industryMismatch = 0;

  function recordRejection(reason) {
    rejectedRows += 1;
    rejectionReasons.set(reason, (rejectionReasons.get(reason) ?? 0) + 1);
  }

  const papaStream = Papa.parse(Papa.NODE_STREAM_INPUT, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (h) => h.replace(/^\uFEFF/, "").trim().toLowerCase(),
  });

  await new Promise((resolve, rejectPromise) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };

    const inputStream = fs.createReadStream(args.inputOhlcv, { encoding: "utf8" });

    inputStream.on("error", (err) => rejectPromise(err));
    papaStream.on("error", (err) => rejectPromise(err));
    papaStream.on("end", finish);
    papaStream.on("finish", finish);

    papaStream.on("data", (row) => {
      totalRows += 1;
      const symbol = normalizeSymbol(row?.symbol);
      if (!symbol) {
        recordRejection("invalid_symbol");
        return;
      }

      const date = row?.date ? String(row.date).trim() : "";
      if (!isValidDateStr(date)) {
        recordRejection("invalid_date");
        return;
      }

      const open = parseFiniteNumber(row?.open);
      const high = parseFiniteNumber(row?.high);
      const low = parseFiniteNumber(row?.low);
      const close = parseFiniteNumber(row?.close);
      const volume = parseFiniteNumber(row?.volume);
      if (open === null || high === null || low === null || close === null || volume === null) {
        recordRejection("invalid_ohlcv");
        return;
      }

      // Write OHLCV row (no industry columns).
      ohlcvWriter.write(`${symbol},${date},${open},${high},${low},${close},${volume}\n`);
      acceptedRows += 1;

      // Stats update
      let stats = statsBySymbol.get(symbol);
      if (!stats) {
        stats = {
          firstDate: date,
          lastDate: date,
          count: 0,
          volumeSum: 0,
        };
        statsBySymbol.set(symbol, stats);
      }
      if (date < stats.firstDate) stats.firstDate = date;
      if (date > stats.lastDate) stats.lastDate = date;
      stats.count += 1;
      stats.volumeSum += volume;

      // Industry snapshot (once per symbol; verify consistency)
      const industry = {
        organName: row?.organ_name ? String(row.organ_name).trim() : "",
        icbCode1: row?.icb_code1 ? String(row.icb_code1).trim() : "",
        icbCode2: row?.icb_code2 ? String(row.icb_code2).trim() : "",
        icbCode3: row?.icb_code3 ? String(row.icb_code3).trim() : "",
        icbCode4: row?.icb_code4 ? String(row.icb_code4).trim() : "",
        icbName2: row?.icb_name2 ? String(row.icb_name2).trim() : "",
        icbName3: row?.icb_name3 ? String(row.icb_name3).trim() : "",
        icbName4: row?.icb_name4 ? String(row.icb_name4).trim() : "",
      };

      const existing = industryBySymbol.get(symbol);
      if (!existing) {
        industryBySymbol.set(symbol, industry);
      } else {
        const same =
          existing.organName === industry.organName &&
          existing.icbCode1 === industry.icbCode1 &&
          existing.icbCode2 === industry.icbCode2 &&
          existing.icbCode3 === industry.icbCode3 &&
          existing.icbCode4 === industry.icbCode4 &&
          existing.icbName2 === industry.icbName2 &&
          existing.icbName3 === industry.icbName3 &&
          existing.icbName4 === industry.icbName4;
        if (!same) industryMismatch += 1;
      }
    });

    inputStream.pipe(papaStream);
  });

  await new Promise((resolve) => ohlcvWriter.end(resolve));

  // Write industry_by_symbol file
  {
    const writer = fs.createWriteStream(outIndustryPath, { encoding: "utf8" });
    writer.write("symbol,organ_name,icb_code1,icb_code2,icb_code3,icb_code4,icb_name2,icb_name3,icb_name4\n");
    const symbols = Array.from(industryBySymbol.keys()).sort();
    for (const sym of symbols) {
      const i = industryBySymbol.get(sym);
      writer.write(
        [
          sym,
          csvEscape(i.organName),
          csvEscape(i.icbCode1),
          csvEscape(i.icbCode2),
          csvEscape(i.icbCode3),
          csvEscape(i.icbCode4),
          csvEscape(i.icbName2),
          csvEscape(i.icbName3),
          csvEscape(i.icbName4),
        ].join(",") + "\n"
      );
    }
    await new Promise((resolve) => writer.end(resolve));
  }

  // Write stock_metadata file (2018-2025 computed)
  {
    const writer = fs.createWriteStream(outMetaPath, { encoding: "utf8" });
    writer.write(
      [
        "symbol",
        "exchange",
        "status",
        "data_rows_2018_2025",
        "source",
        "first_date",
        "last_date",
        "total_trading_days",
        "avg_volume",
        "listing_phase",
        "organ_name",
        "icb_code1",
        "icb_code2",
        "icb_code3",
        "icb_code4",
        "icb_name2",
        "icb_name3",
        "icb_name4",
      ].join(",") + "\n"
    );

    const symbols = Array.from(statsBySymbol.keys()).sort();
    for (const sym of symbols) {
      const stats = statsBySymbol.get(sym);
      const industry = industryBySymbol.get(sym) ?? {
        organName: "",
        icbCode1: "",
        icbCode2: "",
        icbCode3: "",
        icbCode4: "",
        icbName2: "",
        icbName3: "",
        icbName4: "",
      };

      const inherited = baseMeta.get(sym) ?? null;
      const exchange = inherited?.exchange || "HOSE";
      const status = inherited?.status || "ACTIVE";
      const listingPhase = inherited?.listingPhase || inherited?.exchange || "HOSE";
      const source = inherited?.source || "derived_ohlcv_2018_2025";

      const avgVolume = stats.count > 0 ? stats.volumeSum / stats.count : 0;

      writer.write(
        [
          sym,
          csvEscape(exchange),
          csvEscape(status),
          String(stats.count),
          csvEscape(source),
          csvEscape(stats.firstDate),
          csvEscape(stats.lastDate),
          String(stats.count),
          String(avgVolume),
          csvEscape(listingPhase),
          csvEscape(industry.organName),
          csvEscape(industry.icbCode1),
          csvEscape(industry.icbCode2),
          csvEscape(industry.icbCode3),
          csvEscape(industry.icbCode4),
          csvEscape(industry.icbName2),
          csvEscape(industry.icbName3),
          csvEscape(industry.icbName4),
        ].join(",") + "\n"
      );
    }

    await new Promise((resolve) => writer.end(resolve));
  }

  // Optionally copy fundamentals CSVs into out dir for runtime API
  if (args.copyFundamentals && args.fundamentalsDir) {
    const files = [
      "HOSE_VERIFIED_BalanceSheet_Quarterly_2018_2025.csv",
      "HOSE_VERIFIED_IncomeStatement_Quarterly_2018_2025.csv",
      "HOSE_VERIFIED_CashFlow_Quarterly_2018_2025.csv",
    ];

    let copied = 0;
    for (const name of files) {
      const src = path.join(args.fundamentalsDir, name);
      const dest = path.join(args.outDir, name);
      if (await copyIfExists(src, dest)) copied += 1;
    }

    if (copied === 0) {
      console.warn("[prepare] fundamentals CSVs not copied (files not found in fundamentals-dir).");
    }
  }

  const reasons = Array.from(rejectionReasons.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  console.log(
    `[prepare] done. input=${args.inputOhlcv}\n` +
      `  outDir=${args.outDir}\n` +
      `  rows: accepted=${acceptedRows}/${totalRows}, rejected=${rejectedRows}\n` +
      `  industryMismatchRows=${industryMismatch}\n` +
      (reasons ? `  topRejections=[${reasons}]\n` : "")
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
