import { deflateRawSync } from "node:zlib";
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

interface FormulaCell {
  formula: string;
  value?: number | null;
}

type SheetCell = string | number | null | FormulaCell;

interface SheetData {
  name: string;
  rows: Array<Array<SheetCell>>;
}

interface ZipEntry {
  name: string;
  data: Buffer;
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

function isFormulaCell(value: SheetCell): value is FormulaCell {
  return typeof value === "object" && value !== null && "formula" in value;
}
function safeSheetName(input: string): string {
  const cleaned = input.replace(/[\\/*?:[\]]/g, " ").trim();
  if (!cleaned) return "Sheet";
  return cleaned.slice(0, 31);
}

function normalizeSheetNames(sheets: SheetData[]): SheetData[] {
  const counts = new Map<string, number>();
  return sheets.map((sheet) => {
    const baseName = safeSheetName(sheet.name);
    const seen = counts.get(baseName) ?? 0;
    counts.set(baseName, seen + 1);
    if (seen === 0) return { ...sheet, name: baseName };

    const suffix = ` (${seen + 1})`;
    const trimmed = baseName.slice(0, Math.max(1, 31 - suffix.length)).trim();
    return { ...sheet, name: `${trimmed}${suffix}` };
  });
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

function columnNameFromIndex(index: number): string {
  let value = index;
  let name = "";
  while (value > 0) {
    const rem = (value - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function cellRef(row: number, col: number): string {
  return `${columnNameFromIndex(col)}${row}`;
}

function renderCellXml(cell: SheetCell, row: number, col: number, isHeader: boolean): string {
  const ref = cellRef(row, col);
  const styleAttr = isHeader ? ' s="1"' : "";

  if (cell === null) {
    return `<c r="${ref}"${styleAttr}/>`;
  }

  if (isFormulaCell(cell)) {
    const formula = escapeXml(cell.formula);
    const cached =
      typeof cell.value === "number" && Number.isFinite(cell.value) ? `<v>${cell.value}</v>` : "";
    return `<c r="${ref}"${styleAttr}><f>${formula}</f>${cached}</c>`;
  }

  if (typeof cell === "number" && Number.isFinite(cell)) {
    return `<c r="${ref}"${styleAttr}><v>${cell}</v></c>`;
  }

  const text = sanitizeExcelText(String(cell));
  const preserveSpace = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : "";
  return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t${preserveSpace}>${escapeXml(text)}</t></is></c>`;
}

function buildWorksheetXml(sheet: SheetData): string {
  const rowsXml = sheet.rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const isHeader = rowIndex === 0;
      const cellsXml = row
        .map((cell, colIndex) => renderCellXml(cell, rowNumber, colIndex + 1, isHeader))
        .join("");
      return `<row r="${rowNumber}">${cellsXml}</row>`;
    })
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    "<sheetData>",
    rowsXml,
    "</sheetData>",
    "</worksheet>",
  ].join("");
}

function buildWorkbookXml(sheets: SheetData[]): string {
  const sheetXml = sheets
    .map((sheet, index) => {
      return `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`;
    })
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    "<sheets>",
    sheetXml,
    "</sheets>",
    '<calcPr calcId="171027" fullCalcOnLoad="1"/>',
    "</workbook>",
  ].join("");
}

function buildWorkbookRelsXml(sheetCount: number): string {
  const rels = [
    ...Array.from({ length: sheetCount }, (_, index) => {
      return `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`;
    }),
    `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
  ].join("");

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    rels,
    "</Relationships>",
  ].join("");
}

function buildContentTypesXml(sheetCount: number): string {
  const overrides = [
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    ...Array.from({ length: sheetCount }, (_, index) => {
      return `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
    }),
  ].join("");

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    overrides,
    "</Types>",
  ].join("");
}

function buildRootRelsXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
    "</Relationships>",
  ].join("");
}

function buildStylesXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<fonts count="2">',
    '<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>',
    '<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>',
    "</fonts>",
    '<fills count="2">',
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/><bgColor indexed="64"/></patternFill></fill>',
    "</fills>",
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>',
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
    '<cellXfs count="2">',
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    '<xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/>',
    "</cellXfs>",
    "</styleSheet>",
  ].join("");
}

function createCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC32_TABLE = createCrc32Table();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { dosTime, dosDate };
}

function createZip(entries: ZipEntry[]): Buffer {
  const now = getDosDateTime(new Date());
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name.replace(/\\/g, "/"), "utf8");
    const compressed = deflateRawSync(entry.data);
    const checksum = crc32(entry.data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(now.dosTime, 10);
    localHeader.writeUInt16LE(now.dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localChunks.push(localHeader, nameBuffer, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(now.dosTime, 12);
    centralHeader.writeUInt16LE(now.dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);

    centralChunks.push(centralHeader, nameBuffer);

    localOffset += localHeader.length + nameBuffer.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralChunks);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(localOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, centralDirectory, endRecord]);
}

function buildXlsxBuffer(rawSheets: SheetData[]): Buffer {
  const sheets = normalizeSheetNames(rawSheets);
  const worksheetEntries: ZipEntry[] = sheets.map((sheet, index) => ({
    name: `xl/worksheets/sheet${index + 1}.xml`,
    data: Buffer.from(buildWorksheetXml(sheet), "utf8"),
  }));

  const entries: ZipEntry[] = [
    {
      name: "[Content_Types].xml",
      data: Buffer.from(buildContentTypesXml(sheets.length), "utf8"),
    },
    {
      name: "_rels/.rels",
      data: Buffer.from(buildRootRelsXml(), "utf8"),
    },
    {
      name: "xl/workbook.xml",
      data: Buffer.from(buildWorkbookXml(sheets), "utf8"),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: Buffer.from(buildWorkbookRelsXml(sheets.length), "utf8"),
    },
    {
      name: "xl/styles.xml",
      data: Buffer.from(buildStylesXml(), "utf8"),
    },
    ...worksheetEntries,
  ];

  return createZip(entries);
}
function pushRatioSeriesRows(
  rows: Array<Array<SheetCell>>,
  section: string,
  metric: string,
  series: RatioPoint[]
) {
  for (const point of series) {
    rows.push([section, metric, point.period, point.value]);
  }
}

function buildSummarySheet(payload: AnalysisPayload): SheetData {
  return {
    name: "Summary",
    rows: [
      ["Field", "Value"],
      ["Symbol", payload.symbol],
      ["Analysis Type", payload.type],
      ["Generated At", new Date().toISOString()],
      ["Requested Period", payload.request.requestedPeriod],
      ["Lookback (quarters)", payload.request.lookback],
      ["Coverage Ratio", payload.coverage.coverageRatio],
      ["Selected Periods", payload.coverage.selectedPeriods.join(", ") || "n/a"],
      ["Missing Statements", payload.coverage.missingStatements.length],
      ["Confidence", payload.confidence],
      ["Warnings", payload.warnings.length > 0 ? payload.warnings.join(" | ") : "none"],
    ],
  };
}

function buildFundamentalSheets(payload: AnalysisPayloadBase & { data: FundamentalAnalysisResult }): SheetData[] {
  const rows: Array<Array<SheetCell>> = [["Section", "Metric", "Period", "Value"]];

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
    const bankRows: Array<Array<SheetCell>> = [["Metric", "Period", "Value"]];
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
  return {
    name: "Health Score",
    rows: [
      ["Component", "Score", "Weight", "Note"],
      ...payload.data.components.map((item) => [item.name, item.score, item.weight, item.note]),
      ["TOTAL", payload.data.score, null, payload.data.rating],
    ],
  };
}

function buildValuationSheets(payload: AnalysisPayloadBase & { data: DcfResult }): SheetData[] {
  const assumptions = payload.data.assumptions;
  const forecastYears = Math.max(1, assumptions.forecastYears);
  const projections = payload.data.projections;

  const inputRows: Array<Array<SheetCell>> = [
    ["Assumption", "Value"],
    ["As Of Period", payload.data.asOfPeriod],
    ["Forecast Years", assumptions.forecastYears],
    ["Revenue Growth", assumptions.revenueGrowth],
    ["FCF Margin", assumptions.fcfMargin],
    ["WACC", assumptions.wacc],
    ["Terminal Growth", assumptions.terminalGrowth],
    ["Net Debt", assumptions.netDebt],
    ["Shares Outstanding", assumptions.sharesOutstanding],
    ["Current Price", payload.data.currentPrice],
  ];

  const historicalRows: Array<Array<SheetCell>> = [
    ["Series", "Period", "Value"],
    ...payload.data.historical.revenue.map((item) => ["Revenue", item.period, item.value]),
    ...payload.data.historical.fcf.map((item) => ["FCF", item.period, item.value]),
  ];

  const projectionRows: Array<Array<SheetCell>> = [["Year", "Revenue", "FCF", "Discount Factor", "Discounted FCF"]];
  for (let index = 0; index < forecastYears; index += 1) {
    const row = index + 2;
    const point = projections[index];
    const revenueFormula =
      index === 0
        ? `IFERROR(LOOKUP(2,1/(Historical!A:A="Revenue"),Historical!C:C)*(1+Inputs!B4),0)`
        : `B${row - 1}*(1+Inputs!B4)`;
    const fcfFormula = `B${row}*Inputs!B5`;
    const discountFormula = `1/((1+Inputs!B6)^A${row})`;
    const discountedFormula = `C${row}*D${row}`;

    projectionRows.push([
      point?.year ?? index + 1,
      { formula: revenueFormula, value: point?.revenue ?? null },
      { formula: fcfFormula, value: point?.fcf ?? null },
      { formula: discountFormula, value: point?.discountFactor ?? null },
      { formula: discountedFormula, value: point?.discountedFcf ?? null },
    ]);
  }

  const projectionLastRow = forecastYears + 1;
  const pvForecast = projections.reduce((acc, item) => acc + item.discountedFcf, 0);
  const terminalPv = payload.data.enterpriseValue - pvForecast;
  const valuationRows: Array<Array<SheetCell>> = [
    ["Metric", "Value", "Note"],
    ["PV of Forecast FCF", { formula: `SUM(Projection!E2:E${projectionLastRow})`, value: pvForecast }, ""],
    [
      "Terminal Value",
      {
        formula: `IFERROR((INDEX(Projection!C:C,${projectionLastRow})*(1+Inputs!B7))/(Inputs!B6-Inputs!B7),0)`,
        value: payload.data.terminalValue,
      },
      "",
    ],
    [
      "PV of Terminal Value",
      { formula: `B3*INDEX(Projection!D:D,${projectionLastRow})`, value: terminalPv },
      "",
    ],
    ["Enterprise Value", { formula: "B2+B4", value: payload.data.enterpriseValue }, ""],
    ["Equity Value", { formula: "B5-Inputs!B8", value: payload.data.equityValue }, ""],
    ["Fair Value Per Share", { formula: "IFERROR(B6/Inputs!B9,0)", value: payload.data.fairValuePerShare }, ""],
    ["Current Price", { formula: "Inputs!B10", value: payload.data.currentPrice ?? null }, ""],
    ["Upside / Downside %", { formula: "IFERROR(B7/B8-1,0)", value: payload.data.upsideDownsidePct ?? null }, ""],
    ["Reported EV (model output)", payload.data.enterpriseValue, "Reference value from API"],
    ["Reported Fair Value (model output)", payload.data.fairValuePerShare, "Reference value from API"],
  ];

  return [
    { name: "Inputs", rows: inputRows },
    { name: "Historical", rows: historicalRows },
    { name: "Projection", rows: projectionRows },
    { name: "Valuation", rows: valuationRows },
  ];
}

function buildPeerSheet(payload: AnalysisPayloadBase & { data: PeerMultiplesResult }): SheetData {
  return {
    name: "Peer Multiples",
    rows: [
      ["Symbol", "Price", "Market Cap Approx", "P/E", "P/B"],
      ...payload.data.peers.map((item) => [
        item.symbol,
        item.price,
        item.marketCapApprox,
        item.pe,
        item.pb,
      ]),
      ["MEDIAN", null, null, payload.data.medianPe, payload.data.medianPb],
    ],
  };
}

function buildSensitivitySheets(payload: AnalysisPayloadBase & { data: SensitivityResult }): SheetData[] {
  const cellsRows: Array<Array<SheetCell>> = [
    ["WACC", "Terminal Growth", "Fair Value Per Share"],
    ...payload.data.cells.map((cell) => [cell.wacc, cell.terminalGrowth, cell.fairValuePerShare]),
  ];

  const waccValues = Array.from(new Set(payload.data.cells.map((cell) => cell.wacc))).sort((a, b) => a - b);
  const tgValues = Array.from(new Set(payload.data.cells.map((cell) => cell.terminalGrowth))).sort((a, b) => a - b);
  const matrixRows: Array<Array<SheetCell>> = [["WACC \\ Terminal Growth", ...tgValues]];
  for (const wacc of waccValues) {
    const row: Array<SheetCell> = [wacc];
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

export async function GET(request: Request) {
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
    const xlsxBuffer = buildXlsxBuffer(sheets);
    const fileDate = new Date().toISOString().slice(0, 10);
    const filename = `${symbol}-${type}-${fileDate}.xlsx`;

    return new NextResponse(new Uint8Array(xlsxBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
