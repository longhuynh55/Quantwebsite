#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";

function toDateStr(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function generateTradingDates(count, startIsoDate) {
  const out = [];
  let cursor = new Date(`${startIsoDate}T00:00:00Z`);
  while (out.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      out.push(toDateStr(cursor));
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return out;
}

function formatNum(value) {
  return Number(value).toFixed(2);
}

function buildSeries(symbol, dates, basePrice, seed) {
  const rows = [];
  let prevClose = basePrice;
  let volumeSum = 0;

  for (let i = 0; i < dates.length; i++) {
    const drift = 0.00015 + (seed % 7) * 0.00002;
    const open = prevClose * (1 + 0.001 * (((i + seed) % 5) - 2));
    const close = open * (1 + drift + 0.002 * Math.sin((i + seed) / 9));
    const high = Math.max(open, close) * 1.004;
    const low = Math.min(open, close) * 0.996;
    const volume = Math.round(600000 + (((i + seed) % 37) * 45000));

    rows.push({
      symbol,
      date: dates[i],
      open: formatNum(open),
      high: formatNum(high),
      low: formatNum(low),
      close: formatNum(close),
      volume: String(volume),
    });

    volumeSum += volume;
    prevClose = close;
  }

  return {
    rows,
    avgVolume: dates.length > 0 ? volumeSum / dates.length : 0,
    firstDate: dates[0] ?? "",
    lastDate: dates[dates.length - 1] ?? "",
  };
}

async function writeCsv(filePath, header, rows) {
  const lines = [header, ...rows.map((r) => r.join(","))];
  await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const outDir = path.join(process.cwd(), "public", "data");
  await fs.mkdir(outDir, { recursive: true });

  const fullDates = generateTradingDates(620, "2023-01-02");
  const partialDates = fullDates.slice(-12);
  const shortInactiveDates = fullDates.slice(0, 10);

  const symbolPlan = [
    { symbol: "VNM", status: "ACTIVE", dates: fullDates, basePrice: 72000, seed: 11, phase: "FULL_PERIOD" },
    { symbol: "FPT", status: "ACTIVE", dates: fullDates, basePrice: 95000, seed: 19, phase: "FULL_PERIOD" },
    { symbol: "HPG", status: "ACTIVE", dates: fullDates, basePrice: 27000, seed: 29, phase: "FULL_PERIOD" },
    { symbol: "AAA", status: "ACTIVE", dates: fullDates, basePrice: 14000, seed: 37, phase: "FULL_PERIOD" },
    { symbol: "VCK", status: "ACTIVE", dates: partialDates, basePrice: 20000, seed: 43, phase: "PARTIAL" },
    { symbol: "BBC", status: "INACTIVE", dates: fullDates, basePrice: 33000, seed: 47, phase: "FULL_PERIOD" },
    { symbol: "FLC", status: "INACTIVE", dates: shortInactiveDates, basePrice: 6000, seed: 53, phase: "SHORT" },
  ];

  const allOhlcvRows = [];
  const metadataRows = [];
  for (const item of symbolPlan) {
    const series = buildSeries(item.symbol, item.dates, item.basePrice, item.seed);
    for (const row of series.rows) {
      allOhlcvRows.push(row);
    }

    metadataRows.push([
      item.symbol,
      "HOSE",
      item.status,
      String(item.dates.length),
      "ci_synthetic",
      series.firstDate,
      series.lastDate,
      String(item.dates.length),
      String(series.avgVolume),
      item.phase,
      `${item.symbol} CORP`,
      "1000",
      "1200",
      "1230",
      "1234",
      "INDUSTRIAL",
      "SUBSECTOR",
      "CI_LEVEL4",
    ]);
  }

  allOhlcvRows.sort((a, b) => (a.symbol === b.symbol ? a.date.localeCompare(b.date) : a.symbol.localeCompare(b.symbol)));

  await writeCsv(
    path.join(outDir, "stock_metadata_2018_2025.csv"),
    "symbol,exchange,status,data_rows_2018_2025,source,first_date,last_date,total_trading_days,avg_volume,listing_phase,organ_name,icb_code1,icb_code2,icb_code3,icb_code4,icb_name2,icb_name3,icb_name4",
    metadataRows
  );

  await writeCsv(
    path.join(outDir, "ohlcv_2018_2025.csv"),
    "symbol,date,open,high,low,close,volume",
    allOhlcvRows.map((r) => [r.symbol, r.date, r.open, r.high, r.low, r.close, r.volume])
  );

  const indexRows = [];
  let prev = 1100;
  for (let i = 0; i < fullDates.length; i++) {
    const open = prev * (1 + 0.0008 * ((i % 3) - 1));
    const close = open * (1 + 0.0003 + 0.0015 * Math.sin(i / 11));
    const high = Math.max(open, close) * 1.003;
    const low = Math.min(open, close) * 0.997;
    const volume = Math.round(200000000 + ((i % 25) * 6000000));
    indexRows.push([
      fullDates[i],
      formatNum(open),
      formatNum(high),
      formatNum(low),
      formatNum(close),
      String(volume),
      "VNINDEX",
    ]);
    prev = close;
  }

  await writeCsv(
    path.join(outDir, "Market_Indices_Daily_2020_2025.csv"),
    "date,open,high,low,close,volume,symbol",
    indexRows
  );

  const periods = [
    [2024, 1],
    [2024, 2],
    [2024, 3],
    [2024, 4],
    [2025, 1],
    [2025, 2],
    [2025, 3],
    [2025, 4],
  ];

  const bsRows = [];
  const isRows = [];
  const cfRows = [];
  for (const [year, quarter] of periods) {
    const qIndex = (year - 2024) * 4 + quarter;

    bsRows.push([
      "AAA",
      String(year),
      String(quarter),
      String(1200000 + qIndex * 25000),
      String(520000 + qIndex * 12000),
      String(680000 + qIndex * 13000),
      String(85000 + qIndex * 2000),
      String(64000 + qIndex * 1500),
      String(210000 + qIndex * 6000),
    ]);

    isRows.push([
      "AAA",
      String(year),
      String(quarter),
      String(310000 + qIndex * 9000),
      String(175000 + qIndex * 6000),
      String(135000 + qIndex * 3000),
      String(64000 + qIndex * 1800),
      String(52000 + qIndex * 1500),
      String((1900 + qIndex * 50).toFixed(2)),
    ]);

    cfRows.push([
      "AAA",
      String(year),
      String(quarter),
      String(74000 + qIndex * 1800),
      String(-26000 - qIndex * 700),
      String(-12000 - qIndex * 400),
      String(48000 + qIndex * 1200),
      String(19000 + qIndex * 500),
      String(4500 + qIndex * 120),
    ]);
  }

  await writeCsv(
    path.join(outDir, "HOSE_VERIFIED_BalanceSheet_Quarterly_2018_2025.csv"),
    "ticker,yearReport,lengthReport,totalAssets,totalLiabilities,equity,cashAndCashEquivalents,inventory,longTermDebt",
    bsRows
  );

  await writeCsv(
    path.join(outDir, "HOSE_VERIFIED_IncomeStatement_Quarterly_2018_2025.csv"),
    "ticker,yearReport,lengthReport,revenue,costOfGoodsSold,grossProfit,operatingProfit,netIncome,eps",
    isRows
  );

  await writeCsv(
    path.join(outDir, "HOSE_VERIFIED_CashFlow_Quarterly_2018_2025.csv"),
    "ticker,yearReport,lengthReport,operatingCashFlow,investingCashFlow,financingCashFlow,freeCashFlow,capex,dividendsPaid",
    cfRows
  );

  console.log(`[ci-data] generated synthetic runtime datasets in ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

