import type {
  AssistantCitation,
  AssistantContextSnapshot,
  AssistantMessageBlock,
  AssistantToolName,
  AssistantToolUsage,
} from '@/types/assistant';
import type { FinanceAnalysisType } from '@/lib/finance';
import { collectRequiredSignals, getCandidateSymbols, hasAnyKeyword, normalizeForKeywordMatch } from '@/lib/assistant/signals';

const TOOL_TIMEOUT_MS = resolveToolTimeoutMs();
const MAX_TOOL_CONCURRENCY = 3;
const MAX_FACTS = 12;
const MAX_MESSAGE_BLOCKS = 6;
const BASELINE_ONLY_MODE = String(process.env.ASSISTANT_BASELINE_ONLY ?? "false").trim().toLowerCase() === "true";

interface GroundingInput {
  baseUrl?: string;
  message: string;
  contextSnapshot?: AssistantContextSnapshot;
}

export interface GroundingResult {
  facts: string[];
  citations: AssistantCitation[];
  usedTools: AssistantToolUsage[];
  messageBlocks: AssistantMessageBlock[];
}

interface ToolRunOutput {
  facts: string[];
  citations: AssistantCitation[];
  messageBlocks?: AssistantMessageBlock[];
  evidenceCount?: number;
  warningCount?: number;
}

interface ToolTask {
  name: AssistantToolName;
  run: () => Promise<ToolRunOutput>;
}

interface HttpErrorShape {
  status?: number;
  message: string;
}

export async function runGroundingTools(input: GroundingInput): Promise<GroundingResult> {
  const symbols = getCandidateSymbols(input.message, input.contextSnapshot);
  const plannedTasks = buildToolTasks('', input.message, symbols, input.contextSnapshot);
  if (!input.baseUrl) {
    return {
      facts: [],
      citations: [],
      usedTools:
        plannedTasks.length > 0
          ? plannedTasks.map((task) => ({
              name: task.name,
              status: 'error',
              latencyMs: 0,
              evidenceCount: 0,
              warningCount: 0,
              error: 'Assistant grounding base URL is not configured.',
            }))
          : [{ name: 'marketSnapshot', status: 'skipped', latencyMs: 0, evidenceCount: 0, warningCount: 0 }],
      messageBlocks: [],
    };
  }

  const tasks = buildToolTasks(input.baseUrl, input.message, symbols, input.contextSnapshot);

  const facts: string[] = [];
  const citations: AssistantCitation[] = [];
  const usedTools: AssistantToolUsage[] = [];
  const messageBlocks: AssistantMessageBlock[] = [];
  const executed = await runTasksWithConcurrency(tasks, MAX_TOOL_CONCURRENCY);
  for (const item of executed) {
    if (item.status === 'success') {
      const output = item.output;
      facts.push(...output.facts);
      citations.push(...output.citations);
      if (output.messageBlocks) {
        messageBlocks.push(...output.messageBlocks);
      }
      usedTools.push({
        name: item.task.name,
        status: 'success',
        latencyMs: item.latencyMs,
        evidenceCount: output.evidenceCount ?? 0,
        warningCount: output.warningCount ?? 0,
      });
      continue;
    }

    const normalizedError = normalizeHttpError(item.error);
    usedTools.push({
      name: item.task.name,
      status: 'error',
      latencyMs: item.latencyMs,
      evidenceCount: 0,
      warningCount: 0,
      error: normalizedError.status ? `HTTP ${normalizedError.status}: ${normalizedError.message}` : normalizedError.message,
    });
  }

  if (tasks.length === 0) {
    usedTools.push({ name: 'marketSnapshot', status: 'skipped', latencyMs: 0, evidenceCount: 0, warningCount: 0 });
  }

  return {
    facts: facts.slice(0, MAX_FACTS),
    citations: dedupeCitations(citations),
    usedTools,
    messageBlocks: messageBlocks.slice(0, MAX_MESSAGE_BLOCKS),
  };
}

type TaskExecutionResult =
  | { task: ToolTask; status: 'success'; output: ToolRunOutput; latencyMs: number }
  | { task: ToolTask; status: 'error'; error: unknown; latencyMs: number };

async function runTasksWithConcurrency(tasks: ToolTask[], concurrency: number): Promise<TaskExecutionResult[]> {
  const limit = Math.max(1, Math.min(concurrency, tasks.length || 1));
  const results: TaskExecutionResult[] = new Array(tasks.length);
  let cursor = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= tasks.length) return;

      const task = tasks[index];
      const startedAt = Date.now();
      try {
        const output = await task.run();
        results[index] = {
          task,
          status: 'success',
          output,
          latencyMs: Date.now() - startedAt,
        };
      } catch (error) {
        results[index] = {
          task,
          status: 'error',
          error,
          latencyMs: Date.now() - startedAt,
        };
      }
    }
  });

  await Promise.all(workers);
  return results;
}

function buildToolTasks(
  baseUrl: string,
  message: string,
  symbols: string[],
  contextSnapshot?: AssistantContextSnapshot
): ToolTask[] {
  const messageLower = normalizeForKeywordMatch(message);
  const primarySymbol = symbols[0];
  const requiredSignals = collectRequiredSignals({
    message,
    contextSnapshot,
    baselineOnlyMode: BASELINE_ONLY_MODE,
  });
  const requiredToolSet = new Set(requiredSignals.map((signal) => signal.tool));
  const needsFundamentals = requiredToolSet.has("fundamentalSnapshot");
  const needsHealthScore = requiredToolSet.has("financialHealthScore");
  const needsValuation = requiredToolSet.has("valuationDcf");
  const needsPeer = requiredToolSet.has("peerMultiples");
  const needsRisk = requiredToolSet.has("riskSnapshot");
  const needsBacktest = requiredToolSet.has("backtestSummary");
  const needsFactor = requiredToolSet.has("factorSnapshot");
  const needsMarket = requiredToolSet.has("marketSnapshot");
  const needsSensitivity = requiredToolSet.has("scenarioSensitivity") || hasAnyKeyword(messageLower, [
    "sensitivity",
    "scenario",
    "bull",
    "bear",
    "base case",
  ]);
  const tasks: ToolTask[] = [];
  const seen = new Set<AssistantToolName>();
  const addTask = (name: AssistantToolName, run: () => Promise<ToolRunOutput>) => {
    if (seen.has(name)) return;
    seen.add(name);
    tasks.push({ name, run });
  };

  const addTaskByName = (name: AssistantToolName) => {
    if (name === "stockSnapshot") {
      if (!primarySymbol) return;
      addTask(name, () => fetchStockSnapshot(baseUrl, primarySymbol, contextSnapshot?.timeframe));
      return;
    }
    if (name === "fundamentalSnapshot") {
      if (!primarySymbol) return;
      addTask(name, () => fetchFundamentalSnapshot(baseUrl, primarySymbol));
      return;
    }
    if (name === "fundamentalAnalysis") {
      if (!primarySymbol) return;
      addTask(name, () => fetchFinanceAnalysis(baseUrl, primarySymbol, "fundamental"));
      return;
    }
    if (name === "financialHealthScore") {
      if (!primarySymbol || BASELINE_ONLY_MODE) return;
      addTask(name, () => fetchFinanceAnalysis(baseUrl, primarySymbol, "health"));
      return;
    }
    if (name === "valuationDcf") {
      if (!primarySymbol || BASELINE_ONLY_MODE) return;
      addTask(name, () => fetchFinanceAnalysis(baseUrl, primarySymbol, "valuation"));
      return;
    }
    if (name === "peerMultiples") {
      if (!primarySymbol || BASELINE_ONLY_MODE) return;
      addTask(name, () => fetchFinanceAnalysis(baseUrl, primarySymbol, "peer"));
      return;
    }
    if (name === "scenarioSensitivity") {
      if (!primarySymbol || BASELINE_ONLY_MODE) return;
      addTask(name, () => fetchFinanceAnalysis(baseUrl, primarySymbol, "sensitivity"));
      return;
    }
    if (name === "riskSnapshot") {
      if (!primarySymbol) return;
      addTask(name, () => fetchRiskSnapshot(baseUrl, primarySymbol));
      return;
    }
    if (name === "backtestSummary") {
      if (!primarySymbol) return;
      addTask(name, () => fetchBacktestSummary(baseUrl, primarySymbol));
      return;
    }
    if (name === "factorSnapshot") {
      addTask(name, () => fetchFactorSnapshot(baseUrl));
      return;
    }
    if (name === "marketSnapshot") {
      addTask(name, () => fetchMarketSnapshot(baseUrl));
    }
  };

  if (primarySymbol) {
    addTaskByName("stockSnapshot");
  }

  for (const signal of requiredSignals) {
    addTaskByName(signal.tool);
  }

  if (primarySymbol && (needsFundamentals || needsHealthScore)) {
    addTaskByName("fundamentalAnalysis");
  }

  if (primarySymbol && !BASELINE_ONLY_MODE && (needsSensitivity || needsValuation)) {
    addTaskByName("scenarioSensitivity");
  }

  if (primarySymbol && needsPeer) {
    addTaskByName("peerMultiples");
  }
  if (primarySymbol && needsRisk) {
    addTaskByName("riskSnapshot");
  }
  if (primarySymbol && needsBacktest) {
    addTaskByName("backtestSummary");
  }
  if (needsFactor) {
    addTaskByName("factorSnapshot");
  }
  if (!primarySymbol || needsMarket) {
    addTaskByName("marketSnapshot");
  }

  return tasks;
}

async function fetchStockSnapshot(baseUrl: string, symbol: string, timeframe?: string): Promise<ToolRunOutput> {
  const limit = timeframe && /^\d+$/.test(timeframe) ? timeframe : '60';
  const endpoint = `/api/stocks?symbol=${encodeURIComponent(symbol)}&limit=${encodeURIComponent(limit)}`;
  const payload = await fetchJson<{
    data?: Array<{ date?: string; close?: number; volume?: number }>;
  }>(baseUrl, endpoint);
  const series = Array.isArray(payload.data) ? payload.data : [];
  if (series.length === 0) {
    return {
      facts: [`No OHLCV rows were returned for ${symbol}.`],
      citations: [buildCitation(`stock-${symbol}`, `OHLCV snapshot for ${symbol}`, endpoint, symbol)],
      evidenceCount: 0,
      warningCount: 1,
    };
  }

  const latest = series[series.length - 1];
  const previous = series.length >= 2 ? series[series.length - 2] : undefined;
  const latestClose = toNumber(latest.close);
  const previousClose = previous ? toNumber(previous.close) : null;
  const latestVolume = toNumber(latest.volume);
  const dayChangePct =
    latestClose !== null && previousClose !== null && previousClose !== 0
      ? ((latestClose - previousClose) / previousClose) * 100
      : null;

  const facts = [
    `Stock snapshot ${symbol}: latest_close=${formatMaybeNumber(latestClose)}, day_change_pct=${formatMaybePercent(dayChangePct)}, latest_volume=${formatMaybeNumber(latestVolume)}, latest_date=${String(latest.date ?? 'unknown')}.`,
  ];

  return {
    facts,
    citations: [buildCitation(`stock-${symbol}`, `OHLCV snapshot for ${symbol}`, endpoint, symbol)],
    evidenceCount: countNumericEvidence([latestClose, dayChangePct, latestVolume]),
  };
}

async function fetchFundamentalSnapshot(baseUrl: string, symbol: string): Promise<ToolRunOutput> {
  const endpoint = `/api/fundamentals?symbol=${encodeURIComponent(symbol)}&period=latest&statement=all`;
  const payload = await fetchJson<{
    period?: string;
    incomeStatement?: unknown;
    balanceSheet?: unknown;
    cashFlow?: unknown;
    warnings?: string[];
    confidence?: "high" | "medium" | "low";
    coverage?: {
      missingRequestedStatements?: string[];
      coverageRatio?: number;
    };
  }>(baseUrl, endpoint);

  const incomeFields = extractStatementFields(payload.incomeStatement);
  const balanceFields = extractStatementFields(payload.balanceSheet);
  const cashFlowFields = extractStatementFields(payload.cashFlow);

  const revenue = getFirstNumericByHints(incomeFields, ['revenue', 'doanh thu', 'sales']);
  const netIncome = getFirstNumericByHints(incomeFields, ['net income', 'lá»£i nhuáº­n', 'profit']);
  const totalAssets = getFirstNumericByHints(balanceFields, ['total assets', 'tá»•ng tÃ i sáº£n', 'assets']);
  const opCashFlow = getFirstNumericByHints(cashFlowFields, ['operating cash', 'lÆ°u chuyá»ƒn tiá»n', 'cash flow']);
  const evidenceCount = countNumericEvidence([revenue, netIncome, totalAssets, opCashFlow]);
  const warnings = normalizeWarnings(payload.warnings);

  const facts = [
    `Fundamentals ${symbol}: period=${payload.period ?? 'latest'}, confidence=${payload.confidence ?? 'n/a'}, coverage_ratio=${formatMaybePercent(toNumber(payload.coverage?.coverageRatio))}, revenue=${formatMaybeNumber(revenue)}, net_income=${formatMaybeNumber(netIncome)}, total_assets=${formatMaybeNumber(totalAssets)}, operating_cash_flow=${formatMaybeNumber(opCashFlow)}.`,
  ];
  if (warnings.length > 0) {
    facts.push(`Fundamentals warnings ${symbol}: ${warnings.join(" | ")}`);
  }

  const messageBlocks: AssistantMessageBlock[] = [];
  if (warnings.length > 0) {
    messageBlocks.push({
      type: "text",
      title: `Fundamentals Data Notice (${symbol})`,
      content: warnings.join("\n"),
    });
  }

  return {
    facts,
    citations: [buildCitation(`fundamental-${symbol}`, `Fundamentals snapshot for ${symbol}`, endpoint, symbol, payload.period)],
    messageBlocks,
    evidenceCount,
    warningCount: warnings.length,
  };
}

async function fetchRiskSnapshot(baseUrl: string, symbol: string): Promise<ToolRunOutput> {
  const endpoint = `/api/risk?symbol=${encodeURIComponent(symbol)}&benchmark=VNINDEX`;
  const payload = await fetchJson<{
    metrics?: {
      volatility?: number;
      beta?: number;
      var95?: number;
      maxDrawdown?: number;
    };
  }>(baseUrl, endpoint);
  const metrics = payload.metrics ?? {};

  const facts = [
    `Risk snapshot ${symbol}: volatility=${formatMaybePercent(toNumber(metrics.volatility))}, beta=${formatMaybeNumber(toNumber(metrics.beta))}, var95=${formatMaybePercent(toNumber(metrics.var95))}, max_drawdown=${formatMaybePercent(toNumber(metrics.maxDrawdown))}.`,
  ];

  return {
    facts,
    citations: [buildCitation(`risk-${symbol}`, `Risk metrics for ${symbol}`, endpoint, symbol)],
    evidenceCount: countNumericEvidence([
      toNumber(metrics.volatility),
      toNumber(metrics.beta),
      toNumber(metrics.var95),
      toNumber(metrics.maxDrawdown),
    ]),
  };
}

async function fetchBacktestSummary(baseUrl: string, symbol: string): Promise<ToolRunOutput> {
  const endpoint = `/api/backtesting?symbol=${encodeURIComponent(symbol)}&strategy=sma_crossover&capital=100000`;
  const payload = await fetchJson<{
    metrics?: {
      netReturn?: number;
      sharpeRatio?: number;
      maxDrawdown?: number;
      totalTrades?: number;
    };
    configApplied?: { executionModel?: string };
  }>(baseUrl, endpoint);

  const metrics = payload.metrics ?? {};
  const facts = [
    `Backtest snapshot ${symbol} (sma_crossover): net_return=${formatMaybePercent(toNumber(metrics.netReturn))}, sharpe=${formatMaybeNumber(toNumber(metrics.sharpeRatio))}, max_drawdown=${formatMaybePercent(toNumber(metrics.maxDrawdown))}, total_trades=${formatMaybeNumber(toNumber(metrics.totalTrades))}, execution_model=${payload.configApplied?.executionModel ?? 'unknown'}.`,
  ];

  return {
    facts,
    citations: [buildCitation(`backtest-${symbol}`, `Backtest snapshot for ${symbol}`, endpoint, symbol)],
    evidenceCount: countNumericEvidence([
      toNumber(metrics.netReturn),
      toNumber(metrics.sharpeRatio),
      toNumber(metrics.maxDrawdown),
      toNumber(metrics.totalTrades),
    ]),
  };
}

async function fetchFactorSnapshot(baseUrl: string): Promise<ToolRunOutput> {
  const endpoint = '/api/factors?factor=momentum&limit=10';
  const payload = await fetchJson<{
    topStocks?: Array<{ symbol?: string }>;
    bottomStocks?: Array<{ symbol?: string }>;
  }>(baseUrl, endpoint);
  const top = (payload.topStocks ?? []).map((item) => item.symbol).filter(Boolean).slice(0, 5);
  const bottom = (payload.bottomStocks ?? []).map((item) => item.symbol).filter(Boolean).slice(0, 5);

  return {
    facts: [
      `Factor snapshot momentum: top_symbols=${top.join(', ') || 'n/a'}, bottom_symbols=${bottom.join(', ') || 'n/a'}.`,
    ],
    citations: [buildCitation('factor-momentum', 'Momentum factor ranking', endpoint)],
    evidenceCount: top.length + bottom.length,
  };
}

async function fetchMarketSnapshot(baseUrl: string): Promise<ToolRunOutput> {
  const endpoint = '/api/market-overview';
  const payload = await fetchJson<{
    benchmark?: string;
    currentIndex?: number;
    mtdReturn?: number;
    topGainers?: Array<{ symbol?: string; change?: number }>;
    topLosers?: Array<{ symbol?: string; change?: number }>;
  }>(baseUrl, endpoint);
  const topGainer = payload.topGainers?.[0];
  const topLoser = payload.topLosers?.[0];

  return {
    facts: [
      `Market snapshot: benchmark=${payload.benchmark ?? 'VNINDEX'}, current_index=${formatMaybeNumber(toNumber(payload.currentIndex))}, mtd_return=${formatMaybePercent(toNumber(payload.mtdReturn))}, top_gainer=${topGainer?.symbol ?? 'n/a'} (${formatMaybePercent(toNumber(topGainer?.change))}), top_loser=${topLoser?.symbol ?? 'n/a'} (${formatMaybePercent(toNumber(topLoser?.change))}).`,
    ],
    citations: [buildCitation('market-overview', 'Market overview snapshot', endpoint)],
    evidenceCount: countNumericEvidence([
      toNumber(payload.currentIndex),
      toNumber(payload.mtdReturn),
      toNumber(topGainer?.change),
      toNumber(topLoser?.change),
    ]),
  };
}

async function fetchFinanceAnalysis(
  baseUrl: string,
  symbol: string,
  analysisType: FinanceAnalysisType
): Promise<ToolRunOutput> {
  const endpoint = `/api/finance-analysis?symbol=${encodeURIComponent(symbol)}&type=${encodeURIComponent(analysisType)}`;
  const payload = await fetchJson<{
    data?: unknown;
    citations?: AssistantCitation[];
    warnings?: string[];
    confidence?: "high" | "medium" | "low";
    coverage?: {
      coverageRatio?: number;
      selectedPeriods?: string[];
      missingStatements?: Array<{ period?: string; statement?: string }>;
    };
  }>(baseUrl, endpoint);

  const citations = normalizeCitations(payload.citations, symbol, analysisType, endpoint);
  const data = payload.data as Record<string, unknown> | undefined;
  const warnings = normalizeWarnings(payload.warnings);
  const coverageRatio = toNumber(payload.coverage?.coverageRatio);
  const selectedPeriodCount = Array.isArray(payload.coverage?.selectedPeriods)
    ? payload.coverage?.selectedPeriods.length
    : null;
  const messageBlocks: AssistantMessageBlock[] = [];
  if (warnings.length > 0) {
    messageBlocks.push({
      type: "text",
      title: `Finance Data Notice (${symbol})`,
      content: warnings.join("\n"),
    });
  }

  if (!data) {
    return {
      facts: [
        `Finance ${analysisType} analysis for ${symbol} returned no data. confidence=${payload.confidence ?? "n/a"}, coverage_ratio=${formatMaybePercent(coverageRatio)}.`,
      ],
      citations,
      messageBlocks,
      evidenceCount: 0,
      warningCount: warnings.length + 1,
    };
  }

  if (analysisType === 'fundamental') {
    const analysisMode = String(data.analysisMode ?? "generic");
    if (analysisMode === "banking_degraded") {
      const bankSummary = isRecord(data.bankSummary) ? data.bankSummary : {};
      const netInterestIncome = pickLatestFromPointSeries(bankSummary, "netInterestIncome");
      const totalOperatingRevenue = pickLatestFromPointSeries(bankSummary, "totalOperatingRevenue");
      const provisionForCreditLosses = pickLatestFromPointSeries(bankSummary, "provisionForCreditLosses");
      const profitBeforeTax = pickLatestFromPointSeries(bankSummary, "profitBeforeTax");
      const totalAssets = pickLatestFromPointSeries(bankSummary, "totalAssets");
      const loansToCustomers = pickLatestFromPointSeries(bankSummary, "loansToCustomers");
      const depositsFromCustomers = pickLatestFromPointSeries(bankSummary, "depositsFromCustomers");
      const evidenceCount = countNumericEvidence([
        netInterestIncome,
        totalOperatingRevenue,
        provisionForCreditLosses,
        profitBeforeTax,
        totalAssets,
        loansToCustomers,
        depositsFromCustomers,
      ]);

      return {
        facts: [
          `Fundamental analysis ${symbol} (banking baseline): confidence=${payload.confidence ?? 'n/a'}, coverage_ratio=${formatMaybePercent(coverageRatio)}, periods=${selectedPeriodCount ?? 'n/a'}, net_interest_income=${formatMaybeNumber(netInterestIncome)}, provision_credit_losses=${formatMaybeNumber(provisionForCreditLosses)}, profit_before_tax=${formatMaybeNumber(profitBeforeTax)}, total_assets=${formatMaybeNumber(totalAssets)}, loans_to_customers=${formatMaybeNumber(loansToCustomers)}, deposits_from_customers=${formatMaybeNumber(depositsFromCustomers)}.`,
        ],
        citations,
        messageBlocks: [
          ...messageBlocks,
          {
            type: "table",
            title: `Banking Snapshot (${symbol})`,
            columns: ["Metric", "Latest"],
            rows: [
              ["Net Interest Income", netInterestIncome],
              ["Total Operating Revenue", totalOperatingRevenue],
              ["Provision for Credit Losses", provisionForCreditLosses],
              ["Profit Before Tax", profitBeforeTax],
              ["Total Assets", totalAssets],
              ["Loans to Customers", loansToCustomers],
              ["Deposits from Customers", depositsFromCustomers],
            ],
            note: "Generic corporate ratios suppressed for banking-like statements.",
          },
        ],
        evidenceCount,
        warningCount: warnings.length,
      };
    }

    const currentRatio = pickLatestFromRatioCollection(data, 'liquidity', 'currentRatio');
    const debtToEquity = pickLatestFromRatioCollection(data, 'leverage', 'debtToEquity');
    const netMargin = pickLatestFromRatioCollection(data, 'profitability', 'netMargin');
    const ocfToNetIncome = pickLatestFromRatioCollection(data, 'cashFlowQuality', 'ocfToNetIncome');
    const evidenceCount = countNumericEvidence([currentRatio, debtToEquity, netMargin, ocfToNetIncome]);
    const tableBlock: AssistantMessageBlock = {
      type: 'table',
      title: `Fundamental Snapshot (${symbol})`,
      columns: ['Metric', 'Latest'],
      rows: [
        ['Current Ratio', currentRatio],
        ['Debt to Equity', debtToEquity],
        ['Net Margin', netMargin],
        ['OCF / Net Income', ocfToNetIncome],
      ],
      note: 'Derived from local financial statements.',
    };
    return {
      facts: [
        `Fundamental analysis ${symbol}: confidence=${payload.confidence ?? 'n/a'}, coverage_ratio=${formatMaybePercent(coverageRatio)}, periods=${selectedPeriodCount ?? 'n/a'}, current_ratio=${formatMaybeNumber(currentRatio)}, debt_to_equity=${formatMaybeNumber(debtToEquity)}, net_margin=${formatMaybePercent(netMargin)}, ocf_to_net_income=${formatMaybeNumber(ocfToNetIncome)}.`,
      ],
      citations,
      messageBlocks: [...messageBlocks, tableBlock],
      evidenceCount,
      warningCount: warnings.length,
    };
  }

  if (analysisType === 'health') {
    const score = toNumber(data.score);
    const evidenceCount = countNumericEvidence([score]);
    const tableBlock: AssistantMessageBlock = {
      type: 'table',
      title: `Financial Health Score (${symbol})`,
      columns: ['Field', 'Value'],
      rows: [
        ['Score', score],
        ['Rating', String(data.rating ?? 'n/a')],
      ],
    };
    return {
      facts: [
        `Financial health ${symbol}: confidence=${payload.confidence ?? 'n/a'}, coverage_ratio=${formatMaybePercent(coverageRatio)}, score=${formatMaybeNumber(score)}, rating=${String(data.rating ?? 'n/a')}.`,
      ],
      citations,
      messageBlocks: [...messageBlocks, tableBlock],
      evidenceCount,
      warningCount: warnings.length,
    };
  }

  if (analysisType === 'valuation') {
    const assumptions = isRecord(data.assumptions) ? data.assumptions : undefined;
    const fairValue = toNumber(data.fairValuePerShare);
    const currentPrice = toNumber(data.currentPrice);
    const upsideDownside = toNumber(data.upsideDownsidePct);
    const wacc = toNumber(assumptions?.wacc);
    const tableBlock: AssistantMessageBlock = {
      type: 'table',
      title: `DCF Summary (${symbol})`,
      columns: ['Field', 'Value'],
      rows: [
        ['Fair Value/Share', fairValue],
        ['Current Price', currentPrice],
        ['Upside/Downside', upsideDownside],
        ['WACC', wacc],
        ['Terminal Growth', toNumber(assumptions?.terminalGrowth)],
      ],
    };
    return {
      facts: [
        `DCF valuation ${symbol}: confidence=${payload.confidence ?? 'n/a'}, coverage_ratio=${formatMaybePercent(coverageRatio)}, fair_value_per_share=${formatMaybeNumber(fairValue)}, current_price=${formatMaybeNumber(currentPrice)}, upside_downside=${formatMaybePercent(upsideDownside)}, wacc=${formatMaybePercent(wacc)}.`,
      ],
      citations,
      messageBlocks: [...messageBlocks, tableBlock],
      evidenceCount: countNumericEvidence([fairValue, currentPrice, upsideDownside, wacc]),
      warningCount: warnings.length,
    };
  }

  if (analysisType === 'peer') {
    const peers = Array.isArray(data.peers) ? data.peers : [];
    const rows = peers.slice(0, 6).map((peer) => {
      const row = isRecord(peer) ? peer : {};
      return [
        String(row.symbol ?? 'n/a'),
        toNumber(row.pe),
        toNumber(row.pb),
        toNumber(row.price),
      ] as Array<string | number | null>;
    });
    return {
      facts: [
        `Peer multiples ${symbol}: confidence=${payload.confidence ?? 'n/a'}, coverage_ratio=${formatMaybePercent(coverageRatio)}, median_pe=${formatMaybeNumber(toNumber(data.medianPe))}, median_pb=${formatMaybeNumber(toNumber(data.medianPb))}, peer_count=${rows.length}.`,
      ],
      citations,
      messageBlocks: [
        ...messageBlocks,
        {
          type: 'table',
          title: `Peer Multiples (${symbol})`,
          columns: ['Symbol', 'P/E', 'P/B', 'Price'],
          rows,
          note: 'Peers are selected from local metadata industry grouping.',
        },
      ],
      evidenceCount: countNumericEvidence([toNumber(data.medianPe), toNumber(data.medianPb)]) + rows.length,
      warningCount: warnings.length,
    };
  }

  const cells = Array.isArray(data.cells) ? data.cells : [];
  const sensitivityRows = cells.slice(0, 10).map((cell) => {
    const row = isRecord(cell) ? cell : {};
    return [
      toNumber(row.wacc),
      toNumber(row.terminalGrowth),
      toNumber(row.fairValuePerShare),
    ] as Array<string | number | null>;
  });
  return {
    facts: [
      `Sensitivity ${symbol}: confidence=${payload.confidence ?? 'n/a'}, coverage_ratio=${formatMaybePercent(coverageRatio)}, base_fair_value=${formatMaybeNumber(toNumber(data.baseFairValuePerShare))}, grid_cells=${cells.length}.`,
    ],
    citations,
    messageBlocks: [
      ...messageBlocks,
      {
        type: 'table',
        title: `Sensitivity Grid (${symbol})`,
        columns: ['WACC', 'Terminal Growth', 'Fair Value/Share'],
        rows: sensitivityRows,
      },
    ],
    evidenceCount: countNumericEvidence([toNumber(data.baseFairValuePerShare)]) + (cells.length > 0 ? 1 : 0),
    warningCount: warnings.length,
  };
}

function pickLatestFromRatioCollection(
  data: Record<string, unknown>,
  section: string,
  key: string
): number | null {
  const sec = data[section];
  if (!isRecord(sec)) return null;
  const collection = sec[key];
  if (!Array.isArray(collection)) return null;

  for (let i = collection.length - 1; i >= 0; i -= 1) {
    const item = collection[i];
    if (!isRecord(item)) continue;
    const value = toNumber(item.value);
    if (value !== null) return value;
  }
  return null;
}

function normalizeCitations(
  citations: AssistantCitation[] | undefined,
  symbol: string,
  type: FinanceAnalysisType,
  endpoint: string
): AssistantCitation[] {
  if (!Array.isArray(citations) || citations.length === 0) {
    return [buildCitation(`finance-${type}-${symbol}`, `Finance ${type} analysis for ${symbol}`, endpoint, symbol)];
  }

  return citations.map((citation, index) => ({
    id: citation.id || `finance-${type}-${symbol}-${index}`,
    sourceType: citation.sourceType || 'dataset',
    title: citation.title || `Finance ${type} analysis for ${symbol}`,
    endpoint: citation.endpoint || endpoint,
    symbol: citation.symbol || symbol,
    period: citation.period,
    timestamp: citation.timestamp || new Date().toISOString(),
    confidence: citation.confidence ?? 0.95,
    note: citation.note,
  }));
}

async function fetchJson<T>(baseUrl: string, endpoint: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TOOL_TIMEOUT_MS);
  try {
    const response = await fetch(`${trimTrailingSlash(baseUrl)}${endpoint}`, {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      const message = await response.text();
      throw {
        status: response.status,
        message: message || 'Tool API failed',
      } satisfies HttpErrorShape;
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw { message: 'Tool request timed out' } satisfies HttpErrorShape;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeHttpError(error: unknown): HttpErrorShape {
  if (isHttpErrorShape(error)) return error;
  if (error instanceof Error) return { message: error.message };
  return { message: String(error) };
}

function isHttpErrorShape(value: unknown): value is HttpErrorShape {
  if (!value || typeof value !== 'object') return false;
  const maybe = value as { message?: unknown; status?: unknown };
  return typeof maybe.message === 'string' && (maybe.status === undefined || typeof maybe.status === 'number');
}

function buildCitation(
  id: string,
  title: string,
  endpoint: string,
  symbol?: string,
  period?: string
): AssistantCitation {
  return {
    id,
    sourceType: 'api',
    title,
    endpoint,
    symbol,
    period,
    timestamp: new Date().toISOString(),
    confidence: 0.95,
  };
}

function extractStatementFields(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  const record = value as Record<string, unknown>;
  const fields = record.fields;
  if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
    return fields as Record<string, unknown>;
  }
  return record;
}

function getFirstNumericByHints(fields: Record<string, unknown>, hints: string[]): number | null {
  const entries = Object.entries(fields);
  for (const [key, value] of entries) {
    const normalizedKey = key.toLowerCase();
    if (!hints.some((hint) => normalizedKey.includes(hint))) continue;
    const numeric = toNumber(value);
    if (numeric !== null) return numeric;
  }
  return null;
}

function pickLatestFromPointSeries(
  data: Record<string, unknown>,
  key: string
): number | null {
  const collection = data[key];
  if (!Array.isArray(collection)) return null;

  for (let i = collection.length - 1; i >= 0; i -= 1) {
    const item = collection[i];
    if (!isRecord(item)) continue;
    const value = toNumber(item.value);
    if (value !== null) return value;
  }
  return null;
}

function normalizeWarnings(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function countNumericEvidence(values: Array<number | null>): number {
  let count = 0;
  for (const value of values) {
    if (value !== null && Number.isFinite(value)) count += 1;
  }
  return count;
}

function dedupeCitations(citations: AssistantCitation[]): AssistantCitation[] {
  const seen = new Set<string>();
  const unique: AssistantCitation[] = [];
  for (const citation of citations) {
    const key = `${citation.id}|${citation.endpoint ?? ''}|${citation.symbol ?? ''}|${citation.period ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(citation);
  }
  return unique;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatMaybeNumber(value: number | null): string {
  if (value === null) return 'n/a';
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function formatMaybePercent(value: number | null): string {
  if (value === null) return 'n/a';
  return `${(value * (Math.abs(value) <= 1 ? 100 : 1)).toFixed(2)}%`;
}

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveToolTimeoutMs(): number {
  const fallback = 12_000;
  const raw = String(process.env.ASSISTANT_TOOL_TIMEOUT_MS ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(3_000, Math.min(parsed, 30_000));
}
