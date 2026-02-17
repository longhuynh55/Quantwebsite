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
  requestParams?: Record<string, string | number | boolean | null>;
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
        requestParams: output.requestParams,
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
  const needsIcbSnapshot = requiredToolSet.has("icbSnapshot");
  const needsValuationRanking = requiredToolSet.has("valuationRanking");
  const needsSymbolScopedSignals = needsFundamentals
    || needsHealthScore
    || needsValuation
    || needsPeer
    || needsRisk
    || needsBacktest
    || requiredToolSet.has("stockSnapshot");
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
    if (name === "dataHealth") {
      addTask(name, () => fetchDataHealth(baseUrl));
      return;
    }
    if (name === "stockSnapshot") {
      if (!primarySymbol) return;
      addTask(name, () => fetchStockSnapshot(baseUrl, primarySymbol, contextSnapshot?.timeframe, message, contextSnapshot));
      return;
    }
    if (name === "fundamentalSnapshot") {
      if (!primarySymbol) return;
      addTask(name, () => fetchFundamentalSnapshot(baseUrl, primarySymbol, message, contextSnapshot));
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
      return;
    }
    if (name === "icbSnapshot") {
      addTask(name, () => fetchIcbSnapshot(baseUrl, message, contextSnapshot));
      return;
    }
    if (name === "valuationRanking") {
      if (BASELINE_ONLY_MODE) return;
      addTask(name, () => fetchValuationRanking(baseUrl, message, contextSnapshot));
    }
  };

  const shouldPrefetchStockSnapshot = Boolean(
    primarySymbol
    && (
      needsSymbolScopedSignals
      || (requiredSignals.length === 0 && !needsIcbSnapshot && !needsValuationRanking)
      || contextSnapshot?.page === "charts"
      || contextSnapshot?.page === "risk"
      || contextSnapshot?.page === "backtesting"
    )
  );

  if (shouldPrefetchStockSnapshot) {
    addTaskByName("stockSnapshot");
  }

  const requiredPriority: AssistantToolName[] = [
    "dataHealth",
    "fundamentalSnapshot",
    "valuationRanking",
    "icbSnapshot",
    "valuationDcf",
    "peerMultiples",
    "financialHealthScore",
    "scenarioSensitivity",
    "riskSnapshot",
    "backtestSummary",
    "factorSnapshot",
    "marketSnapshot",
    "stockSnapshot",
    "fundamentalAnalysis",
  ];
  const requiredPrioritySet = new Set(requiredPriority);
  for (const toolName of requiredPriority) {
    if (requiredToolSet.has(toolName)) {
      addTaskByName(toolName);
    }
  }
  for (const signal of requiredSignals) {
    if (!requiredPrioritySet.has(signal.tool)) {
      addTaskByName(signal.tool);
    }
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
  if (needsIcbSnapshot) {
    addTaskByName("icbSnapshot");
  }
  if (needsValuationRanking) {
    addTaskByName("valuationRanking");
  }

  return tasks;
}

async function fetchDataHealth(baseUrl: string): Promise<ToolRunOutput> {
  const endpoint = "/api/health/data?probe=true&includeFundamentals=true";
  const payload = await fetchJson<{
    ok?: boolean;
    backend?: { ok?: boolean; requested?: string; active?: string; reason?: string; dataDir?: string; duckdbPath?: string };
    dataDir?: { path?: string; source?: string };
    manifest?: { available?: boolean; schemaVersion?: number; generatedAt?: string | null };
    checks?: Array<{ name?: string; ok?: boolean; detail?: string | null }>;
  }>(baseUrl, endpoint);

  const checks = Array.isArray(payload.checks) ? payload.checks : [];
  const failing = checks.filter((check) => check && check.ok === false);
  const manifestAvailable = payload.manifest?.available === true;

  const facts: string[] = [
    `Data readiness probe: ok=${payload.ok === true ? "true" : "false"}, backend=${String(payload.backend?.active ?? "n/a")} (requested=${String(payload.backend?.requested ?? "n/a")}, reason=${String(payload.backend?.reason ?? "n/a")}), data_dir=${String(payload.dataDir?.path ?? "n/a")} (source=${String(payload.dataDir?.source ?? "n/a")}), manifest_available=${manifestAvailable ? "true" : "false"}, checks_total=${checks.length}, checks_failed=${failing.length}.`,
  ];
  if (failing.length > 0) {
    const summary = failing
      .slice(0, 6)
      .map((item) => `${String(item.name ?? "check")}: ${String(item.detail ?? "failed")}`)
      .join(" | ");
    facts.push(`Data readiness failures: ${summary}.`);
  }

  const messageBlocks: AssistantMessageBlock[] = [];
  if (checks.length > 0) {
    messageBlocks.push({
      type: "table",
      title: "Data Readiness Probe",
      columns: ["Check", "OK", "Detail"],
      rows: checks.slice(0, 12).map((check) => [
        String(check?.name ?? "n/a"),
        check?.ok === true ? "true" : "false",
        String(check?.detail ?? ""),
      ]),
    });
  }

  return {
    facts,
    citations: [buildCitation("data-health", "Data readiness probe", endpoint)],
    messageBlocks,
    evidenceCount: checks.length,
    warningCount: failing.length,
    requestParams: {
      probe: true,
      includeFundamentals: true,
    },
  };
}

async function fetchStockSnapshot(
  baseUrl: string,
  symbol: string,
  timeframe?: string,
  message?: string,
  contextSnapshot?: AssistantContextSnapshot
): Promise<ToolRunOutput> {
  const limit = timeframe && /^\d+$/.test(timeframe) ? timeframe : '60';
  const requestedDate = extractRequestedDate(message ?? "", contextSnapshot);
  const endpoint = requestedDate
    ? `/api/stocks?symbol=${encodeURIComponent(symbol)}&date=${encodeURIComponent(requestedDate)}&limit=1`
    : `/api/stocks?symbol=${encodeURIComponent(symbol)}&limit=${encodeURIComponent(limit)}`;
  const payload = await fetchJson<{
    data?: Array<{ date?: string; close?: number; volume?: number }>;
    requestedDate?: string;
    asOfDate?: string;
    exactDateMatch?: boolean;
  }>(baseUrl, endpoint);
  const series = Array.isArray(payload.data) ? payload.data : [];
  if (series.length === 0) {
    return {
      facts: [`No OHLCV rows were returned for ${symbol}.`],
      citations: [buildCitation(`stock-${symbol}`, `OHLCV snapshot for ${symbol}`, endpoint, symbol)],
      evidenceCount: 0,
      warningCount: 1,
      requestParams: {
        symbol,
        timeframe: limit,
        requestedDate,
      },
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
    `Stock snapshot ${symbol}: latest_close=${formatMaybeNumber(latestClose)}, day_change_pct=${formatMaybePercent(dayChangePct)}, latest_volume=${formatMaybeNumber(latestVolume)}, latest_date=${String(latest.date ?? 'unknown')}${requestedDate ? `, requested_date=${payload.requestedDate ?? requestedDate}, as_of_date=${payload.asOfDate ?? String(latest.date ?? "unknown")}, exact_date_match=${payload.exactDateMatch === true ? "true" : "false"}` : ""}.`,
  ];

  return {
    facts,
    citations: [buildCitation(`stock-${symbol}`, `OHLCV snapshot for ${symbol}`, endpoint, symbol)],
    evidenceCount: countNumericEvidence([latestClose, dayChangePct, latestVolume]),
    requestParams: {
      symbol,
      timeframe: limit,
      requestedDate,
    },
  };
}

async function fetchFundamentalSnapshot(
  baseUrl: string,
  symbol: string,
  message: string,
  contextSnapshot?: AssistantContextSnapshot
): Promise<ToolRunOutput> {
  const statement = extractFundamentalStatement(message, contextSnapshot);
  const endpoint = `/api/fundamentals?symbol=${encodeURIComponent(symbol)}&period=latest&statement=${encodeURIComponent(statement)}`;
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
  }>(baseUrl, endpoint, Math.max(TOOL_TIMEOUT_MS, 45_000));

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
    `Fundamentals ${symbol}: statement=${statement}, period=${payload.period ?? 'latest'}, confidence=${payload.confidence ?? 'n/a'}, coverage_ratio=${formatMaybePercent(toNumber(payload.coverage?.coverageRatio))}, revenue=${formatMaybeNumber(revenue)}, net_income=${formatMaybeNumber(netIncome)}, total_assets=${formatMaybeNumber(totalAssets)}, operating_cash_flow=${formatMaybeNumber(opCashFlow)}.`,
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
    requestParams: {
      symbol,
      statement,
      period: payload.period ?? "latest",
    },
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

async function fetchIcbSnapshot(
  baseUrl: string,
  message: string,
  contextSnapshot?: AssistantContextSnapshot
): Promise<ToolRunOutput> {
  const requestedDate = extractRequestedDate(message, contextSnapshot);
  const icbLevel = extractIcbLevel(message, contextSnapshot);
  const limit = extractTopLimit(message, contextSnapshot, 12);
  const icbFilter = extractIcbFilter(message, contextSnapshot);
  const params = new URLSearchParams();
  if (requestedDate) params.set("date", requestedDate);
  if (icbLevel) params.set("icbLevel", icbLevel);
  if (limit !== null) params.set("limit", String(limit));
  if (icbFilter) params.set("icb", icbFilter);

  const endpoint = `/api/analytics/icb-snapshot${params.size > 0 ? `?${params.toString()}` : ""}`;
  const payload = await fetchJson<{
    asOfDate?: string;
    requestedDate?: string;
    exchange?: string;
    icbLevel?: string;
    groups?: Array<{
      rank?: number;
      icbCode?: string | null;
      icbName?: string;
      symbolCount?: number;
      pricedSymbolCount?: number;
      exactDateMatchCount?: number;
      avgClose?: number | null;
      avgDayChangePct?: number | null;
      totalVolume?: number;
      totalTradedValueApprox?: number | null;
      topSymbolsByValue?: string[];
    }>;
    totalSymbols?: number;
    pricedSymbols?: number;
    exactDateMatchCount?: number;
    warnings?: string[];
  }>(baseUrl, endpoint);

  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  const warnings = normalizeWarnings(payload.warnings);
  const topGroup = groups[0];
  const topSymbols =
    topGroup && Array.isArray(topGroup.topSymbolsByValue)
      ? topGroup.topSymbolsByValue.slice(0, 5).join(", ")
      : "n/a";

  const facts: string[] = [
    `ICB snapshot: exchange=${payload.exchange ?? "HOSE"}, icb_level=${payload.icbLevel ?? icbLevel ?? "3"}, as_of_date=${payload.asOfDate ?? "n/a"}, requested_date=${payload.requestedDate ?? requestedDate ?? "latest"}, total_symbols=${formatMaybeNumber(toNumber(payload.totalSymbols))}, priced_symbols=${formatMaybeNumber(toNumber(payload.pricedSymbols))}, group_count=${groups.length}.`,
  ];
  if (topGroup) {
    facts.push(
      `Top ICB group: name=${String(topGroup.icbName ?? "n/a")}, symbol_count=${formatMaybeNumber(toNumber(topGroup.symbolCount))}, avg_day_change=${formatMaybePercent(toNumber(topGroup.avgDayChangePct))}, top_symbols_by_value=${topSymbols}.`
    );
  }
  const rankedGroupSummary = groups
    .slice(0, 5)
    .map((group) => {
      const rank = formatMaybeNumber(toNumber(group.rank));
      const groupName = String(group.icbName ?? "n/a");
      const tradedValue = formatMaybeNumber(toNumber(group.totalTradedValueApprox));
      const valueSymbols = Array.isArray(group.topSymbolsByValue) ? group.topSymbolsByValue.slice(0, 3).join("/") : "n/a";
      return `#${rank} ${groupName} traded_value=${tradedValue} top_symbols=${valueSymbols}`;
    })
    .join("; ");
  if (rankedGroupSummary) {
    facts.push(`ICB top groups by traded value: ${rankedGroupSummary}.`);
  }
  if (warnings.length > 0) {
    facts.push(`ICB warnings: ${warnings.join(" | ")}`);
  }

  const rows = groups.slice(0, 10).map((group) => [
    toNumber(group.rank),
    String(group.icbName ?? "n/a"),
    toNumber(group.symbolCount),
    toNumber(group.pricedSymbolCount),
    toNumber(group.exactDateMatchCount),
    toNumber(group.avgDayChangePct),
    toNumber(group.totalTradedValueApprox),
  ] as Array<string | number | null>);

  const messageBlocks: AssistantMessageBlock[] = [];
  if (rows.length > 0) {
    messageBlocks.push({
      type: "table",
      title: "ICB Snapshot (HOSE)",
      columns: [
        "Rank",
        "ICB Group",
        "Symbols",
        "Priced",
        "Exact Date",
        "Avg Day Change",
        "Total Traded Value (Approx)",
      ],
      rows,
    });
  }
  if (warnings.length > 0) {
    messageBlocks.push({
      type: "text",
      title: "ICB Data Notice",
      content: warnings.join("\n"),
    });
  }

  return {
    facts,
    citations: [buildCitation("icb-snapshot", "HOSE ICB snapshot", endpoint)],
    messageBlocks,
    evidenceCount: rows.length,
    warningCount: warnings.length,
    requestParams: {
      requestedDate,
      icbLevel,
      icbFilter,
      limit,
    },
  };
}

async function fetchValuationRanking(
  baseUrl: string,
  message: string,
  contextSnapshot?: AssistantContextSnapshot
): Promise<ToolRunOutput> {
  const requestedDate = extractRequestedDate(message, contextSnapshot);
  const icbLevel = extractIcbLevel(message, contextSnapshot);
  const icbFilter = extractIcbFilter(message, contextSnapshot);
  const limit = extractTopLimit(message, contextSnapshot, 10);
  const metric = extractValuationMetric(message, contextSnapshot);
  const order = extractRankingOrder(message, contextSnapshot);
  const params = new URLSearchParams();
  if (requestedDate) params.set("date", requestedDate);
  if (icbLevel) params.set("icbLevel", icbLevel);
  if (icbFilter) params.set("icb", icbFilter);
  if (limit !== null) params.set("limit", String(limit));
  params.set("metric", metric);
  params.set("order", order);

  const endpoint = `/api/analytics/valuation-rankings?${params.toString()}`;
  const payload = await fetchJson<{
    asOfDate?: string;
    requestedDate?: string;
    metric?: string;
    order?: string;
    rows?: Array<{
      rank?: number;
      symbol?: string;
      metricValue?: number;
      pe?: number | null;
      pb?: number | null;
      evEbitda?: number | null;
      price?: number;
      priceDate?: string;
      exactDateMatch?: boolean;
      fundamentalPeriod?: string | null;
    }>;
    eligibleRanked?: number;
    warnings?: string[];
  }>(baseUrl, endpoint);

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const warnings = normalizeWarnings(payload.warnings);
  const top = rows[0];

  const facts: string[] = [
    `Valuation ranking: metric=${payload.metric ?? metric}, order=${payload.order ?? order}, as_of_date=${payload.asOfDate ?? "n/a"}, requested_date=${payload.requestedDate ?? requestedDate ?? "latest"}, eligible_ranked=${formatMaybeNumber(toNumber(payload.eligibleRanked))}, returned_rows=${rows.length}.`,
  ];
  if (top) {
    facts.push(
      `Top valuation candidate: symbol=${String(top.symbol ?? "n/a")}, metric_value=${formatMaybeNumber(toNumber(top.metricValue))}, pe=${formatMaybeNumber(toNumber(top.pe))}, pb=${formatMaybeNumber(toNumber(top.pb))}, ev_ebitda=${formatMaybeNumber(toNumber(top.evEbitda))}, price_date=${String(top.priceDate ?? "n/a")}.`
    );
  }
  const rankedRowSummary = rows
    .slice(0, 5)
    .map((row) => {
      const rank = formatMaybeNumber(toNumber(row.rank));
      const symbol = String(row.symbol ?? "n/a");
      const metricValue = formatMaybeNumber(toNumber(row.metricValue));
      const priceDate = String(row.priceDate ?? "n/a");
      return `#${rank} ${symbol} metric=${metricValue} price_date=${priceDate}`;
    })
    .join("; ");
  if (rankedRowSummary) {
    facts.push(`Valuation ranked rows: ${rankedRowSummary}.`);
  }
  if (warnings.length > 0) {
    facts.push(`Valuation ranking warnings: ${warnings.join(" | ")}`);
  }

  const tableRows = rows.slice(0, 10).map((row) => [
    toNumber(row.rank),
    String(row.symbol ?? "n/a"),
    toNumber(row.metricValue),
    toNumber(row.pe),
    toNumber(row.pb),
    toNumber(row.evEbitda),
    toNumber(row.price),
    String(row.priceDate ?? "n/a"),
  ] as Array<string | number | null>);

  const messageBlocks: AssistantMessageBlock[] = [];
  if (tableRows.length > 0) {
    messageBlocks.push({
      type: "table",
      title: "Valuation Ranking (HOSE)",
      columns: ["Rank", "Symbol", "Metric", "P/E", "P/B", "EV/EBITDA", "Price", "Price Date"],
      rows: tableRows,
    });
  }
  if (warnings.length > 0) {
    messageBlocks.push({
      type: "text",
      title: "Valuation Data Notice",
      content: warnings.join("\n"),
    });
  }

  return {
    facts,
    citations: [buildCitation("valuation-ranking", "HOSE valuation ranking", endpoint)],
    messageBlocks,
    evidenceCount: tableRows.length,
    warningCount: warnings.length,
    requestParams: {
      requestedDate,
      icbLevel,
      icbFilter,
      metric,
      order,
      limit,
    },
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

async function fetchJson<T>(baseUrl: string, endpoint: string, timeoutMs: number = TOOL_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
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

function extractRequestedDate(message: string, contextSnapshot?: AssistantContextSnapshot): string | null {
  const filters = isRecord(contextSnapshot?.filters) ? contextSnapshot?.filters : undefined;
  const filterDate =
    normalizeDateLike(filters?.date)
    || normalizeDateLike(filters?.asOfDate)
    || normalizeDateLike(filters?.as_of_date)
    || normalizeDateLike(filters?.day);
  if (filterDate) return filterDate;

  const match = message.match(/\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})\b/);
  if (!match) return null;
  return normalizeDateLike(match[1]);
}

function extractIcbLevel(message: string, contextSnapshot?: AssistantContextSnapshot): string | null {
  const filters = isRecord(contextSnapshot?.filters) ? contextSnapshot?.filters : undefined;
  const rawFilter = String(filters?.icbLevel ?? filters?.icb_level ?? "").trim();
  if (rawFilter === "2" || rawFilter === "3" || rawFilter === "4") return rawFilter;

  const match = message.toLowerCase().match(/\bicb\s*([234])\b/);
  if (match) return match[1];
  return "3";
}

function extractIcbFilter(message: string, contextSnapshot?: AssistantContextSnapshot): string | null {
  const filters = isRecord(contextSnapshot?.filters) ? contextSnapshot?.filters : undefined;
  const value = String(filters?.icb ?? filters?.industry ?? filters?.sector ?? "").trim();
  if (value) return value.slice(0, 80);

  const normalized = normalizeForKeywordMatch(message);
  const sectorHints: Array<{ keywords: string[]; value: string }> = [
    { keywords: ["ngan hang", "bank"], value: "ngan hang" },
    { keywords: ["bat dong san", "real estate", "property"], value: "bat dong san" },
    { keywords: ["chung khoan", "securities"], value: "chung khoan" },
    { keywords: ["dau khi", "oil", "gas"], value: "dau khi" },
    { keywords: ["ban le", "retail"], value: "ban le" },
  ];
  for (const hint of sectorHints) {
    if (hint.keywords.some((keyword) => normalized.includes(keyword))) {
      return hint.value;
    }
  }

  return null;
}

function extractTopLimit(message: string, contextSnapshot: AssistantContextSnapshot | undefined, fallback: number): number | null {
  const filters = isRecord(contextSnapshot?.filters) ? contextSnapshot?.filters : undefined;
  const filterLimit = parsePositiveInt(filters?.limit, 1, 50);
  if (filterLimit !== null) return filterLimit;

  const topMatch = message.toLowerCase().match(/\btop\s*(\d{1,2})\b/);
  if (topMatch) {
    const parsed = Number.parseInt(topMatch[1], 10);
    if (Number.isFinite(parsed) && parsed > 0) return Math.min(50, parsed);
  }
  return fallback;
}

function extractFundamentalStatement(
  message: string,
  contextSnapshot?: AssistantContextSnapshot
): "all" | "bs" | "is" | "cf" {
  const filters = isRecord(contextSnapshot?.filters) ? contextSnapshot?.filters : undefined;
  const filterValue = normalizeForKeywordMatch(
    String(
      filters?.statement
      ?? filters?.statementType
      ?? filters?.reportType
      ?? filters?.baoCao
      ?? ""
    )
  );
  if (["all", "bctc"].includes(filterValue)) return "all";
  if (["bs", "bcdkt", "bang can doi ke toan", "can doi ke toan"].includes(filterValue)) return "bs";
  if (["is", "bctn", "kqkd", "bao cao ket qua kinh doanh", "income statement"].includes(filterValue)) return "is";
  if (["cf", "lctt", "bao cao luu chuyen tien te", "cash flow"].includes(filterValue)) return "cf";

  const normalized = normalizeForKeywordMatch(message);
  if (
    normalized.includes("bcdkt")
    || normalized.includes("bang can doi ke toan")
    || normalized.includes("can doi ke toan")
    || normalized.includes("balance sheet")
  ) {
    return "bs";
  }
  if (
    normalized.includes("bctn")
    || normalized.includes("kqkd")
    || normalized.includes("bao cao ket qua kinh doanh")
    || normalized.includes("income statement")
  ) {
    return "is";
  }
  if (
    normalized.includes("lctt")
    || normalized.includes("bao cao luu chuyen tien te")
    || normalized.includes("luu chuyen tien te")
    || normalized.includes("cash flow")
  ) {
    return "cf";
  }
  return "all";
}

function extractValuationMetric(message: string, contextSnapshot?: AssistantContextSnapshot): "pe" | "pb" | "ev_ebitda" {
  const filters = isRecord(contextSnapshot?.filters) ? contextSnapshot?.filters : undefined;
  const filterMetric = normalizeForKeywordMatch(String(filters?.metric ?? filters?.ratio ?? filters?.valuationMetric ?? ""));
  if (filterMetric.includes("ev/ebitda") || filterMetric.includes("ev_ebitda") || filterMetric.includes("ev ebitda")) {
    return "ev_ebitda";
  }
  if (filterMetric === "pb" || filterMetric === "p/b") return "pb";
  if (filterMetric === "pe" || filterMetric === "p/e") return "pe";

  const normalized = normalizeForKeywordMatch(message);
  if (normalized.includes("ev/ebitda") || normalized.includes("ev ebitda")) return "ev_ebitda";
  if (normalized.includes("p/b") || /\bpb\b/.test(normalized)) return "pb";
  return "pe";
}

function extractRankingOrder(message: string, contextSnapshot?: AssistantContextSnapshot): "asc" | "desc" {
  const filters = isRecord(contextSnapshot?.filters) ? contextSnapshot?.filters : undefined;
  const filterOrder = normalizeForKeywordMatch(String(filters?.order ?? filters?.sort ?? filters?.direction ?? ""));
  if (["asc", "ascending", "bottom", "lowest", "thap nhat"].some((key) => filterOrder.includes(key))) {
    return "asc";
  }
  if (["desc", "descending", "top", "highest", "cao nhat"].some((key) => filterOrder.includes(key))) {
    return "desc";
  }

  const normalized = normalizeForKeywordMatch(message);
  if (
    normalized.includes("thap nhat")
    || normalized.includes("lowest")
    || normalized.includes("smallest")
    || normalized.includes("bottom")
  ) {
    return "asc";
  }
  return "desc";
}

function normalizeDateLike(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(trimmed)) return trimmed.replace(/\//g, "-");
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(trimmed)) return trimmed.replace(/\//g, "-");
  return null;
}

function parsePositiveInt(value: unknown, min: number, max: number): number | null {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < min) return null;
  return Math.min(max, parsed);
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
  const fallback = 15_000;
  const raw = String(process.env.ASSISTANT_TOOL_TIMEOUT_MS ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(3_000, Math.min(parsed, 60_000));
}
