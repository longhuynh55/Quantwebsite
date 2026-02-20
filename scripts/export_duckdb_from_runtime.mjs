#!/usr/bin/env node

import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import readline from "readline";

function parseArgs(argv) {
  const parsed = {
    dataDir: path.join(process.cwd(), "public", "data"),
    outFile: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--data-dir") {
      parsed.dataDir = argv[++i] ?? parsed.dataDir;
      continue;
    }
    if (arg === "--out-file") {
      parsed.outFile = argv[++i] ?? parsed.outFile;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log([
        "Usage: node scripts/export_duckdb_from_runtime.mjs [options]",
        "",
        "Options:",
        "  --data-dir <path>   Runtime data directory (default: ./public/data)",
        "  --out-file <path>   Output duckdb file (default: <data-dir>/quant_data.duckdb)",
      ].join("\n"));
      process.exit(0);
    }
    throw new Error(`Unknown arg: ${arg}`);
  }

  if (!parsed.outFile) {
    parsed.outFile = path.join(parsed.dataDir, "quant_data.duckdb");
  }
  return parsed;
}

function normalizeFsPathForDuckDb(filePath) {
  return path.resolve(filePath).replace(/\\/g, "/");
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function loadDuckDbModule() {
  try {
    const imported = await import("duckdb");
    const candidate = imported.default ?? imported;
    if (!candidate || typeof candidate.Database !== "function") {
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function buildDuckDbDatasetSpecs(dataDir) {
  return [
    {
      table: "stock_metadata",
      file: "stock_metadata_2018_2025.csv",
      required: true,
      csvPath: path.join(dataDir, "stock_metadata_2018_2025.csv"),
    },
    {
      table: "ohlcv",
      file: "ohlcv_2018_2025.csv",
      required: true,
      csvPath: path.join(dataDir, "ohlcv_2018_2025.csv"),
    },
    {
      table: "market_index",
      file: "Market_Indices_Daily_2020_2025.csv",
      required: true,
      csvPath: path.join(dataDir, "Market_Indices_Daily_2020_2025.csv"),
    },
    {
      table: "fundamentals_bs",
      file: "HOSE_VERIFIED_BalanceSheet_Quarterly_2018_2025.csv",
      required: false,
      csvPath: path.join(dataDir, "HOSE_VERIFIED_BalanceSheet_Quarterly_2018_2025.csv"),
    },
    {
      table: "fundamentals_is",
      file: "HOSE_VERIFIED_IncomeStatement_Quarterly_2018_2025.csv",
      required: false,
      csvPath: path.join(dataDir, "HOSE_VERIFIED_IncomeStatement_Quarterly_2018_2025.csv"),
    },
    {
      table: "fundamentals_cf",
      file: "HOSE_VERIFIED_CashFlow_Quarterly_2018_2025.csv",
      required: false,
      csvPath: path.join(dataDir, "HOSE_VERIFIED_CashFlow_Quarterly_2018_2025.csv"),
    },
  ];
}

async function countRowsFast(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const lineReader = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });
  let lineCount = 0;
  for await (const line of lineReader) {
    if (line.trim().length > 0) {
      lineCount += 1;
    }
  }
  if (lineCount <= 1) {
    return 0;
  }
  return lineCount - 1;
}

async function runSql(db, sql) {
  await new Promise((resolve, reject) => {
    db.all(sql, [], (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function querySingleValue(db, sql, key) {
  return await new Promise((resolve, reject) => {
    db.all(sql, [], (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      const first = Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
      resolve(Number(first?.[key] ?? 0));
    });
  });
}

async function closeDb(db) {
  await new Promise((resolve, reject) => {
    db.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataDir = path.resolve(args.dataDir);
  const outFile = path.resolve(args.outFile);
  const duckdbModule = await loadDuckDbModule();
  const datasets = buildDuckDbDatasetSpecs(dataDir);

  const summary = {
    generatedAt: new Date().toISOString(),
    outFile,
    mode: duckdbModule ? "node-binding" : "docker-cli",
    tables: {},
    skipped: [],
  };

  await fsPromises.mkdir(path.dirname(outFile), { recursive: true });
  if (fs.existsSync(outFile)) {
    await fsPromises.unlink(outFile);
  }

  if (duckdbModule) {
    const db = await new Promise((resolve, reject) => {
      const instance = new duckdbModule.Database(outFile, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(instance);
      });
    });

    try {
      for (const dataset of datasets) {
        const filePath = dataset.csvPath;
        if (!fs.existsSync(filePath)) {
          if (dataset.required) {
            throw new Error(`Missing required runtime CSV: ${filePath}`);
          }
          summary.skipped.push({
            table: dataset.table,
            file: dataset.file,
            reason: "missing_file",
          });
          continue;
        }

        const normalizedPath = normalizeFsPathForDuckDb(filePath);
        const createSql =
          `CREATE OR REPLACE TABLE ${dataset.table} AS ` +
          `SELECT * FROM read_csv_auto(${sqlString(normalizedPath)}, HEADER=TRUE, ALL_VARCHAR=TRUE, SAMPLE_SIZE=-1);`;
        await runSql(db, createSql);
        const count = await querySingleValue(db, `SELECT COUNT(*) AS cnt FROM ${dataset.table}`, "cnt");
        summary.tables[dataset.table] = {
          file: dataset.file,
          rows: count,
        };
      }
      await runSql(db, "ANALYZE;");
    } finally {
      await closeDb(db);
    }
  } else {
    if (path.dirname(outFile) !== dataDir) {
      throw new Error(
        "Docker fallback requires output file to be inside data-dir. " +
        `Expected dir=${dataDir}, got=${path.dirname(outFile)}`
      );
    }

    const sqlLines = [];
    for (const dataset of datasets) {
      const exists = fs.existsSync(dataset.csvPath);
      if (!exists && dataset.required) {
        throw new Error(`Missing required runtime CSV: ${dataset.csvPath}`);
      }
      if (!exists) {
        summary.skipped.push({
          table: dataset.table,
          file: dataset.file,
          reason: "missing_file",
        });
        continue;
      }

      summary.tables[dataset.table] = {
        file: dataset.file,
        rows: await countRowsFast(dataset.csvPath),
      };
      sqlLines.push(
        `CREATE OR REPLACE TABLE ${dataset.table} AS ` +
        `SELECT * FROM read_csv_auto('/data/${dataset.file}', HEADER=TRUE, ALL_VARCHAR=TRUE, SAMPLE_SIZE=-1);`
      );
    }
    sqlLines.push("ANALYZE;");

    const sqlFileName = "duckdb_export_runtime.sql";
    const sqlFilePath = path.join(dataDir, sqlFileName);
    await fsPromises.writeFile(sqlFilePath, `${sqlLines.join("\n")}\n`, "utf8");

    const normalizedDataDir = dataDir.replace(/\\/g, "/");
    try {
      await runCommand("docker", [
        "run",
        "--rm",
        "-v",
        `${normalizedDataDir}:/data`,
        "duckdb/duckdb:latest",
        "duckdb",
        `/data/${path.basename(outFile)}`,
        "-f",
        `/data/${sqlFileName}`,
      ]);
    } catch (error) {
      const fallbackMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        "DuckDB export fallback via Docker failed. Ensure Docker Desktop is running, " +
        "or install the optional Node binding with `pnpm install duckdb`.\n" +
        `Details: ${fallbackMessage}\n` +
        `SQL plan: ${sqlFilePath}`
      );
    }
  }

  const summaryPath = path.join(dataDir, "duckdb_export_summary.json");
  await fsPromises.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(`[duckdb-export] created ${outFile} via ${summary.mode}`);
  console.log(`[duckdb-export] summary ${summaryPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

