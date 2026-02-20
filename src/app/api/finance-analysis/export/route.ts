import { NextResponse } from "next/server";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";
import {
  buildDcfValuation,
  buildFinancialHealthScore,
  buildFundamentalAnalysis,
  buildPeerMultiples,
  buildSensitivityMatrix,
  loadFinancialPeriods,
  type DcfResult,
  type FinanceAnalysisType,
  type FinancialHealthResult,
  type FundamentalAnalysisResult,
  type PeerMultiplesResult,
  type RatioPoint,
  type SensitivityResult,
} from "@/lib/finance";
import { getCoverage } from "@/lib/finance/data";
import { getAvailablePeriods } from "@/lib/fundamentals";
export { GET } from "./route-xlsx";

const VALID_SYMBOL_REGEX = /^[A-Z0-9]{1,10}$/;
const RATE_LIMIT_MAX = 30;
const TYPE_SET = new Set<FinanceAnalysisType>([
  "fundamental",
  "health",
  "valuation",
  "peer",
  "sensitivity",
]);

interface FinanceCoverageExport {
  symbol: string;
  periodsAvailable: string[];
  selectedPeriods: string[];
  missingStatements: Array<{ period: string; statement: string }>;
  coverageRatio: number;
}

interface AnalysisPayloadBase {
  symbol: string;
  type: FinanceAnalysisType;
  request: {
    requestedPeriod: string;
    lookback: number;
  };
  coverage: FinanceCoverageExport;
  confidence: "high" | "medium" | "low";
  warnings: string[];
}

interface AnalysisPayload extends AnalysisPayloadBase {
  data: FundamentalAnalysisResult | FinancialHealthResult | DcfResult | PeerMultiplesResult | SensitivityResult;
}

interface SheetData {
  name: string;
  rows: Array<Array<string | number | null>>;
}

function parseType(raw: string | null): FinanceAnalysisType | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "") return "fundamental";
  if (!TYPE_SET.has(value as FinanceAnalysisType)) return null;
  return value as FinanceAnalysisType;
}

function parsePeriod(raw: string | null): string | null {
  const value = (raw ?? "").trim();
  if (!value || value.toLowerCase() === "latest") return null;
  const matchA = /^(\d{4})Q([1-4])$/i.exec(value);
  if (matchA) return `${matchA[1]}Q${matchA[2]}`;
  const matchB = /^Q([1-4])[\s/-]*(\d{4})$/i.exec(value);
  if (matchB) return `${matchB[2]}Q${matchB[1]}`;
  return null;
}

function parseLookback(raw: string | null): number {
  const value = (raw ?? "").trim();
  if (!value) return 8;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 8;
  return Math.min(20, parsed);
}

function extractWarnings(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const warnings = (value as { warnings?: unknown }).warnings;
  if (!Array.isArray(warnings)) return [];
  return warnings.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function dedupeWarnings(warnings: string[]): string[] {
  return Array.from(new Set(warnings.map((item) => item.trim()).filter(Boolean)));
}

function deriveConfidence(
  selectedPeriodsCount: number,
  coverageRatio: number,
  warningCount: number
): "high" | "medium" | "low" {
  let score = 0;
  if (coverageRatio >= 0.9) score += 2;
  else if (coverageRatio >= 0.6) score += 1;

  if (selectedPeriodsCount >= 6) score += 1;
  else if (selectedPeriodsCount <= 1) score -= 1;

  if (warningCount >= 2) score -= 1;

  if (score >= 3) return "high";
  if (score >= 1) return "medium";
  return "low";
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${normalized.toLocaleString("en-US", { maximumFractionDigits: 4 })}%`;
}

function safeSheetName(input: string): string {
  const cleaned = input.replace(/[\\/*?:[\]]/g, " ").trim();
  if (!cleaned) return "Sheet";
  return cleaned.slice(0, 31);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeExcelText(value: string): string {
  if (!value) return value;
  const first = value[0];
  if (first === "=" || first === "+" || first === "-" || first === "@") {
    return `'${value}`;
  }
  return value;
}

function toCellXml(value: string | number | null, isHeader = false): string {
  const style = isHeader ? ' ss:StyleID="sHeader"' : "";
  if (value === null) return `<Cell${style}/>`;
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell${style}><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  const text = sanitizeExcelText(String(value));
  return `<Cell${style}><Data ss:Type="String">${escapeXml(text)}</Data></Cell>`;
}

function buildWorkbookXml(sheets: SheetData[]): string {
  const worksheetXml = sheets
    .map((sheet) => {
      const rowsXml = sheet.rows
        .map((row, rowIndex) => {
          const isHeader = rowIndex === 0;
          const cells = row.map((cell) => toCellXml(cell, isHeader)).join("");
          return `<Row>${cells}</Row>`;
        })
        .join("");
      return `<Worksheet ss:Name="${escapeXml(safeSheetName(sheet.name))}"><Table>${rowsXml}</Table></Worksheet>`;
    })
    .join("");

  return [
    '<?xml version="1.0"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:o="urn:schemas-microsoft-com:office:office"',
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:html="http://www.w3.org/TR/REC-html40">',
    "<Styles>",
    '<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/></Style>',
    '<Style ss:ID="sHeader"><Font ss:Bold="1"/><Interior ss:Color="#E5E7EB" ss:Pattern="Solid"/></Style>',
    "</Styles>",
    worksheetXml,
    "</Workbook>",
  ].join("");
}

function pushRatioSeriesRows(
  rows: Array<Array<string | number | null>>,
  section: string,
  metric: string,
  series: RatioPoint[]
) {
  for (const point of series) {
    rows.push([section, metric, point.period, point.value]);
  }
}

function buildSummarySheet(payload: AnalysisPayload): SheetData {
  const rows: Array<Array<string | number | null>> = [
    ["Field", "Value"],
    ["Symbol", payload.symbol],
    ["Analysis Type", payload.type],
    ["Generated At", new Date().toISOString()],
    ["Requested Period", payload.request.requestedPeriod],
    ["Lookback (quarters)", payload.request.lookback],
    ["Coverage Ratio", formatPercent(payload.coverage.coverageRatio)],
    ["Selected Periods", payload.coverage.selectedPeriods.join(", ") || "n/a"],
    ["Missing Statements", payload.coverage.missingStatements.length],
    ["Confidence", payload.confidence],
    ["Warnings", payload.warnings.length > 0 ? payload.warnings.join(" | ") : "none"],
  ];

  return {
    name: "Summary",
    rows,
  };
}

function buildFundamentalSheets(payload: AnalysisPayloadBase & { data: FundamentalAnalysisResult }): SheetData[] {
  const rows: Array<Array<string | number | null>> = [["Section", "Metric", "Period", "Value"]];

  pushRatioSeriesRows(rows, "Income Statement", "Revenue", payload.data.incomeStatement.revenue);
  pushRatioSeriesRows(rows, "Income Statement", "Net Income", payload.data.incomeStatement.netIncome);

  pushRatioSeriesRows(rows, "Liquidity", "Current Ratio", payload.data.liquidity.currentRatio);
  pushRatioSeriesRows(rows, "Liquidity", "Quick Ratio", payload.data.liquidity.quickRatio);
  pushRatioSeriesRows(rows, "Liquidity", "Cash Ratio", payload.data.liquidity.cashRatio);

  pushRatioSeriesRows(rows, "Leverage", "Debt To Equity", payload.data.leverage.debtToEquity);
  pushRatioSeriesRows(rows, "Leverage", "Debt To Assets", payload.data.leverage.debtToAssets);

  pushRatioSeriesRows(rows, "Profitability", "Net Margin", payload.data.profitability.netMargin);
  pushRatioSeriesRows(rows, "Profitability", "ROA", payload.data.profitability.roa);
  pushRatioSeriesRows(rows, "Profitability", "ROE", payload.data.profitability.roe);

  pushRatioSeriesRows(rows, "Cash Flow Quality", "OCF To Net Income", payload.data.cashFlowQuality.ocfToNetIncome);
  pushRatioSeriesRows(rows, "Cash Flow Quality", "FCF", payload.data.cashFlowQuality.fcf);

  pushRatioSeriesRows(rows, "Growth", "Revenue YoY", payload.data.growth.revenueYoY);
  pushRatioSeriesRows(rows, "Growth", "Net Income YoY", payload.data.growth.netIncomeYoY);

  const sheets: SheetData[] = [{ name: "Fundamental", rows }];
  if (payload.data.bankSummary) {
    const bankRows: Array<Array<string | number | null>> = [["Metric", "Period", "Value"]];
    for (const metric of [
      { label: "Net Interest Income", points: payload.data.bankSummary.netInterestIncome },
      { label: "Total Operating Revenue", points: payload.data.bankSummary.totalOperatingRevenue },
      { label: "Provision For Credit Losses", points: payload.data.bankSummary.provisionForCreditLosses },
      { label: "Profit Before Tax", points: payload.data.bankSummary.profitBeforeTax },
      { label: "Total Assets", points: payload.data.bankSummary.totalAssets },
      { label: "Loans To Customers", points: payload.data.bankSummary.loansToCustomers },
      { label: "Deposits From Customers", points: payload.data.bankSummary.depositsFromCustomers },
    ]) {
      for (const point of metric.points) {
        bankRows.push([metric.label, point.period, point.value]);
      }
    }
    sheets.push({ name: "Bank Summary", rows: bankRows });
  }
  return sheets;
}

function buildHealthSheet(payload: AnalysisPayloadBase & { data: FinancialHealthResult }): SheetData {
  const rows: Array<Array<string | number | null>> = [
    ["Component", "Score", "Weight", "Note"],
    ...payload.data.components.map((item) => [item.name, item.score, item.weight, item.note]),
    ["TOTAL", payload.data.score, null, payload.data.rating],
  ];
  return {
    name: "Health Score",
    rows,
  };
}

function buildValuationSheets(payload: AnalysisPayloadBase & { data: DcfResult }): SheetData[] {
  const assumptionsRows: Array<Array<string | number | null>> = [
    ["Assumption", "Value"],
    ["As Of Period", payload.data.asOfPeriod],
    ["Forecast Years", payload.data.assumptions.forecastYears],
    ["Revenue Growth", payload.data.assumptions.revenueGrowth],
    ["FCF Margin", payload.data.assumptions.fcfMargin],
    ["WACC", payload.data.assumptions.wacc],
    ["Terminal Growth", payload.data.assumptions.terminalGrowth],
    ["Net Debt", payload.data.assumptions.netDebt],
    ["Shares Outstanding", payload.data.assumptions.sharesOutstanding],
    ["Enterprise Value", payload.data.enterpriseValue],
    ["Equity Value", payload.data.equityValue],
    ["Fair Value Per Share", payload.data.fairValuePerShare],
    ["Current Price", payload.data.currentPrice],
    ["Upside/Downside %", payload.data.upsideDownsidePct],
  ];

  const projectionsRows: Array<Array<string | number | null>> = [
    ["Year", "Revenue", "FCF", "Discount Factor", "Discounted FCF"],
    ...payload.data.projections.map((item) => [
      item.year,
      item.revenue,
      item.fcf,
      item.discountFactor,
      item.discountedFcf,
    ]),
  ];

  const historicalRows: Array<Array<string | number | null>> = [
    ["Series", "Period", "Value"],
    ...payload.data.historical.revenue.map((item) => ["Revenue", item.period, item.value]),
    ...payload.data.historical.fcf.map((item) => ["FCF", item.period, item.value]),
  ];

  return [
    { name: "Valuation", rows: assumptionsRows },
    { name: "Projections", rows: projectionsRows },
    { name: "Historical", rows: historicalRows },
  ];
}

function buildPeerSheet(payload: AnalysisPayloadBase & { data: PeerMultiplesResult }): SheetData {
  const rows: Array<Array<string | number | null>> = [
    ["Symbol", "Price", "Market Cap Approx", "P/E", "P/B"],
    ...payload.data.peers.map((item) => [
      item.symbol,
      item.price,
      item.marketCapApprox,
      item.pe,
      item.pb,
    ]),
    ["MEDIAN", null, null, payload.data.medianPe, payload.data.medianPb],
  ];
  return {
    name: "Peer Multiples",
    rows,
  };
}

function buildSensitivitySheets(payload: AnalysisPayloadBase & { data: SensitivityResult }): SheetData[] {
  const cellsRows: Array<Array<string | number | null>> = [
    ["WACC", "Terminal Growth", "Fair Value Per Share"],
    ...payload.data.cells.map((cell) => [cell.wacc, cell.terminalGrowth, cell.fairValuePerShare]),
  ];

  const waccValues = Array.from(new Set(payload.data.cells.map((cell) => cell.wacc))).sort((a, b) => a - b);
  const tgValues = Array.from(new Set(payload.data.cells.map((cell) => cell.terminalGrowth))).sort((a, b) => a - b);
  const matrixHeader: Array<string | number | null> = ["WACC \\ Terminal Growth", ...tgValues];
  const matrixRows: Array<Array<string | number | null>> = [matrixHeader];
  for (const wacc of waccValues) {
    const row: Array<string | number | null> = [wacc];
    for (const terminalGrowth of tgValues) {
      const matched = payload.data.cells.find(
        (cell) => cell.wacc === wacc && cell.terminalGrowth === terminalGrowth
      );
      row.push(matched?.fairValuePerShare ?? null);
    }
    matrixRows.push(row);
  }

  return [
    { name: "Sensitivity Cells", rows: cellsRows },
    { name: "Sensitivity Matrix", rows: matrixRows },
  ];
}

async function buildAnalysisPayload(
  symbol: string,
  type: FinanceAnalysisType,
  requestedPeriod: string | null,
  lookback: number
): Promise<AnalysisPayload> {
  const availablePeriods = await getAvailablePeriods(symbol);
  if (availablePeriods.length === 0) {
    throw new Error("No financial data available for this symbol");
  }
  if (requestedPeriod && !availablePeriods.includes(requestedPeriod)) {
    throw new Error(`No financial data available for requested period ${requestedPeriod}.`);
  }

  const rows = await loadFinancialPeriods(symbol, lookback, { endPeriod: requestedPeriod ?? undefined });
  if (rows.length === 0) {
    throw new Error("No financial data available for this symbol");
  }

  const coverage = await getCoverage(symbol, rows);
  const totalStatementSlots = coverage.selectedPeriods.length * 3;
  const coverageRatio =
    totalStatementSlots > 0
      ? (totalStatementSlots - coverage.missingStatements.length) / totalStatementSlots
      : 0;
  const coverageWarnings: string[] = [];
  if (coverage.missingStatements.length > 0) {
    coverageWarnings.push(`Missing statement segments in selected periods: ${coverage.missingStatements.length}.`);
  }
  if (coverage.selectedPeriods.length < 4) {
    coverageWarnings.push(`Only ${coverage.selectedPeriods.length} period(s) available for analysis.`);
  }

  if (type === "fundamental") {
    const data = await buildFundamentalAnalysis(symbol, rows);
    const warnings = dedupeWarnings([...coverageWarnings, ...extractWarnings(data)]);
    const confidence =
      data.analysisMode === "banking_degraded"
        ? "low"
        : deriveConfidence(coverage.selectedPeriods.length, coverageRatio, warnings.length);
    return {
      symbol,
      type,
      request: {
        requestedPeriod: requestedPeriod ?? "latest",
        lookback,
      },
      data,
      coverage: {
        symbol: coverage.symbol,
        periodsAvailable: coverage.periodsAvailable,
        selectedPeriods: coverage.selectedPeriods,
        missingStatements: coverage.missingStatements,
        coverageRatio,
      },
      confidence,
      warnings,
    };
  }

  if (type === "health") {
    const fundamental = await buildFundamentalAnalysis(symbol, rows);
    const data = buildFinancialHealthScore(fundamental);
    const warnings = dedupeWarnings([...coverageWarnings, ...extractWarnings(data)]);
    const confidence =
      fundamental.analysisMode === "banking_degraded"
        ? "low"
        : deriveConfidence(coverage.selectedPeriods.length, coverageRatio, warnings.length);
    return {
      symbol,
      type,
      request: {
        requestedPeriod: requestedPeriod ?? "latest",
        lookback,
      },
      data,
      coverage: {
        symbol: coverage.symbol,
        periodsAvailable: coverage.periodsAvailable,
        selectedPeriods: coverage.selectedPeriods,
        missingStatements: coverage.missingStatements,
        coverageRatio,
      },
      confidence,
      warnings,
    };
  }

  if (type === "valuation") {
    const data = await buildDcfValuation(symbol);
    const warnings = dedupeWarnings([...coverageWarnings, ...extractWarnings(data)]);
    const confidence = deriveConfidence(coverage.selectedPeriods.length, coverageRatio, warnings.length);
    return {
      symbol,
      type,
      request: {
        requestedPeriod: requestedPeriod ?? "latest",
        lookback,
      },
      data,
      coverage: {
        symbol: coverage.symbol,
        periodsAvailable: coverage.periodsAvailable,
        selectedPeriods: coverage.selectedPeriods,
        missingStatements: coverage.missingStatements,
        coverageRatio,
      },
      confidence,
      warnings,
    };
  }

  if (type === "peer") {
    const data = await buildPeerMultiples(symbol);
    const warnings = dedupeWarnings([...coverageWarnings, ...extractWarnings(data)]);
    const confidence = deriveConfidence(coverage.selectedPeriods.length, coverageRatio, warnings.length);
    return {
      symbol,
      type,
      request: {
        requestedPeriod: requestedPeriod ?? "latest",
        lookback,
      },
      data,
      coverage: {
        symbol: coverage.symbol,
        periodsAvailable: coverage.periodsAvailable,
        selectedPeriods: coverage.selectedPeriods,
        missingStatements: coverage.missingStatements,
        coverageRatio,
      },
      confidence,
      warnings,
    };
  }

  const data = await buildSensitivityMatrix(symbol);
  const warnings = dedupeWarnings([...coverageWarnings, ...extractWarnings(data)]);
  const confidence = deriveConfidence(coverage.selectedPeriods.length, coverageRatio, warnings.length);
  return {
    symbol,
    type,
    request: {
      requestedPeriod: requestedPeriod ?? "latest",
      lookback,
    },
    data,
    coverage: {
      symbol: coverage.symbol,
      periodsAvailable: coverage.periodsAvailable,
      selectedPeriods: coverage.selectedPeriods,
      missingStatements: coverage.missingStatements,
      coverageRatio,
    },
    confidence,
    warnings,
  };
}

function buildSheets(payload: AnalysisPayload): SheetData[] {
  const sheets: SheetData[] = [buildSummarySheet(payload)];
  if (payload.type === "fundamental") {
    sheets.push(...buildFundamentalSheets(payload as AnalysisPayloadBase & { data: FundamentalAnalysisResult }));
  } else if (payload.type === "health") {
    sheets.push(buildHealthSheet(payload as AnalysisPayloadBase & { data: FinancialHealthResult }));
  } else if (payload.type === "valuation") {
    sheets.push(...buildValuationSheets(payload as AnalysisPayloadBase & { data: DcfResult }));
  } else if (payload.type === "peer") {
    sheets.push(buildPeerSheet(payload as AnalysisPayloadBase & { data: PeerMultiplesResult }));
  } else if (payload.type === "sensitivity") {
    sheets.push(...buildSensitivitySheets(payload as AnalysisPayloadBase & { data: SensitivityResult }));
  }
  return sheets;
}

async function GET_LEGACY(request: Request) {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/finance-analysis/export", clientId), RATE_LIMIT_MAX, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "").trim().toUpperCase();
  const type = parseType(searchParams.get("type"));
  const requestedPeriod = parsePeriod(searchParams.get("period"));
  const lookback = parseLookback(searchParams.get("lookback"));

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }
  if (!VALID_SYMBOL_REGEX.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol format. Must be 1-10 uppercase letters or digits." }, { status: 400 });
  }
  if (!type) {
    return NextResponse.json(
      { error: 'Invalid type. Use "fundamental", "health", "valuation", "peer", or "sensitivity".' },
      { status: 400 }
    );
  }
  if (searchParams.get("period") && !requestedPeriod && searchParams.get("period")?.toLowerCase() !== "latest") {
    return NextResponse.json({ error: 'Invalid period. Use "latest", "YYYYQn", or "Qn/YYYY".' }, { status: 400 });
  }

  try {
    const payload = await buildAnalysisPayload(symbol, type, requestedPeriod, lookback);
    const sheets = buildSheets(payload);
    const xml = buildWorkbookXml(sheets);
    const fileDate = new Date().toISOString().slice(0, 10);
    const filename = `${symbol}-${type}-${fileDate}.xls`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Finance analysis export API error:", error);
    const message = error instanceof Error ? error.message : "Failed to export finance analysis";
    if (message.includes("No financial data")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to export finance analysis" }, { status: 500 });
  }
}

void GET_LEGACY;
