import type {
  AssistantCitation,
  AssistantContextSnapshot,
  AssistantMessageBlock,
  AssistantToolName,
  AssistantToolUsage,
} from '@/types/assistant';
import type { FinanceAnalysisType } from '@/lib/finance';
import {
  collectRequiredSignals,
  getCandidateSymbols,
  hasAnyKeyword,
  isStockUniverseRankingIntent,
  normalizeForKeywordMatch,
} from '@/lib/assistant/signals';
import type { AssistantQueryPlan } from '@/lib/assistant/planner';
import { loadStockMetadata } from '@/lib/data';
import { createLogger, hashText } from '@/lib/logger';

const TOOL_TIMEOUT_MS = resolveToolTimeoutMs();
const TOOL_FETCH_MAX_ATTEMPTS = resolveToolFetchMaxAttempts();
const TOOL_FETCH_RETRY_BACKOFF_MS = resolveToolFetchRetryBackoffMs();
const TOOL_MAX_CALLS_PER_TURN = resolveToolMaxCallsPerTurn();
const TOOL_TRANSIENT_FAILURE_CIRCUIT_THRESHOLD = resolveToolTransientFailureCircuitThreshold();
const MAX_TOOL_CONCURRENCY = 4;
const MAX_SYMBOL_TOOL_FANOUT = 2;
const MAX_FACTS = 12;
const MAX_MESSAGE_BLOCKS = 6;
const BASELINE_ONLY_MODE = String(process.env.ASSISTANT_BASELINE_ONLY ?? "false").trim().toLowerCase() === "true";
const QUERY_PLAN_STRICT_MODE = String(process.env.ASSISTANT_QUERY_PLAN_STRICT ?? "true").trim().toLowerCase() === "true";
const groundingToolsLogger = createLogger('assistant.tools');
let hoseSymbolUniversePromise: Promise<Set<string>> | null = null;

interface GroundingInput {
  baseUrl?: string;
  message: string;
  contextSnapshot?: AssistantContextSnapshot;
  queryPlan?: AssistantQueryPlan;
  requestId?: string;
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

interface SymbolGroundingScope {
  requestsUniverseStockRanking: boolean;
  requestedSymbols: string[];
  symbolTargets: string[];
  droppedSymbols: string[];
}

interface RequestedDateRange {
  from: string;
  to: string;
}

interface ToolExecutionBudget {
  tasks: ToolTask[];
  skippedTasks: ToolTask[];
  plannedCalls: number;
  maxCalls: number;
}

export async function runGroundingTools(input: GroundingInput): Promise<GroundingResult> {
  const startedAt = Date.now();
  const logger = groundingToolsLogger.child({ requestId: input.requestId ?? '' });
  const planSymbols = Array.isArray(input.queryPlan?.symbols)
    ? input.queryPlan.symbols
        .map((symbol) => String(symbol ?? "").trim().toUpperCase())
        .filter((symbol) => symbol.length > 0)
    : [];
  const symbols = planSymbols.length > 0
    ? planSymbols
    : getCandidateSymbols(input.message, input.contextSnapshot);
  const symbolScope = buildSymbolGroundingScope(input.message, symbols, input.contextSnapshot);
  const plannedTasks = buildToolTasks('', input.message, symbols, input.contextSnapshot, input.queryPlan);
  logger.debug('grounding.started', {
    hasToolBaseUrl: Boolean(input.baseUrl),
    plannedTaskCount: plannedTasks.length,
    plannedTools: plannedTasks.map((task) => task.name),
    maxToolCallsPerTurn: TOOL_MAX_CALLS_PER_TURN,
    transientFailureCircuitThreshold: TOOL_TRANSIENT_FAILURE_CIRCUIT_THRESHOLD,
    symbolCount: symbols.length,
    requestedSymbolCount: symbolScope.requestedSymbols.length,
    symbolTargetCount: symbolScope.symbolTargets.length,
    droppedSymbolCount: symbolScope.droppedSymbols.length,
    queryIntent: input.queryPlan?.intent ?? null,
  });
  if (!input.baseUrl) {
    logger.warn('grounding.base_url_missing', {
      plannedTaskCount: plannedTasks.length,
      durationMs: Date.now() - startedAt,
    });
    return {
      facts: ["Grounding is unavailable because ASSISTANT_TOOL_BASE_URL is not configured."],
      citations: [],
      usedTools:
        plannedTasks.length > 0
          ? plannedTasks.map((task) => ({
              name: task.name,
              status: 'error',
              latencyMs: 0,
              evidenceCount: 0,
              warningCount: 0,
              errorCode: "grounding_base_url_missing",
              error: 'Assistant grounding base URL is not configured.',
            }))
          : [{ name: 'marketSnapshot', status: 'skipped', latencyMs: 0, evidenceCount: 0, warningCount: 0 }],
      messageBlocks: [
        {
          type: "text",
          title: "Grounding Diagnostics",
          content: "Assistant grounding base URL is missing. Numeric claims are blocked until internal tool routing is configured.",
        },
        ...buildSymbolCoverageNotice({
          requestedSymbols: symbolScope.requestedSymbols,
          symbolTargets: symbolScope.symbolTargets,
          groundedSymbols: [],
          droppedSymbols: symbolScope.droppedSymbols,
          requestsUniverseStockRanking: symbolScope.requestsUniverseStockRanking,
        }),
      ],
    };
  }

  const tasks = buildToolTasks(input.baseUrl, input.message, symbols, input.contextSnapshot, input.queryPlan);
  const budget = applyToolExecutionBudget(tasks, TOOL_MAX_CALLS_PER_TURN);

  const facts: string[] = [];
  const citations: AssistantCitation[] = [];
  const usedTools: AssistantToolUsage[] = [];
  const messageBlocks: AssistantMessageBlock[] = [];
  const errorSummaries: string[] = [];
  const executed = await runTasksWithConcurrency(budget.tasks, MAX_TOOL_CONCURRENCY, {
    transientFailureCircuitThreshold: TOOL_TRANSIENT_FAILURE_CIRCUIT_THRESHOLD,
  });
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
      logger.info('tool.success', {
        tool: item.task.name,
        latencyMs: item.latencyMs,
        evidenceCount: output.evidenceCount ?? 0,
        warningCount: output.warningCount ?? 0,
        factsCount: output.facts.length,
        citationsCount: output.citations.length,
        messageBlocksCount: Array.isArray(output.messageBlocks) ? output.messageBlocks.length : 0,
        firstFactDigest: output.facts.length > 0 ? hashText(output.facts[0]) : null,
      });
      continue;
    }

    if (item.status === 'skipped') {
      const errorCode = item.skipReason === 'circuit_open' ? 'tool_circuit_open' : 'tool_skipped';
      usedTools.push({
        name: item.task.name,
        status: 'skipped',
        latencyMs: 0,
        evidenceCount: 0,
        warningCount: 0,
        errorCode,
        error: item.skipReason === 'circuit_open'
          ? 'Tool execution skipped because transient-failure circuit opened for this turn.'
          : 'Tool execution skipped by runtime policy.',
      });
      continue;
    }

    const normalizedError = normalizeHttpError(item.error);
    const errorMeta = extractToolErrorMetadata(item.error);
    const errorCode = deriveToolErrorCode(normalizedError);
    if (errorMeta.endpoint) {
      citations.push(
        buildCitation(
          `${item.task.name}-error-${citations.length + 1}`,
          errorMeta.title ?? `${item.task.name} error trace`,
          errorMeta.endpoint,
          errorMeta.symbol
        )
      );
    }
    errorSummaries.push(`${item.task.name}: ${normalizedError.status ? `HTTP ${normalizedError.status}` : normalizedError.message}`);
    usedTools.push({
      name: item.task.name,
      status: 'error',
      latencyMs: item.latencyMs,
      evidenceCount: 0,
      warningCount: 0,
      errorCode,
      error: normalizedError.status ? `HTTP ${normalizedError.status}: ${normalizedError.message}` : normalizedError.message,
    });
    logger.warn('tool.error', {
      tool: item.task.name,
      latencyMs: item.latencyMs,
      errorCode,
      status: normalizedError.status,
      message: normalizedError.message,
    });
  }

  if (budget.skippedTasks.length > 0) {
    for (const task of budget.skippedTasks) {
      usedTools.push({
        name: task.name,
        status: 'skipped',
        latencyMs: 0,
        evidenceCount: 0,
        warningCount: 0,
        errorCode: 'tool_budget_exceeded',
        error: `Tool execution skipped because per-turn tool budget is ${budget.maxCalls}.`,
      });
    }
    errorSummaries.push(
      `Tool budget enforced: planned_calls=${budget.plannedCalls}, executed_calls=${budget.tasks.length}, skipped_calls=${budget.skippedTasks.length}, max_calls_per_turn=${budget.maxCalls}.`
    );
    logger.warn('grounding.tool_budget_enforced', {
      plannedCalls: budget.plannedCalls,
      executedCalls: budget.tasks.length,
      skippedCalls: budget.skippedTasks.length,
      maxCallsPerTurn: budget.maxCalls,
    });
  }

  const skippedByCircuit = executed.filter((item) => item.status === 'skipped' && item.skipReason === 'circuit_open').length;
  const transientErrorCount = executed.filter((item) => item.status === 'error' && isTransientToolExecutionError(item.error)).length;
  if (skippedByCircuit > 0) {
    errorSummaries.push(
      `Transient-failure circuit opened: transient_failures=${transientErrorCount}, skipped_calls=${skippedByCircuit}, threshold=${TOOL_TRANSIENT_FAILURE_CIRCUIT_THRESHOLD}.`
    );
    logger.warn('grounding.transient_circuit_open', {
      transientErrorCount,
      skippedByCircuit,
      threshold: TOOL_TRANSIENT_FAILURE_CIRCUIT_THRESHOLD,
    });
  }

  if (tasks.length === 0) {
    usedTools.push({ name: 'marketSnapshot', status: 'skipped', latencyMs: 0, evidenceCount: 0, warningCount: 0 });
  }
  if (errorSummaries.length > 0) {
    messageBlocks.push({
      type: "text",
      title: "Grounding Diagnostics",
      content: errorSummaries.slice(0, 8).join("\n"),
    });
  }
  const groundedSymbols = collectGroundedSymbols(citations, symbolScope.symbolTargets);
  const symbolCoverageNotice = buildSymbolCoverageNotice({
    requestedSymbols: symbolScope.requestedSymbols,
    symbolTargets: symbolScope.symbolTargets,
    groundedSymbols,
    droppedSymbols: symbolScope.droppedSymbols,
    requestsUniverseStockRanking: symbolScope.requestsUniverseStockRanking,
  });
  if (symbolCoverageNotice.length > 0) {
    const firstNoticeText = symbolCoverageNotice.find((block) => block.type === "text")?.content;
    if (firstNoticeText) {
      facts.push(firstNoticeText);
    }
    messageBlocks.push(...symbolCoverageNotice);
  }
  const successTools = usedTools.filter((tool) => tool.status === 'success').length;
  const errorTools = usedTools.filter((tool) => tool.status === 'error').length;
  const skippedTools = usedTools.filter((tool) => tool.status === 'skipped').length;
  logger.info('grounding.completed', {
    taskCount: tasks.length,
    executedTaskCount: budget.tasks.length,
    budgetSkippedTaskCount: budget.skippedTasks.length,
    circuitSkippedTaskCount: skippedByCircuit,
    successTools,
    errorTools,
    skippedTools,
    factsCount: facts.length,
    citationCount: citations.length,
    durationMs: Date.now() - startedAt,
  });

  return {
    facts: facts.slice(0, MAX_FACTS),
    citations: dedupeCitations(citations),
    usedTools,
    messageBlocks: messageBlocks.slice(0, MAX_MESSAGE_BLOCKS),
  };
}

type TaskExecutionResult =
  | { task: ToolTask; status: 'success'; output: ToolRunOutput; latencyMs: number }
  | { task: ToolTask; status: 'error'; error: unknown; latencyMs: number }
  | { task: ToolTask; status: 'skipped'; skipReason: 'circuit_open'; latencyMs: number };

interface TaskExecutionOptions {
  transientFailureCircuitThreshold?: number;
}

function applyToolExecutionBudget(tasks: ToolTask[], maxCallsPerTurn: number): ToolExecutionBudget {
  const normalizedMaxCalls = Math.max(1, Math.min(Math.trunc(maxCallsPerTurn), 20));
  if (tasks.length <= normalizedMaxCalls) {
    return {
      tasks,
      skippedTasks: [],
      plannedCalls: tasks.length,
      maxCalls: normalizedMaxCalls,
    };
  }
  return {
    tasks: tasks.slice(0, normalizedMaxCalls),
    skippedTasks: tasks.slice(normalizedMaxCalls),
    plannedCalls: tasks.length,
    maxCalls: normalizedMaxCalls,
  };
}

async function runTasksWithConcurrency(
  tasks: ToolTask[],
  concurrency: number,
  options?: TaskExecutionOptions
): Promise<TaskExecutionResult[]> {
  const limit = Math.max(1, Math.min(concurrency, tasks.length || 1));
  const results: TaskExecutionResult[] = new Array(tasks.length);
  const transientFailureCircuitThreshold = Math.max(
    0,
    Math.min(10, Math.trunc(options?.transientFailureCircuitThreshold ?? 0))
  );
  let cursor = 0;
  let transientFailureCount = 0;
  let circuitOpen = false;

  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= tasks.length) return;

      const task = tasks[index];
      if (circuitOpen) {
        results[index] = {
          task,
          status: 'skipped',
          skipReason: 'circuit_open',
          latencyMs: 0,
        };
        continue;
      }
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
        if (transientFailureCircuitThreshold > 0 && isTransientToolExecutionError(error)) {
          transientFailureCount += 1;
          if (transientFailureCount >= transientFailureCircuitThreshold) {
            circuitOpen = true;
          }
        }
      }
    }
  });

  await Promise.all(workers);
  for (let index = 0; index < tasks.length; index += 1) {
    if (results[index]) continue;
    results[index] = {
      task: tasks[index],
      status: 'skipped',
      skipReason: 'circuit_open',
      latencyMs: 0,
    };
  }
  return results;
}

function buildToolTasks(
  baseUrl: string,
  message: string,
  symbols: string[],
  contextSnapshot?: AssistantContextSnapshot,
  queryPlan?: AssistantQueryPlan
): ToolTask[] {
  const symbolScope = buildSymbolGroundingScope(message, symbols, contextSnapshot);
  const requestsUniverseStockRanking = symbolScope.requestsUniverseStockRanking;
  const symbolTargets = symbolScope.symbolTargets;
  const hasSymbolTargets = symbolTargets.length > 0;
  const hasQueryPlanSteps = Boolean(queryPlan && Array.isArray(queryPlan.steps) && queryPlan.steps.length > 0);
  const planIncludesStockSnapshot = hasQueryPlanSteps
    ? queryPlan!.steps.some((step) => step.tool === "stockSnapshot")
    : false;
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
  const queryPlanFilters = queryPlan?.filters;
  const requiresStockSnapshotSignal = requiredToolSet.has("stockSnapshot");
  const needsSymbolScopedSignals = needsFundamentals
    || needsHealthScore
    || needsValuation
    || needsPeer
    || needsBacktest
    || requiresStockSnapshotSignal;
  const needsSensitivity = requiredToolSet.has("scenarioSensitivity");
  const tasks: ToolTask[] = [];
  const seen = new Set<string>();
  const addTask = (name: AssistantToolName, run: () => Promise<ToolRunOutput>, dedupeKey?: string) => {
    const key = dedupeKey ?? name;
    if (seen.has(key)) return;
    seen.add(key);
    tasks.push({ name, run });
  };
  const addTaskForSymbols = (
    name: AssistantToolName,
    runner: (symbol: string) => Promise<ToolRunOutput>
  ) => {
    for (const symbol of symbolTargets) {
      addTask(name, () => runner(symbol), `${name}:${symbol}`);
    }
  };

  const addTaskByName = (name: AssistantToolName) => {
    if (name === "dataHealth") {
      addTask(name, () => fetchDataHealth(baseUrl));
      return;
    }
    if (name === "stockSnapshot") {
      if (hasSymbolTargets) {
        addTaskForSymbols(
          name,
          (symbol) =>
            fetchStockSnapshot(
              baseUrl,
              symbol,
              contextSnapshot?.timeframe,
              message,
              contextSnapshot,
              queryPlanFilters
            )
        );
        return;
      }
      if (!requestsUniverseStockRanking && queryPlan?.intent !== "stock_snapshot" && !requiresStockSnapshotSignal) {
        return;
      }
      addTask(name, () => fetchStockUniverseSnapshot(baseUrl, message, contextSnapshot, queryPlanFilters));
      return;
    }
    if (name === "fundamentalSnapshot") {
      if (!hasSymbolTargets) return;
      addTaskForSymbols(name, (symbol) => fetchFundamentalSnapshot(baseUrl, symbol, message, contextSnapshot));
      return;
    }
    if (name === "fundamentalAnalysis") {
      if (!hasSymbolTargets) return;
      addTaskForSymbols(name, (symbol) => fetchFinanceAnalysis(baseUrl, symbol, "fundamental", message, contextSnapshot));
      return;
    }
    if (name === "financialHealthScore") {
      if (!hasSymbolTargets || BASELINE_ONLY_MODE) return;
      addTaskForSymbols(name, (symbol) => fetchFinanceAnalysis(baseUrl, symbol, "health", message, contextSnapshot));
      return;
    }
    if (name === "valuationDcf") {
      if (!hasSymbolTargets || BASELINE_ONLY_MODE) return;
      addTaskForSymbols(name, (symbol) => fetchFinanceAnalysis(baseUrl, symbol, "valuation", message, contextSnapshot));
      return;
    }
    if (name === "peerMultiples") {
      if (!hasSymbolTargets || BASELINE_ONLY_MODE) return;
      addTaskForSymbols(name, (symbol) => fetchFinanceAnalysis(baseUrl, symbol, "peer", message, contextSnapshot));
      return;
    }
    if (name === "scenarioSensitivity") {
      if (!hasSymbolTargets || BASELINE_ONLY_MODE) return;
      addTaskForSymbols(name, (symbol) => fetchFinanceAnalysis(baseUrl, symbol, "sensitivity", message, contextSnapshot));
      return;
    }
    if (name === "riskSnapshot") {
      if (!hasSymbolTargets) return;
      addTaskForSymbols(name, (symbol) => fetchRiskSnapshot(baseUrl, symbol));
      return;
    }
    if (name === "backtestSummary") {
      if (!hasSymbolTargets) {
        if (queryPlan?.intent !== "backtesting") return;
        const fallbackSymbol = resolveBacktestFallbackSymbol(contextSnapshot);
        if (!fallbackSymbol) return;
        addTask(name, () => fetchBacktestSummary(baseUrl, fallbackSymbol));
        return;
      }
      addTaskForSymbols(name, (symbol) => fetchBacktestSummary(baseUrl, symbol));
      return;
    }
    if (name === "factorSnapshot") {
      addTask(name, () => fetchFactorSnapshot(baseUrl));
      return;
    }
    if (name === "marketSnapshot") {
      if (queryPlan?.intent === "stock_snapshot" && hasSymbolTargets && !requestsUniverseStockRanking) {
        return;
      }
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

  if (hasQueryPlanSteps) {
    for (const step of queryPlan?.steps ?? []) {
      addTaskByName(step.tool);
    }
    if (QUERY_PLAN_STRICT_MODE) {
      const requiredPlanTools = new Set<AssistantToolName>(
        (queryPlan?.steps ?? []).filter((step) => step.required).map((step) => step.tool)
      );
      for (const toolName of requiredPlanTools) {
        addTaskByName(toolName);
      }
      for (const toolName of requiredToolSet) {
        addTaskByName(toolName);
      }
      const shouldForceFundamentalAnalysis =
        hasSymbolTargets
        && (queryPlan?.intent === "fundamentals" || queryPlan?.intent === "valuation")
        && (requiredToolSet.has("fundamentalSnapshot") || requiredToolSet.has("financialHealthScore"));
      if (shouldForceFundamentalAnalysis) {
        addTaskByName("fundamentalAnalysis");
      }
      if (tasks.length > 0) {
        return tasks;
      }
    }
  }

  const allowStockPrefetch = !hasQueryPlanSteps || planIncludesStockSnapshot;
  const shouldPrefetchStockSnapshot = Boolean(
    allowStockPrefetch
    && !requestsUniverseStockRanking
    && hasSymbolTargets
    && (
      needsSymbolScopedSignals
      || contextSnapshot?.page === "charts"
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

  if (
    hasSymbolTargets
    && (needsFundamentals || needsHealthScore)
    && (!queryPlan || queryPlan.intent === "fundamentals" || queryPlan.intent === "valuation")
  ) {
    addTaskByName("fundamentalAnalysis");
  }

  if (hasSymbolTargets && !BASELINE_ONLY_MODE && needsSensitivity) {
    addTaskByName("scenarioSensitivity");
  }

  if (hasSymbolTargets && needsPeer) {
    addTaskByName("peerMultiples");
  }
  if (hasSymbolTargets && needsRisk) {
    addTaskByName("riskSnapshot");
  }
  if (hasSymbolTargets && needsBacktest) {
    addTaskByName("backtestSummary");
  }
  if (needsFactor) {
    addTaskByName("factorSnapshot");
  }
  if (
    !requestsUniverseStockRanking
    && (!hasSymbolTargets || needsMarket)
    && !(queryPlan?.intent === "stock_snapshot" && hasSymbolTargets)
  ) {
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
  contextSnapshot?: AssistantContextSnapshot,
  queryPlanFilters?: AssistantQueryPlan["filters"]
): Promise<ToolRunOutput> {
  await ensureResolvableHoseSymbol(symbol);
  const limit = resolveStockSnapshotLimit(timeframe, message, contextSnapshot);
  const plannedRange = extractRequestedDateRangeFromPlan(queryPlanFilters);
  const requestedRange = plannedRange ?? extractRequestedDateRange(message ?? "", contextSnapshot);
  const plannedDate = normalizeDateLike(queryPlanFilters?.date);
  const requestedDate = requestedRange ? null : (plannedDate ?? extractRequestedDate(message ?? "", contextSnapshot));
  const endpoint = requestedRange
    ? `/api/stocks?symbol=${encodeURIComponent(symbol)}&from=${encodeURIComponent(requestedRange.from)}&to=${encodeURIComponent(requestedRange.to)}&limit=all`
    : requestedDate
      ? `/api/stocks?symbol=${encodeURIComponent(symbol)}&date=${encodeURIComponent(requestedDate)}&limit=1`
      : `/api/stocks?symbol=${encodeURIComponent(symbol)}&limit=${encodeURIComponent(limit)}`;
  const payload = await fetchJson<{
    data?: Array<{ date?: string; open?: number; high?: number; low?: number; close?: number; volume?: number }>;
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
        fromDate: requestedRange?.from ?? null,
        toDate: requestedRange?.to ?? null,
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
    `Stock snapshot ${symbol}: latest_close=${formatMaybeNumber(latestClose)}, day_change_pct=${formatMaybePercent(dayChangePct)}, latest_volume=${formatMaybeNumber(latestVolume)}, latest_date=${String(latest.date ?? 'unknown')}${requestedRange ? `, from_date=${requestedRange.from}, to_date=${requestedRange.to}, returned_rows=${series.length}` : requestedDate ? `, requested_date=${payload.requestedDate ?? requestedDate}, as_of_date=${payload.asOfDate ?? String(latest.date ?? "unknown")}, exact_date_match=${payload.exactDateMatch === true ? "true" : "false"}` : ""}.`,
  ];
  const shouldIncludeChart = shouldAttachStockChartBlock(message ?? "", contextSnapshot);
  const preferredChartType = resolveRequestedStockChartType(message ?? "", contextSnapshot);
  const chartBlock = shouldIncludeChart
    ? buildStockSnapshotChartBlock(series, symbol, preferredChartType)
    : null;
  const messageBlocks = chartBlock ? [chartBlock] : undefined;

  return {
    facts,
    citations: [buildCitation(`stock-${symbol}`, `OHLCV snapshot for ${symbol}`, endpoint, symbol)],
    messageBlocks,
    evidenceCount: countNumericEvidence([latestClose, dayChangePct, latestVolume]),
    requestParams: {
      symbol,
      timeframe: limit,
      requestedDate,
      fromDate: requestedRange?.from ?? null,
      toDate: requestedRange?.to ?? null,
    },
  };
}

async function fetchStockUniverseSnapshot(
  baseUrl: string,
  message: string,
  contextSnapshot?: AssistantContextSnapshot,
  queryPlanFilters?: AssistantQueryPlan["filters"]
): Promise<ToolRunOutput> {
  const plannedDate = normalizeDateLike(queryPlanFilters?.date);
  const requestedDate = plannedDate ?? extractRequestedDate(message, contextSnapshot);
  const metricFromPlan =
    queryPlanFilters?.metric === "close"
    || queryPlanFilters?.metric === "open"
    || queryPlanFilters?.metric === "high"
    || queryPlanFilters?.metric === "low"
    || queryPlanFilters?.metric === "volume"
      ? queryPlanFilters.metric
      : null;
  const metric = metricFromPlan ?? extractStockUniverseMetric(message, contextSnapshot);
  const order = queryPlanFilters?.order === "asc" || queryPlanFilters?.order === "desc"
    ? queryPlanFilters.order
    : extractRankingOrder(message, contextSnapshot);
  const limitFromPlan = Number.isFinite(queryPlanFilters?.limit)
    ? Math.min(50, Math.max(1, Number(queryPlanFilters?.limit)))
    : null;
  const limit = limitFromPlan ?? (extractTopLimit(message, contextSnapshot, 10) ?? 10);
  const requestedExchange = extractStockUniverseExchange(message, contextSnapshot);
  const exchange = "HOSE";
  const icbFilter = extractIcbFilter(message, contextSnapshot);

  if (requestedExchange !== "HOSE") {
    const scopeMessage =
      `Scope guard: requested_exchange=${requestedExchange}. Grounded dataset currently supports HOSE only. ` +
      `Use exchange=HOSE for numeric ranking queries.`;
    return {
      facts: [
        `Stock universe scope limitation: requested_exchange=${requestedExchange}, but current dataset only supports HOSE. Numeric ranking for ${requestedExchange} cannot be provided from grounded data.`,
      ],
      citations: [
        buildCitation(
          "stock-universe-scope-hose-only",
          "Stock universe scope (HOSE only)",
          "/api/stocks?exchange=HOSE&limit=1"
        ),
      ],
      messageBlocks: [
        {
          type: "text",
          title: "Exchange Scope Guard",
          content: scopeMessage,
        },
      ],
      evidenceCount: 1,
      warningCount: 1,
      requestParams: {
        requestedExchange,
        exchange,
        requestedDate,
        metric,
        order,
        limit,
        icbFilter,
      },
    };
  }

  const params = new URLSearchParams();
  params.set("exchange", exchange);
  params.set("limit", String(limit));
  params.set("metric", metric);
  params.set("order", order);
  if (requestedDate) params.set("date", requestedDate);
  if (icbFilter) params.set("icb", icbFilter);
  const endpoint = `/api/stocks?${params.toString()}`;

  const payload = await fetchJson<{
    exchange?: string;
    requestedDate?: string;
    asOfDate?: string;
    pricedSymbols?: number;
    exactDateMatchCount?: number;
    total?: number;
    stocks?: Array<{
      symbol?: string;
      date?: string;
      open?: number;
      high?: number;
      low?: number;
      close?: number;
      volume?: number;
      exactDateMatch?: boolean;
    }>;
  }>(baseUrl, endpoint, Math.max(TOOL_TIMEOUT_MS, 30_000));

  const candidates = Array.isArray(payload.stocks)
    ? payload.stocks
        .map((row) => ({
          ...row,
          metricValue: getStockUniverseMetricValue(row, metric),
        }))
        .filter(
          (row): row is {
            symbol: string;
            date: string;
            open?: number;
            high?: number;
            low?: number;
            close?: number;
            volume?: number;
            exactDateMatch?: boolean;
            metricValue: number;
          } => typeof row.symbol === "string" && typeof row.date === "string" && row.metricValue !== null
        )
    : [];
  const topRows = candidates.slice(0, limit);
  const rankedCandidates = toNumber(payload.total);
  const facts: string[] = [
    `Stock universe ranking: exchange=${payload.exchange ?? exchange}, metric=${metric}, order=${order}, requested_date=${payload.requestedDate ?? requestedDate ?? "latest"}, as_of_date=${payload.asOfDate ?? "n/a"}, priced_symbols=${formatMaybeNumber(toNumber(payload.pricedSymbols))}, ranked_candidates=${formatMaybeNumber(rankedCandidates ?? candidates.length)}, returned_rows=${topRows.length}.`,
  ];
  if (topRows.length > 0) {
    const leader = topRows[0];
    facts.push(
      `Top ranked stock: symbol=${leader.symbol}, metric_value=${formatMaybeNumber(leader.metricValue)}, close=${formatMaybeNumber(toNumber(leader.close))}, volume=${formatMaybeNumber(toNumber(leader.volume))}, date=${leader.date}.`
    );
    const rankedRowSummary = topRows
      .slice(0, Math.min(5, topRows.length))
      .map((row, index) => {
        return `#${index + 1} ${row.symbol} metric=${formatMaybeNumber(row.metricValue)} close=${formatMaybeNumber(toNumber(row.close))} date=${row.date}`;
      })
      .join("; ");
    facts.push(`Stock ranked rows: ${rankedRowSummary}.`);
  } else {
    facts.push("No stock rows were returned for the requested stock-universe ranking filters.");
  }

  const pricedSymbols = toNumber(payload.pricedSymbols);
  const exactDateMatchCount = toNumber(payload.exactDateMatchCount);
  const hasAsOfFallback =
    requestedDate !== null
    && pricedSymbols !== null
    && exactDateMatchCount !== null
    && exactDateMatchCount < pricedSymbols;
  if (hasAsOfFallback) {
    facts.push(
      `Date alignment notice: exact_date_match_count=${formatMaybeNumber(exactDateMatchCount)} is lower than priced_symbols=${formatMaybeNumber(pricedSymbols)}, so some rows were taken from the nearest previous trading day.`
    );
  }

  const tableRows = topRows.map((row, index) => [
    index + 1,
    row.symbol,
    row.date,
    metric,
    row.metricValue,
    toNumber(row.close),
    toNumber(row.volume),
    row.exactDateMatch === true ? "true" : "false",
  ] as Array<string | number | null>);

  const messageBlocks: AssistantMessageBlock[] = [];
  if (tableRows.length > 0) {
    messageBlocks.push({
      type: "table",
      title: "Stock Ranking (Universe)",
      columns: ["Rank", "Symbol", "Date", "Metric", "Metric Value", "Close", "Volume", "Exact Date"],
      rows: tableRows,
    });
  }

  return {
    facts,
    citations: [buildCitation("stock-universe-ranking", "Stock universe ranking", endpoint)],
    messageBlocks,
    evidenceCount: tableRows.length,
    warningCount: hasAsOfFallback ? 1 : 0,
    requestParams: {
      exchange,
      requestedDate,
      metric,
      order,
      limit,
      icbFilter,
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
  const periodIntent = extractFinancialPeriodIntent(message, contextSnapshot);
  const requestedPeriod = periodIntent.explicitPeriod ?? "latest";
  const endpoint = `/api/fundamentals?symbol=${encodeURIComponent(symbol)}&period=${encodeURIComponent(requestedPeriod)}&statement=${encodeURIComponent(statement)}`;
  const payload = await fetchJson<{
    period?: string;
    availablePeriods?: string[];
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

  const revenue = getFirstNumericByHints(incomeFields, ['revenue', 'net_sales', 'sales', 'doanh thu']);
  const netIncome = getFirstNumericByHints(incomeFields, ['net_profit_for_the_year', 'net_income', 'profit_after_tax', 'profit', 'loi nhuan']);
  const totalAssets = getFirstNumericByHints(balanceFields, ['total_assets', 'assets', 'tong tai san']);
  const opCashFlow = getFirstNumericByHints(cashFlowFields, ['operating_cash_flow', 'cash_flow_from_operating', 'cash flow', 'luu chuyen tien']);
  const evidenceCount = countNumericEvidence([revenue, netIncome, totalAssets, opCashFlow]);
  const warnings = normalizeWarnings(payload.warnings);
  const availablePeriods = Array.isArray(payload.availablePeriods)
    ? payload.availablePeriods.filter((period): period is string => typeof period === "string")
    : [];
  const recentPeriods = availablePeriods.slice(-4);

  const facts = [
    `Fundamentals ${symbol}: statement=${statement}, requested_period=${requestedPeriod}, resolved_period=${payload.period ?? 'latest'}, available_periods=${availablePeriods.length}, latest_4_periods=${recentPeriods.join(",") || "n/a"}, confidence=${payload.confidence ?? 'n/a'}, coverage_ratio=${formatMaybePercent(toNumber(payload.coverage?.coverageRatio))}, revenue=${formatMaybeNumber(revenue)}, net_income=${formatMaybeNumber(netIncome)}, total_assets=${formatMaybeNumber(totalAssets)}, operating_cash_flow=${formatMaybeNumber(opCashFlow)}.`,
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
      requestedPeriod,
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
  const requestedExchange = extractStockUniverseExchange(message, contextSnapshot);
  const exchange = "HOSE";

  if (requestedExchange !== "HOSE") {
    const scopeMessage =
      `Scope guard: requested_exchange=${requestedExchange}. Grounded dataset currently supports HOSE only. ` +
      `Use exchange=HOSE for valuation ranking queries.`;
    return {
      facts: [
        `Valuation ranking scope limitation: requested_exchange=${requestedExchange}, but current dataset only supports HOSE. Numeric valuation ranking for ${requestedExchange} cannot be provided from grounded data.`,
      ],
      citations: [
        buildCitation(
          "valuation-ranking-scope-hose-only",
          "Valuation ranking scope (HOSE only)",
          "/api/analytics/valuation-rankings?exchange=HOSE&limit=1"
        ),
      ],
      messageBlocks: [
        {
          type: "text",
          title: "Exchange Scope Guard",
          content: scopeMessage,
        },
      ],
      evidenceCount: 1,
      warningCount: 1,
      requestParams: {
        requestedExchange,
        exchange,
        requestedDate,
        icbLevel,
        icbFilter,
        metric,
        order,
        limit,
      },
    };
  }

  const params = new URLSearchParams();
  params.set("exchange", exchange);
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
    `Valuation ranking: exchange=${exchange}, metric=${payload.metric ?? metric}, order=${payload.order ?? order}, as_of_date=${payload.asOfDate ?? "n/a"}, requested_date=${payload.requestedDate ?? requestedDate ?? "latest"}, eligible_ranked=${formatMaybeNumber(toNumber(payload.eligibleRanked))}, returned_rows=${rows.length}.`,
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
      requestedExchange,
      exchange,
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
  analysisType: FinanceAnalysisType,
  message?: string,
  contextSnapshot?: AssistantContextSnapshot
): Promise<ToolRunOutput> {
  const periodIntent = extractFinancialPeriodIntent(message ?? "", contextSnapshot);
  const params = new URLSearchParams({
    symbol,
    type: analysisType,
  });
  if (periodIntent.explicitPeriod) {
    params.set("period", periodIntent.explicitPeriod);
  }
  if (periodIntent.lookbackQuarters !== null) {
    params.set("lookback", String(periodIntent.lookbackQuarters));
  }
  const endpoint = `/api/finance-analysis?${params.toString()}`;
  const analysisRequestParams: Record<string, string | number | boolean | null> = {
    symbol,
    type: analysisType,
    requestedPeriod: periodIntent.explicitPeriod,
    lookbackQuarters: periodIntent.lookbackQuarters,
  };
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
  const selectedPeriods = Array.isArray(payload.coverage?.selectedPeriods)
    ? payload.coverage?.selectedPeriods.filter((period): period is string => typeof period === "string")
    : [];
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
      requestParams: analysisRequestParams,
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
        requestParams: analysisRequestParams,
      };
    }

    const currentRatio = pickLatestFromRatioCollection(data, 'liquidity', 'currentRatio');
    const debtToEquity = pickLatestFromRatioCollection(data, 'leverage', 'debtToEquity');
    const netMargin = pickLatestFromRatioCollection(data, 'profitability', 'netMargin');
    const ocfToNetIncome = pickLatestFromRatioCollection(data, 'cashFlowQuality', 'ocfToNetIncome');
    const revenueSeries = getPointSeries(data, "incomeStatement", "revenue");
    const netIncomeSeries = getPointSeries(data, "incomeStatement", "netIncome");
    const netMarginSeries = getPointSeries(data, "profitability", "netMargin");
    const requestedPeriods = selectFinancialPeriods(selectedPeriods, periodIntent);
    const latestPeriod = requestedPeriods.length > 0 ? requestedPeriods[requestedPeriods.length - 1] : null;
    const latestRevenue = latestPeriod ? getSeriesValueByPeriod(revenueSeries, latestPeriod) : null;
    const latestNetIncome = latestPeriod ? getSeriesValueByPeriod(netIncomeSeries, latestPeriod) : null;
    const trendRows = requestedPeriods.map((period) => [
      period,
      getSeriesValueByPeriod(revenueSeries, period),
      getSeriesValueByPeriod(netIncomeSeries, period),
      getSeriesValueByPeriod(netMarginSeries, period),
    ] as Array<string | number | null>);
    const periodWarnings: string[] = [];
    if (periodIntent.explicitPeriod && !selectedPeriods.includes(periodIntent.explicitPeriod)) {
      periodWarnings.push(`Requested period ${periodIntent.explicitPeriod} is not present in loaded coverage window.`);
    }
    if (
      periodIntent.lookbackQuarters !== null
      && periodIntent.lookbackQuarters > 0
      && selectedPeriods.length > 0
      && periodIntent.lookbackQuarters > selectedPeriods.length
    ) {
      periodWarnings.push(
        `Requested ${periodIntent.lookbackQuarters} quarter(s), but only ${selectedPeriods.length} period(s) are loaded for this request.`
      );
    }
    if (periodWarnings.length > 0) {
      messageBlocks.push({
        type: "text",
        title: `Period Coverage Notice (${symbol})`,
        content: periodWarnings.join("\n"),
      });
    }
    const evidenceCount = countNumericEvidence([
      currentRatio,
      debtToEquity,
      netMargin,
      ocfToNetIncome,
      latestRevenue,
      latestNetIncome,
    ]);
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
    const trendBlock: AssistantMessageBlock = {
      type: 'table',
      title: `${Math.max(1, trendRows.length)}-Quarter Trend (${symbol})`,
      columns: ['Period', 'Revenue', 'Net Income', 'Net Margin'],
      rows: trendRows,
      note: 'Trend periods are selected from available financial statements.',
    };
    const blockList = trendRows.length > 1
      ? [...messageBlocks, tableBlock, trendBlock]
      : [...messageBlocks, tableBlock];
    return {
      facts: [
        `Fundamental analysis ${symbol}: confidence=${payload.confidence ?? 'n/a'}, coverage_ratio=${formatMaybePercent(coverageRatio)}, loaded_periods=${selectedPeriodCount ?? 'n/a'}, requested_period=${periodIntent.explicitPeriod ?? 'latest'}, requested_lookback_quarters=${periodIntent.lookbackQuarters ?? 'n/a'}, latest_period=${latestPeriod ?? 'n/a'}, latest_revenue=${formatMaybeNumber(latestRevenue)}, latest_net_income=${formatMaybeNumber(latestNetIncome)}, net_margin=${formatMaybePercent(netMargin)}, current_ratio=${formatMaybeNumber(currentRatio)}, debt_to_equity=${formatMaybeNumber(debtToEquity)}, ocf_to_net_income=${formatMaybeNumber(ocfToNetIncome)}.`,
        `Fundamental trend ${symbol}: selected_periods=${requestedPeriods.join(",") || "n/a"}.`,
      ],
      citations,
      messageBlocks: blockList,
      evidenceCount,
      warningCount: warnings.length + periodWarnings.length,
      requestParams: {
        ...analysisRequestParams,
      },
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
      requestParams: analysisRequestParams,
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
      requestParams: analysisRequestParams,
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
      requestParams: analysisRequestParams,
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
    requestParams: analysisRequestParams,
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

async function ensureResolvableHoseSymbol(symbol: string): Promise<void> {
  const normalized = String(symbol ?? "").trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9]{1,5}$/.test(normalized)) {
    throw {
      message: `Invalid ticker ${normalized || "n/a"}. Symbol is not available in grounded HOSE dataset.`,
      endpoint: `/api/stocks?symbol=${encodeURIComponent(normalized || "n/a")}&limit=1`,
      symbol: normalized || undefined,
      title: "Invalid ticker",
    };
  }

  const universe = await loadHoseSymbolUniverse();
  if (universe.size === 0) return;
  if (universe.has(normalized)) return;

  throw {
    message: `Invalid ticker ${normalized}. Symbol is not available in grounded HOSE dataset.`,
    endpoint: `/api/stocks?symbol=${encodeURIComponent(normalized)}&limit=1`,
    symbol: normalized,
    title: "Invalid ticker",
  };
}

async function loadHoseSymbolUniverse(): Promise<Set<string>> {
  if (!hoseSymbolUniversePromise) {
    hoseSymbolUniversePromise = (async () => {
      try {
        const metadata = await loadStockMetadata();
        const hoseRows = metadata.filter((row) => {
          const exchange = normalizeForKeywordMatch(String(row.exchange ?? ""));
          return exchange.includes("hose") || exchange.includes("hsx");
        });
        const source = hoseRows.length > 0 ? hoseRows : metadata;
        return new Set(
          source
            .map((row) => String(row.symbol ?? "").trim().toUpperCase())
            .filter((value) => value.length > 0)
        );
      } catch {
        return new Set<string>();
      }
    })();
  }
  return hoseSymbolUniversePromise;
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
  const url = `${trimTrailingSlash(baseUrl)}${endpoint}`;
  for (let attempt = 0; attempt < TOOL_FETCH_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'content-type': 'application/json',
        },
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) {
        const retryAfterMs = parseRetryAfterHeaderMs(response.headers.get('Retry-After'));
        const message = await response.text();
        if (shouldRetryToolHttpStatus(response.status) && attempt < TOOL_FETCH_MAX_ATTEMPTS - 1) {
          const delayMs = Math.max(retryAfterMs, TOOL_FETCH_RETRY_BACKOFF_MS * (attempt + 1));
          await sleep(delayMs);
          continue;
        }
        throw {
          status: response.status,
          message: message || 'Tool API failed',
        } satisfies HttpErrorShape;
      }
      return (await response.json()) as T;
    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError';
      const isRetryableNetwork = isRetryableToolFetchError(error);
      if ((isAbort || isRetryableNetwork) && attempt < TOOL_FETCH_MAX_ATTEMPTS - 1) {
        await sleep(TOOL_FETCH_RETRY_BACKOFF_MS * (attempt + 1));
        continue;
      }
      if (isAbort) {
        throw { message: 'Tool request timed out' } satisfies HttpErrorShape;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw { message: 'Tool request failed after retries' } satisfies HttpErrorShape;
}

function normalizeHttpError(error: unknown): HttpErrorShape {
  if (isHttpErrorShape(error)) {
    return {
      status: error.status,
      message: sanitizeToolErrorMessage(error.message),
    };
  }
  if (error instanceof Error) return { message: sanitizeToolErrorMessage(error.message) };
  return { message: sanitizeToolErrorMessage(String(error)) };
}

function extractToolErrorMetadata(error: unknown): { endpoint?: string; symbol?: string; title?: string } {
  if (!error || typeof error !== "object") return {};
  const candidate = error as { endpoint?: unknown; symbol?: unknown; title?: unknown };
  const endpoint = typeof candidate.endpoint === "string" ? candidate.endpoint : undefined;
  const symbol = typeof candidate.symbol === "string" ? candidate.symbol : undefined;
  const title = typeof candidate.title === "string" ? candidate.title : undefined;
  return { endpoint, symbol, title };
}

function deriveToolErrorCode(error: HttpErrorShape): string {
  if (typeof error.status === "number") return `tool_http_${error.status}`;
  const normalized = String(error.message ?? "").toLowerCase();
  if (normalized.includes("timed out")) return "tool_timeout";
  if (normalized.includes("aborted")) return "tool_aborted";
  if (normalized.includes("network")) return "tool_network";
  return "tool_error";
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
  const normalizedHints = hints.map((hint) => normalizeForKeywordMatch(hint));
  const noisyPattern = /(yoy|qoq|margin|ratio|pct|percent|growth|change)/;

  let bestScore = Number.NEGATIVE_INFINITY;
  let bestValue: number | null = null;
  for (const [key, value] of entries) {
    const numeric = toNumber(value);
    if (numeric === null) continue;
    const normalizedKey = normalizeForKeywordMatch(key);

    let score = Number.NEGATIVE_INFINITY;
    for (const hint of normalizedHints) {
      if (!hint) continue;
      if (normalizedKey === hint) {
        score = Math.max(score, 120);
      } else if (normalizedKey.startsWith(`${hint}_`)) {
        score = Math.max(score, 90);
      } else if (normalizedKey.includes(hint)) {
        score = Math.max(score, 60);
      }
    }

    if (score === Number.NEGATIVE_INFINITY) continue;
    if (noisyPattern.test(normalizedKey)) {
      score -= 80;
    }

    if (score > bestScore) {
      bestScore = score;
      bestValue = numeric;
    }
  }

  return bestScore > Number.NEGATIVE_INFINITY ? bestValue : null;
}

function sanitizeToolErrorMessage(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "Tool request failed";

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const errorValue = parsed.error;
    if (errorValue && typeof errorValue === "object" && !Array.isArray(errorValue)) {
      const errorRecord = errorValue as Record<string, unknown>;
      const code = normalizeToolErrorToken(errorRecord.code);
      const type = normalizeToolErrorToken(errorRecord.type);
      const message = normalizeToolErrorToken(errorRecord.message);
      const summary = [code, type, message].filter(Boolean).join(":");
      if (summary) return summary;
    }
    const message = normalizeToolErrorToken(parsed.message);
    if (message) return message;
  } catch {
    // Fall back below.
  }

  const normalized = normalizeToolErrorToken(raw);
  if (normalized) return normalized;
  return `error_hash=${hashText(raw)}`;
}

function normalizeToolErrorToken(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9:_-]+/g, "")
    .slice(0, 120)
    .toLowerCase();
}

function getPointSeries(
  data: Record<string, unknown>,
  section: string,
  key: string
): Array<{ period: string; value: number | null }> {
  const sec = data[section];
  if (!isRecord(sec)) return [];
  const collection = sec[key];
  if (!Array.isArray(collection)) return [];

  const series: Array<{ period: string; value: number | null }> = [];
  for (const item of collection) {
    if (!isRecord(item)) continue;
    const period = typeof item.period === "string" ? item.period.trim() : "";
    if (!period) continue;
    series.push({ period, value: toNumber(item.value) });
  }
  return series;
}

function getSeriesValueByPeriod(
  series: Array<{ period: string; value: number | null }>,
  period: string
): number | null {
  const target = series.find((item) => item.period === period);
  return target?.value ?? null;
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

interface FinancialPeriodIntent {
  explicitPeriod: string | null;
  lookbackQuarters: number | null;
  asksTrend: boolean;
}

function extractFinancialPeriodIntent(
  message: string,
  contextSnapshot?: AssistantContextSnapshot
): FinancialPeriodIntent {
  const filters = isRecord(contextSnapshot?.filters) ? contextSnapshot?.filters : undefined;
  const timeframe = typeof contextSnapshot?.timeframe === "string" ? contextSnapshot.timeframe : "";
  const explicitPeriod =
    normalizeQuarterPeriod(filters?.period)
    || normalizeQuarterPeriod(filters?.quarter)
    || normalizeQuarterPeriod(filters?.fiscalPeriod)
    || normalizeQuarterPeriod(timeframe)
    || extractQuarterPeriodFromMessage(message);

  const filterLookback =
    parsePositiveInt(filters?.lookbackQuarters, 1, 20)
    || parsePositiveInt(filters?.quarters, 1, 20)
    || parseQuarterToken(timeframe);
  const messageLookback = extractLookbackQuartersFromMessage(message);
  const lookbackQuarters = filterLookback ?? messageLookback ?? null;
  const normalized = normalizeForKeywordMatch(message);
  const asksTrend = [
    "xu huong",
    "trend",
    "gan nhat",
    "recent",
    "qua cac quy",
    "quarter trend",
  ].some((keyword) => normalized.includes(keyword));

  return {
    explicitPeriod,
    lookbackQuarters,
    asksTrend,
  };
}

function selectFinancialPeriods(availablePeriods: string[], intent: FinancialPeriodIntent): string[] {
  if (availablePeriods.length === 0) return [];
  if (intent.explicitPeriod && availablePeriods.includes(intent.explicitPeriod)) {
    return [intent.explicitPeriod];
  }

  const lookback =
    intent.lookbackQuarters !== null
      ? intent.lookbackQuarters
      : intent.asksTrend
        ? 4
        : 1;

  return availablePeriods.slice(-Math.max(1, Math.min(20, lookback)));
}

function normalizeQuarterPeriod(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const matchA = /^(\d{4})\s*Q([1-4])$/i.exec(trimmed);
  if (matchA) return `${matchA[1]}Q${matchA[2]}`;

  const matchB = /^Q([1-4])[\s/-]*(\d{4})$/i.exec(trimmed);
  if (matchB) return `${matchB[2]}Q${matchB[1]}`;
  return null;
}

function extractQuarterPeriodFromMessage(message: string): string | null {
  const matchA = /\b(20\d{2})\s*Q([1-4])\b/i.exec(message);
  if (matchA) return `${matchA[1]}Q${matchA[2]}`;

  const matchB = /\bQ([1-4])[\s/-]*(20\d{2})\b/i.exec(message);
  if (matchB) return `${matchB[2]}Q${matchB[1]}`;
  return null;
}

function parseQuarterToken(value: string): number | null {
  const match = /\b(\d{1,2})\s*q\b/i.exec(value);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.min(20, parsed);
}

function extractLookbackQuartersFromMessage(message: string): number | null {
  const matchA = /\b(\d{1,2})\s*(quy|quarters?|qtrs?)\b/i.exec(message);
  if (matchA) {
    const parsed = Number.parseInt(matchA[1], 10);
    if (Number.isFinite(parsed) && parsed > 0) return Math.min(20, parsed);
  }

  const normalized = normalizeForKeywordMatch(message);
  if (normalized.includes("4 quy")) return 4;
  return null;
}

function extractRequestedDate(message: string, contextSnapshot?: AssistantContextSnapshot): string | null {
  const filters = isRecord(contextSnapshot?.filters) ? contextSnapshot?.filters : undefined;
  const filterDate =
    normalizeDateLike(filters?.date)
    || normalizeDateLike(filters?.asOfDate)
    || normalizeDateLike(filters?.as_of_date)
    || normalizeDateLike(filters?.day);
  if (filterDate) return filterDate;

  const match = message.match(/\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/);
  if (!match) return null;
  return normalizeDateLike(match[1]);
}

function extractRequestedDateRange(
  message: string,
  contextSnapshot?: AssistantContextSnapshot
): RequestedDateRange | null {
  const filters = isRecord(contextSnapshot?.filters) ? contextSnapshot?.filters : undefined;
  const filterFrom = normalizeDateLike(filters?.from ?? filters?.fromDate ?? filters?.startDate);
  const filterTo = normalizeDateLike(filters?.to ?? filters?.toDate ?? filters?.endDate);
  if (filterFrom && filterTo) {
    return { from: filterFrom, to: filterTo };
  }

  const matches = message.match(/\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/g) ?? [];
  if (matches.length < 2) return null;
  const from = normalizeDateLike(matches[0]);
  const to = normalizeDateLike(matches[1]);
  if (!from || !to) return null;
  return { from, to };
}

function extractRequestedDateRangeFromPlan(
  filters?: AssistantQueryPlan["filters"]
): RequestedDateRange | null {
  const from = normalizeDateLike(filters?.from);
  const to = normalizeDateLike(filters?.to);
  if (!from || !to) return null;
  return { from, to };
}

function shouldAttachStockChartBlock(message: string, contextSnapshot?: AssistantContextSnapshot): boolean {
  const normalized = normalizeForKeywordMatch(message);
  const explicitChartIntent = hasAnyKeyword(normalized, [
    "chart",
    "graph",
    "plot",
    "line",
    "line chart",
    "candlestick",
    "candle",
    "ohlc",
    "gia",
    "xu huong",
    "trend",
    "bieu do",
    "do thi",
    "nen",
  ]);
  if (explicitChartIntent) return true;
  if (contextSnapshot?.page !== "charts") return false;

  // On charts page, attach chart blocks only when the query asks price/OHLC/trend-like data.
  return hasAnyKeyword(normalized, [
    "price",
    "gia",
    "gia dong cua",
    "dong cua",
    "gia mo cua",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "khoi luong",
    "trend",
    "xu huong",
    "ohlc",
  ]);
}

function resolveRequestedStockChartType(
  message: string,
  contextSnapshot?: AssistantContextSnapshot
): "line" | "candlestick" {
  const normalized = normalizeForKeywordMatch(message);
  if (
    hasAnyKeyword(normalized, [
      "candlestick",
      "candle",
      "ohlc",
      "nen",
      "nen nhat",
      "nen gia",
    ])
  ) {
    return "candlestick";
  }
  if (contextSnapshot?.page === "charts") return "candlestick";
  return "line";
}

type StockSnapshotSeriesRow = {
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
};

function buildStockSnapshotChartBlock(
  series: StockSnapshotSeriesRow[],
  symbol: string,
  chartType: "line" | "candlestick"
): AssistantMessageBlock | null {
  if (!Array.isArray(series) || series.length === 0) return null;
  const cappedSeries = series.slice(-90);
  if (chartType === "candlestick") {
    const candlePoints = cappedSeries
      .map((row) => {
        const x = String(row.date ?? "").trim();
        const open = toNumber(row.open);
        const high = toNumber(row.high);
        const low = toNumber(row.low);
        const close = toNumber(row.close);
        const volume = toNumber(row.volume);
        if (!x || open === null || high === null || low === null || close === null) return null;
        return {
          x,
          open,
          high: Math.max(high, open, close, low),
          low: Math.min(low, open, close, high),
          close,
          volume,
        };
      })
      .filter(
        (
          point
        ): point is { x: string; open: number; high: number; low: number; close: number; volume: number | null } =>
          point !== null
      );
    if (candlePoints.length > 0) {
      return {
        type: "chart",
        chartType: "candlestick",
        title: `Price Candlestick (${symbol})`,
        points: candlePoints,
        note: "OHLC derived from grounded stock snapshot rows.",
      };
    }
  }

  const linePoints = cappedSeries
    .map((row) => {
      const x = String(row.date ?? "").trim();
      const y = toNumber(row.close);
      if (!x || y === null) return null;
      return { x, y };
    })
    .filter((point): point is { x: string; y: number } => point !== null);
  if (linePoints.length === 0) return null;
  return {
    type: "chart",
    chartType: "line",
    title: `Close Price Trend (${symbol})`,
    points: linePoints,
    yLabel: "Close",
    note: "Close prices derived from grounded stock snapshot rows.",
  };
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
    { keywords: ["bat dong san", "bds", "real estate", "property"], value: "bat dong san" },
    { keywords: ["chung khoan", "securities"], value: "dich vu tai chinh" },
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

function buildSymbolGroundingScope(
  message: string,
  symbols: string[],
  contextSnapshot?: AssistantContextSnapshot
): SymbolGroundingScope {
  const requestsUniverseStockRanking = isStockUniverseRankingQuery(message, contextSnapshot);
  const requestedSymbols = dedupeSymbolList(symbols);
  const symbolTargets = requestsUniverseStockRanking ? [] : requestedSymbols.slice(0, MAX_SYMBOL_TOOL_FANOUT);
  const droppedSymbols = requestsUniverseStockRanking ? [] : requestedSymbols.slice(symbolTargets.length);

  return {
    requestsUniverseStockRanking,
    requestedSymbols,
    symbolTargets,
    droppedSymbols,
  };
}

function dedupeSymbolList(symbols: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const symbol of symbols) {
    const normalized = String(symbol).trim().toUpperCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function collectGroundedSymbols(citations: AssistantCitation[], symbolTargets: string[]): string[] {
  if (symbolTargets.length === 0) return [];
  const targetSet = new Set(symbolTargets.map((symbol) => symbol.toUpperCase()));
  const grounded: string[] = [];
  const seen = new Set<string>();
  for (const citation of citations) {
    const symbol = String(citation.symbol ?? "").trim().toUpperCase();
    if (!symbol || !targetSet.has(symbol) || seen.has(symbol)) continue;
    seen.add(symbol);
    grounded.push(symbol);
  }
  return grounded;
}

function buildSymbolCoverageNotice(input: {
  requestedSymbols: string[];
  symbolTargets: string[];
  groundedSymbols: string[];
  droppedSymbols: string[];
  requestsUniverseStockRanking: boolean;
}): AssistantMessageBlock[] {
  if (input.requestsUniverseStockRanking || input.requestedSymbols.length === 0) return [];
  const groundedSet = new Set(input.groundedSymbols.map((symbol) => symbol.toUpperCase()));
  const uncoveredRequestedSymbols = input.requestedSymbols.filter(
    (symbol) => !groundedSet.has(symbol.toUpperCase())
  );
  if (uncoveredRequestedSymbols.length === 0) return [];

  const fanoutReason =
    input.droppedSymbols.length > 0
      ? `fanout_limit=${MAX_SYMBOL_TOOL_FANOUT}, dropped_symbols=${input.droppedSymbols.join(", ")}`
      : "no_fanout_drop";
  const content = [
    `Symbol grounding coverage notice: requested_symbols=${input.requestedSymbols.join(", ")}, grounded_symbols=${input.groundedSymbols.join(", ") || "none"}, target_symbols=${input.symbolTargets.join(", ") || "none"}, uncovered_symbols=${uncoveredRequestedSymbols.join(", ")}.`,
    `Reason hints: ${fanoutReason}.`,
    "Numeric comparisons should be limited to grounded_symbols only.",
  ].join(" ");

  return [
    {
      type: "text",
      title: "Symbol Coverage Notice",
      content,
    },
  ];
}

type StockUniverseMetric = "close" | "open" | "high" | "low" | "volume";

function isStockUniverseRankingQuery(message: string, contextSnapshot?: AssistantContextSnapshot): boolean {
  return isStockUniverseRankingIntent(message, contextSnapshot);
}

function extractStockUniverseMetric(message: string, contextSnapshot?: AssistantContextSnapshot): StockUniverseMetric {
  const filters = isRecord(contextSnapshot?.filters) ? contextSnapshot.filters : undefined;
  const metricHint = normalizeForKeywordMatch(
    String(filters?.metric ?? filters?.sortBy ?? filters?.field ?? filters?.valueField ?? "")
  );
  const normalized = normalizeForKeywordMatch(message);
  const combined = `${metricHint} ${normalized}`.trim();

  if (combined.includes("volume") || combined.includes("khoi luong")) return "volume";
  if (combined.includes("gia mo cua") || combined.includes("open")) return "open";
  if (combined.includes("gia cao nhat") || /\bhigh\b/.test(combined)) return "high";
  if (combined.includes("gia thap nhat") || /\blow\b/.test(combined)) return "low";
  if (combined.includes("gia dong cua") || combined.includes("dong cua") || /\bclose\b/.test(combined)) return "close";
  return "close";
}

function extractStockUniverseExchange(message: string, contextSnapshot?: AssistantContextSnapshot): "HOSE" | "HNX" | "UPCOM" {
  const filters = isRecord(contextSnapshot?.filters) ? contextSnapshot.filters : undefined;
  const exchangeHint = normalizeForKeywordMatch(String(filters?.exchange ?? filters?.market ?? filters?.san ?? ""));
  const normalized = normalizeForKeywordMatch(message);
  const combined = `${exchangeHint} ${normalized}`.trim();
  const mentionsHose = combined.includes("hose") || combined.includes("hsx") || combined.includes("ho chi minh");
  const mentionsHnx = combined.includes("hnx") || combined.includes("ha noi");
  const mentionsUpcom = combined.includes("upcom") || combined.includes("up com");
  const negatesHnx = /\b(khong|ko|not)\s+(?:phai\s+)?hnx\b/.test(combined);
  const negatesUpcom = /\b(khong|ko|not)\s+(?:phai\s+)?up\s*com\b/.test(combined);

  if (mentionsHnx && !negatesHnx) return "HNX";
  if (mentionsUpcom && !negatesUpcom) return "UPCOM";
  if (mentionsHose) return "HOSE";
  return "HOSE";
}

function getStockUniverseMetricValue(
  row: { open?: number; high?: number; low?: number; close?: number; volume?: number },
  metric: StockUniverseMetric
): number | null {
  if (metric === "open") return toNumber(row.open);
  if (metric === "high") return toNumber(row.high);
  if (metric === "low") return toNumber(row.low);
  if (metric === "volume") return toNumber(row.volume);
  return toNumber(row.close);
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
  if (["asc", "ascending", "tang dan", "bottom", "lowest", "thap nhat"].some((key) => filterOrder.includes(key))) {
    return "asc";
  }
  if (["desc", "descending", "giam dan", "top", "highest", "cao nhat"].some((key) => filterOrder.includes(key))) {
    return "desc";
  }

  const normalized = normalizeForKeywordMatch(message);
  if (
    normalized.includes("tang dan")
    || normalized.includes("ascending")
    || normalized.includes("thap nhat")
    || normalized.includes("lowest")
    || normalized.includes("smallest")
    || normalized.includes("bottom")
  ) {
    return "asc";
  }
  if (
    normalized.includes("giam dan")
    || normalized.includes("descending")
  ) {
    return "desc";
  }
  return "desc";
}

function normalizeDateLike(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(trimmed);
  if (isoMatch) {
    const year = Number.parseInt(isoMatch[1], 10);
    const month = Number.parseInt(isoMatch[2], 10);
    const day = Number.parseInt(isoMatch[3], 10);
    if (!isValidDateParts(year, month, day)) return null;
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/.exec(trimmed);
  if (dmyMatch) {
    const day = Number.parseInt(dmyMatch[1], 10);
    const month = Number.parseInt(dmyMatch[2], 10);
    const yearRaw = Number.parseInt(dmyMatch[3], 10);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    if (!isValidDateParts(year, month, day)) return null;
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
}

function parsePositiveInt(value: unknown, min: number, max: number): number | null {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < min) return null;
  return Math.min(max, parsed);
}

function resolveBacktestFallbackSymbol(contextSnapshot?: AssistantContextSnapshot): string | null {
  const direct = typeof contextSnapshot?.symbol === "string" ? contextSnapshot.symbol.trim().toUpperCase() : "";
  if (/^[A-Z0-9]{2,8}$/.test(direct)) return direct;
  if (Array.isArray(contextSnapshot?.symbols)) {
    for (const item of contextSnapshot.symbols) {
      const candidate = String(item ?? "").trim().toUpperCase();
      if (/^[A-Z0-9]{2,8}$/.test(candidate)) return candidate;
    }
  }
  return "VNM";
}

function resolveStockSnapshotLimit(
  timeframe: string | undefined,
  message: string | undefined,
  contextSnapshot?: AssistantContextSnapshot
): string {
  const filters = isRecord(contextSnapshot?.filters) ? contextSnapshot?.filters : undefined;
  const candidateRaw =
    String(
      filters?.limit
      ?? filters?.window
      ?? filters?.range
      ?? filters?.lookback
      ?? timeframe
      ?? ""
    )
      .trim()
      .toLowerCase();
  const candidate = candidateRaw.replace(/\s+/g, "");
  const normalizedMessage = normalizeForKeywordMatch(message ?? "");

  if (candidate === "all" || candidate === "max" || candidate === "full") return "all";
  if (
    normalizedMessage.includes("toan bo")
    || normalizedMessage.includes("full history")
    || normalizedMessage.includes("all history")
    || normalizedMessage.includes("lich su day du")
  ) {
    return "all";
  }

  const numeric = parsePositiveInt(candidate, 1, 1000);
  if (numeric !== null) return String(numeric);

  const timeframeMap: Record<string, number> = {
    "1w": 5,
    "2w": 10,
    "1m": 22,
    "3m": 66,
    "6m": 132,
    "9m": 198,
    "12m": 252,
    "1y": 252,
    "2y": 504,
    "3y": 756,
    "5y": 1000,
    "ytd": 252,
  };
  if (candidate in timeframeMap) return String(timeframeMap[candidate]);

  const quarterMatch = /^(\d{1,2})q$/.exec(candidate);
  if (quarterMatch) {
    const quarters = Number.parseInt(quarterMatch[1], 10);
    if (Number.isFinite(quarters) && quarters > 0) {
      return String(Math.min(1000, quarters * 63));
    }
  }

  return "60";
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

function resolveToolMaxCallsPerTurn(): number {
  const fallback = 8;
  const raw = String(process.env.ASSISTANT_TOOL_MAX_CALLS_PER_TURN ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.min(parsed, 20));
}

function resolveToolFetchMaxAttempts(): number {
  const fallback = 2;
  const raw = String(process.env.ASSISTANT_TOOL_FETCH_MAX_ATTEMPTS ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.min(parsed, 4));
}

function resolveToolFetchRetryBackoffMs(): number {
  const fallback = 300;
  const raw = String(process.env.ASSISTANT_TOOL_FETCH_RETRY_BACKOFF_MS ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(100, Math.min(parsed, 5_000));
}

function resolveToolTransientFailureCircuitThreshold(): number {
  const fallback = 3;
  const raw = String(process.env.ASSISTANT_TOOL_TRANSIENT_FAILURE_CIRCUIT_THRESHOLD ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0) return 0;
  return Math.max(1, Math.min(parsed, 10));
}

function shouldRetryToolHttpStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function parseRetryAfterHeaderMs(headerValue: string | null): number {
  if (!headerValue) return 0;
  const seconds = Number.parseFloat(headerValue);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.max(0, Math.round(seconds * 1000));
  }
  const retryAt = Date.parse(headerValue);
  if (!Number.isFinite(retryAt)) return 0;
  return Math.max(0, retryAt - Date.now());
}

function isRetryableToolFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const text = error.message.toLowerCase();
  return (
    text.includes('fetch failed')
    || text.includes('failed to fetch')
    || text.includes('fetcherror')
    || text.includes('request to')
    || text.includes('network')
    || text.includes('timed out')
    || text.includes('timeout')
    || text.includes('aborted')
  );
}

function isTransientToolExecutionError(error: unknown): boolean {
  const normalized = normalizeHttpError(error);
  if (typeof normalized.status === 'number' && shouldRetryToolHttpStatus(normalized.status)) {
    return true;
  }
  const text = normalized.message.toLowerCase();
  return (
    text.includes('fetch failed')
    || text.includes('failed to fetch')
    || text.includes('network')
    || text.includes('timed out')
    || text.includes('timeout')
    || text.includes('aborted')
    || text.includes('temporarily unavailable')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
