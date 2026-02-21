"use client";

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AssistantCitation, AssistantMessageBlock, AssistantSemanticCheckItem, AssistantToolUsage, Message } from '@/types/assistant';
import { User, Bot, Wrench, AlertTriangle, CheckCircle2, Clock3, ShieldAlert, ChevronDown, FileDown, ListChecks } from 'lucide-react';
import { memo, useMemo, type ReactNode } from 'react';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gradient-to-br from-blue-500 to-teal-500 text-white'
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          'flex-1 max-w-[84%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-blue-600 text-white rounded-tr-sm'
            : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-900 dark:text-gray-100 rounded-tl-sm'
        )}
      >
        {!isUser && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {message.grounded && (
              <Badge variant="success" className="text-[10px] uppercase tracking-wide">
                Grounded Data
              </Badge>
            )}
            {message.policyStatus === 'fallback' && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide border-amber-300 text-amber-700 dark:text-amber-300 dark:border-amber-500/40">
                Guarded Fallback
              </Badge>
            )}
            {message.policyStatus === 'shadow_blocked' && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide border-orange-300 text-orange-700 dark:text-orange-300 dark:border-orange-500/40">
                Shadow Guard
              </Badge>
            )}
            {message.dataConfidence && (
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                Confidence: {message.dataConfidence}
              </Badge>
            )}
            {message.meta?.groundingRequired && (
              <Badge
                variant={message.meta.groundingSatisfied ? 'success' : 'destructive'}
                className="text-[10px] uppercase tracking-wide"
              >
                {message.meta.groundingSatisfied ? 'Evidence Satisfied' : 'Evidence Missing'}
              </Badge>
            )}
          </div>
        )}
        <div className="max-w-none">
          <MessageContent content={message.content} isUser={isUser} />
        </div>
        {!isUser && message.messageBlocks && message.messageBlocks.length > 0 && (
          <div className="mt-3 space-y-3">
            {message.messageBlocks.map((block, idx) => (
              <MessageBlockView
                key={`${message.id}-block-${idx}`}
                block={block}
                financeExportUrl={resolveFinanceExportUrl(message.usedTools, block)}
              />
            ))}
          </div>
        )}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="mt-3 border-t border-gray-200/70 dark:border-gray-700/70 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Sources ({message.citations.length})
            </p>
            <div className="space-y-2">
              {message.citations.map((citation) => (
                <CitationCard key={citation.id} citation={citation} />
              ))}
            </div>
          </div>
        )}
        {!isUser && (
          <ResponseTrace
            meta={message.meta}
            usedTools={message.usedTools}
            policyReason={message.meta?.policyReasonCode ?? message.policyReason}
            policyStatus={message.policyStatus}
          />
        )}
        <div
          className={cn(
            'text-xs mt-3 flex items-center gap-2 flex-wrap',
            isUser ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'
          )}
        >
          <Clock3 className="w-3 h-3" />
          {formatTime(message.timestamp)}
          {!isUser && message.meta?.providerUsed && (
            <span className="text-[10px] uppercase tracking-wide">
              via {message.meta.providerUsed}
              {message.meta.fallbackUsed ? ' (fallback)' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export const MemoizedChatMessage = memo(ChatMessage);

function CitationCard({ citation }: { citation: AssistantCitation }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-200">{citation.title}</p>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          {citation.sourceType}
        </Badge>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {citation.symbol && (
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-200/80 dark:bg-gray-700/70 text-gray-700 dark:text-gray-200">
            {citation.symbol}
          </span>
        )}
        {citation.period && (
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-200/80 dark:bg-gray-700/70 text-gray-700 dark:text-gray-200">
            {citation.period}
          </span>
        )}
      </div>
      {citation.endpoint && (
        <div className="mt-1 text-[11px]">
          {/^https?:\/\//i.test(citation.endpoint) ? (
            <a
              href={citation.endpoint}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 dark:text-blue-300 underline underline-offset-2 break-all"
            >
              {citation.endpoint}
            </a>
          ) : (
            <code className="text-gray-600 dark:text-gray-300 break-all">{citation.endpoint}</code>
          )}
        </div>
      )}
    </div>
  );
}

function ResponseTrace({
  meta,
  usedTools,
  policyReason,
  policyStatus,
}: {
  meta?: Message['meta'];
  usedTools?: AssistantToolUsage[];
  policyReason?: string;
  policyStatus?: Message['policyStatus'];
}) {
  if (!meta && (!usedTools || usedTools.length === 0)) return null;
  const groundingMissing = meta?.groundingRequired === true && meta?.groundingSatisfied === false;
  const semanticSummary = summarizeSemanticChecklist(meta?.semantic?.checklist);
  const shouldAutoOpen =
    policyStatus === "fallback" ||
    policyStatus === "shadow_blocked" ||
    meta?.fallbackUsed === true ||
    groundingMissing ||
    semanticSummary.blockedGuards > 0;
  const recoveryHint = buildTraceRecoveryHint(policyStatus, groundingMissing, meta?.fallbackUsed === true);

  return (
    <details
      open={shouldAutoOpen}
      className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/30"
    >
      <summary className="cursor-pointer list-none px-3 py-2 text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-300 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5" />
          Execution Trace
        </span>
        <ChevronDown className="w-3.5 h-3.5" />
      </summary>
      <div className="px-3 pb-3 space-y-2">
        {meta && (
          <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 dark:text-gray-300">
            <span>Provider: {meta.providerUsed}</span>
            <span>Latency: {typeof meta.latencyMs === 'number' ? `${meta.latencyMs}ms` : 'n/a'}</span>
            <span>Mode: {meta.policyMode ?? 'n/a'}</span>
            <span>Fallback: {meta.fallbackUsed ? 'yes' : 'no'}</span>
            {typeof meta.citationCount === 'number' && <span>Citations: {meta.citationCount}</span>}
            {typeof meta.groundedFactsCount === 'number' && <span>Facts: {meta.groundedFactsCount}</span>}
            {meta.requestId && <span className="col-span-2 break-all">Request ID: {meta.requestId}</span>}
          </div>
        )}
        {meta?.semantic && (
          <div className="rounded-lg border border-gray-200/80 dark:border-gray-700/80 bg-white/70 dark:bg-gray-900/35 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 inline-flex items-center gap-1">
                <ListChecks className="w-3.5 h-3.5" />
                Semantic Gate
              </p>
              <Badge
                variant={semanticSummary.blockedGuards > 0 ? "destructive" : "secondary"}
                className="text-[10px] uppercase tracking-wide"
              >
                {meta.semantic.phase}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 dark:text-gray-300">
              <span>Version: {String(meta.semantic.version || "n/a")}</span>
              <span>Checks: {semanticSummary.total}</span>
              <span>Pass rate: {formatSemanticPercent(meta.semantic.passRate, semanticSummary.passRate)}</span>
              <span>Guard pass: {formatSemanticPercent(meta.semantic.guardPassRate, semanticSummary.guardPassRate)}</span>
            </div>
            {Array.isArray(meta.semantic.checklist) && meta.semantic.checklist.length > 0 && (
              <div className="space-y-1">
                {meta.semantic.checklist.slice(0, 4).map((item) => (
                  <div key={`semantic-${item.id}`} className="text-[11px] text-gray-600 dark:text-gray-300 flex items-start gap-1.5">
                    <SemanticStatusIcon status={item.status} />
                    <span className="font-medium">{item.label}</span>
                    {item.guard && <span className="uppercase tracking-wide text-[10px] text-gray-500 dark:text-gray-400">guard</span>}
                  </div>
                ))}
                {meta.semantic.checklist.length > 4 && (
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    +{meta.semantic.checklist.length - 4} more checks
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        {recoveryHint && (
          <p className="text-[11px] text-amber-700 dark:text-amber-300 break-words">
            Recovery: {recoveryHint}
          </p>
        )}
        {policyReason && (
          <p className="text-[11px] text-gray-600 dark:text-gray-300">
            Reason: {formatPolicyReason(policyReason)}
          </p>
        )}
        {meta?.toolStatusSummary && (
          <p className="text-[11px] text-gray-600 dark:text-gray-300 break-words">
            Tool summary: {meta.toolStatusSummary}
          </p>
        )}
        {usedTools && usedTools.length > 0 && (
          <div className="space-y-1">
            {usedTools.map((tool, toolIndex) => (
              <div
                key={`${tool.name}-${tool.status}-${tool.errorCode ?? ''}-${toolIndex}`}
                className="text-[11px] text-gray-600 dark:text-gray-300 flex items-start gap-1.5"
              >
                <ToolStatusIcon status={tool.status} />
                <span className="font-medium">{tool.name}</span>
                <span className="uppercase tracking-wide">{tool.status}</span>
                {tool.errorCode && <span className="text-gray-500 dark:text-gray-400">({tool.errorCode})</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function ToolStatusIcon({ status }: { status: AssistantToolUsage['status'] }) {
  if (status === 'success') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300 mt-0.5" />;
  if (status === 'error') return <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-300 mt-0.5" />;
  return <ShieldAlert className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 mt-0.5" />;
}

function SemanticStatusIcon({ status }: { status: AssistantSemanticCheckItem["status"] }) {
  if (status === "pass") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300 mt-0.5" />;
  if (status === "warn") return <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300 mt-0.5" />;
  if (status === "fail") return <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-300 mt-0.5" />;
  return <Clock3 className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 mt-0.5" />;
}

function summarizeSemanticChecklist(checklist?: AssistantSemanticCheckItem[]) {
  if (!Array.isArray(checklist) || checklist.length === 0) {
    return {
      total: 0,
      passRate: null as number | null,
      guardPassRate: null as number | null,
      blockedGuards: 0,
    };
  }

  let passed = 0;
  let guardPassed = 0;
  let guardEvaluated = 0;
  let blockedGuards = 0;
  for (const item of checklist) {
    const status = item?.status;
    if (status === "pass") passed += 1;
    if (item?.guard === true) {
      if (status === "pass") {
        guardPassed += 1;
        guardEvaluated += 1;
      } else if (status === "warn" || status === "fail") {
        guardEvaluated += 1;
        blockedGuards += 1;
      }
    }
  }

  return {
    total: checklist.length,
    passRate: checklist.length > 0 ? passed / checklist.length : null,
    guardPassRate: guardEvaluated > 0 ? guardPassed / guardEvaluated : null,
    blockedGuards,
  };
}

function formatSemanticPercent(primary?: number, fallback?: number | null): string {
  const raw = Number.isFinite(primary) ? Number(primary) : Number.isFinite(fallback) ? Number(fallback) : NaN;
  if (!Number.isFinite(raw)) return "n/a";
  return `${(raw * 100).toFixed(1)}%`;
}

function formatPolicyReason(reason: string): string {
  const normalized = String(reason).trim();
  const labels: Record<string, string> = {
    insufficient_grounding: 'Insufficient grounding evidence',
    required_tool_failed: 'Required tool failed',
    missing_citation: 'Citation missing for required metric',
    empty_grounded_payload: 'Grounded payload is empty',
    malformed_grounded_payload: 'Grounded payload is malformed',
    grounding_mismatch: 'Grounding mismatch with requested metric',
    no_required_signals: 'No required grounding signal',
  };
  return labels[normalized] ?? normalized;
}

function buildTraceRecoveryHint(
  policyStatus: Message["policyStatus"] | undefined,
  groundingMissing: boolean,
  fallbackUsed: boolean
): string | null {
  if (groundingMissing) {
    return "Grounding evidence is missing. Retry with symbol + metric + timeframe so required tools can resolve.";
  }
  if (policyStatus === "shadow_blocked") {
    return "Scope guard triggered. Switch to supported grounded scope (for rankings, use HOSE).";
  }
  if (policyStatus === "fallback") {
    return "Guardrails triggered fallback. Narrow the request and ask for one symbol/metric/time window.";
  }
  if (fallbackUsed) {
    return "Primary provider failed over. Retry shortly if you need full model output fidelity.";
  }
  return null;
}

type FinanceExportType = "fundamental" | "health" | "valuation" | "peer" | "sensitivity";

function inferFinanceExportTypeFromBlock(block: AssistantMessageBlock): FinanceExportType | null {
  if (!block || block.type !== "table") return null;
  const title = normalizeKeyword(block.title);
  if (title.includes("health score")) return "health";
  if (title.includes("valuation") || title.includes("dcf")) return "valuation";
  if (title.includes("peer multiples")) return "peer";
  if (title.includes("sensitivity")) return "sensitivity";
  if (title.includes("fundamental")) return "fundamental";
  return null;
}

function mapToolNameToFinanceType(toolName: AssistantToolUsage["name"]): FinanceExportType | null {
  if (toolName === "fundamentalAnalysis") return "fundamental";
  if (toolName === "financialHealthScore") return "health";
  if (toolName === "valuationDcf") return "valuation";
  if (toolName === "peerMultiples") return "peer";
  if (toolName === "scenarioSensitivity") return "sensitivity";
  return null;
}

function resolveFinanceExportUrl(
  usedTools: AssistantToolUsage[] | undefined,
  block: AssistantMessageBlock
): string | null {
  if (!Array.isArray(usedTools) || usedTools.length === 0 || block.type !== "table") return null;
  const expectedType = inferFinanceExportTypeFromBlock(block);
  if (!expectedType) return null;

  const candidates = usedTools.filter((tool) => {
    if (tool.status !== "success") return false;
    const mappedType = mapToolNameToFinanceType(tool.name);
    if (!mappedType) return false;
    return true;
  });
  if (candidates.length === 0) return null;

  const selected = expectedType
    ? candidates.find((tool) => {
        const toolTypeRaw = String(tool.requestParams?.type ?? mapToolNameToFinanceType(tool.name) ?? "").toLowerCase();
        return toolTypeRaw === expectedType;
      }) ?? candidates[0]
    : candidates[0];

  const symbol = String(selected.requestParams?.symbol ?? "").trim().toUpperCase();
  const type = String(selected.requestParams?.type ?? mapToolNameToFinanceType(selected.name) ?? "").trim().toLowerCase();
  if (!symbol || !type) return null;

  const query = new URLSearchParams({
    symbol,
    type,
  });
  const requestedPeriod = String(selected.requestParams?.requestedPeriod ?? "").trim();
  if (requestedPeriod && requestedPeriod.toLowerCase() !== "latest") {
    query.set("period", requestedPeriod);
  }
  const lookbackRaw = selected.requestParams?.lookbackQuarters;
  if (typeof lookbackRaw === "number" && Number.isFinite(lookbackRaw) && lookbackRaw > 0) {
    query.set("lookback", String(Math.round(lookbackRaw)));
  }

  return `/api/finance-analysis/export?${query.toString()}`;
}

function MessageBlockView({
  block,
  financeExportUrl,
}: {
  block: AssistantMessageBlock;
  financeExportUrl?: string | null;
}) {
  if (!block) return null;

  if (block.type === "text") {
    const isDiagnostics = typeof block.title === "string" && block.title.toLowerCase().includes("diagnostic");
    return (
      <div
        className={cn(
          "rounded-lg border p-3",
          isDiagnostics
            ? "border-amber-300/80 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-900/20"
            : "border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/30"
        )}
      >
        {block.title && (
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            {block.title}
          </p>
        )}
        <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{block.content}</p>
      </div>
    );
  }

  if (block.type === "chart") {
    return <ChartBlockView block={block} />;
  }

  if (block.type !== "table") return null;

  const numericColumns = detectNumericColumns(block.rows);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/35 shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-200/70 dark:border-gray-700/70 bg-gray-50/80 dark:bg-gray-800/60 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
          {block.title}
        </p>
        {financeExportUrl && (
          <a
            href={financeExportUrl}
            className="inline-flex items-center gap-1 rounded border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <FileDown className="w-3 h-3" />
            Export Excel
          </a>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-xs border-collapse" aria-label={block.title}>
          <caption className="sr-only">{block.title}</caption>
        <thead>
          <tr className="bg-gray-100/70 dark:bg-gray-800/70">
              {block.columns.map((column, columnIndex) => (
              <th
                key={column}
                className={cn(
                  "py-2 px-3 border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 uppercase tracking-wide text-[10px]",
                  numericColumns.has(columnIndex) ? "text-right" : "text-left"
                )}
                scope="col"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={cn(
                  rowIndex % 2 === 0 ? "bg-transparent" : "bg-gray-50/60 dark:bg-gray-800/40",
                  isSummaryLikeRow(row) && "bg-blue-50/70 dark:bg-blue-900/15"
                )}
              >
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                    className={cn(
                      "py-2 px-3 border-b border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-200",
                      numericColumns.has(cellIndex) ? "text-right tabular-nums" : "text-left",
                      getSignedValueTone(cell, block.columns[cellIndex])
                    )}
                >
                    {formatTableCell(cell, block.columns[cellIndex])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {block.note && (
        <p className="px-3 py-2 text-[11px] text-gray-500 dark:text-gray-400 border-t border-gray-200/70 dark:border-gray-700/70">
          {block.note}
        </p>
      )}
    </div>
  );
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const CHART_PADDING = { top: 12, right: 12, bottom: 20, left: 12 };
const MAX_CHART_POINTS = 120;

function ChartBlockView({ block }: { block: Extract<AssistantMessageBlock, { type: "chart" }> }) {
  if (block.chartType === "line") {
    const points = normalizeLineChartPoints(block.points);
    if (points.length === 0) {
      return <EmptyChartState title={block.title} note={block.note} />;
    }

    const values = points.map((point) => point.y);
    let minValue = Math.min(...values);
    let maxValue = Math.max(...values);
    if (minValue === maxValue) {
      const guardBand = Math.max(Math.abs(maxValue) * 0.01, 1);
      minValue -= guardBand;
      maxValue += guardBand;
    }

    const innerWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
    const innerHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
    const xStep = points.length > 1 ? innerWidth / (points.length - 1) : 0;
    const ySpan = maxValue - minValue;
    const scaleY = (value: number) =>
      CHART_PADDING.top + ((maxValue - value) / (ySpan || 1)) * innerHeight;
    const scaleX = (index: number) => CHART_PADDING.left + index * xStep;
    const linePath = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${scaleX(index).toFixed(2)} ${scaleY(point.y).toFixed(2)}`)
      .join(" ");
    const latest = points[points.length - 1];
    const first = points[0];
    const delta = latest.y - first.y;

    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/35 shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-200/70 dark:border-gray-700/70 bg-gray-50/80 dark:bg-gray-800/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
            {block.title}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            {formatChartMetric(latest.y)}
            {delta !== 0 ? ` (${delta > 0 ? "+" : ""}${formatChartMetric(delta)} vs first point)` : ""}
          </p>
        </div>
        <div className="px-2 py-2">
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full h-44" role="img" aria-label={block.title}>
            <line
              x1={CHART_PADDING.left}
              y1={CHART_HEIGHT - CHART_PADDING.bottom}
              x2={CHART_WIDTH - CHART_PADDING.right}
              y2={CHART_HEIGHT - CHART_PADDING.bottom}
              stroke="currentColor"
              className="text-gray-300 dark:text-gray-700"
              strokeWidth={1}
            />
            <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2} />
            <circle cx={scaleX(points.length - 1)} cy={scaleY(latest.y)} r={3} fill="#2563eb" />
          </svg>
          <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
            <span>{first.x}</span>
            <span>{latest.x}</span>
          </div>
        </div>
        {block.note && (
          <p className="px-3 py-2 text-[11px] text-gray-500 dark:text-gray-400 border-t border-gray-200/70 dark:border-gray-700/70">
            {block.note}
          </p>
        )}
      </div>
    );
  }

  const candles = normalizeCandlestickPoints(block.points);
  if (candles.length === 0) {
    return <EmptyChartState title={block.title} note={block.note} />;
  }

  const highs = candles.map((item) => item.high);
  const lows = candles.map((item) => item.low);
  let minValue = Math.min(...lows);
  let maxValue = Math.max(...highs);
  if (minValue === maxValue) {
    const guardBand = Math.max(Math.abs(maxValue) * 0.01, 1);
    minValue -= guardBand;
    maxValue += guardBand;
  }
  const innerWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const innerHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
  const ySpan = maxValue - minValue;
  const step = candles.length > 0 ? innerWidth / candles.length : innerWidth;
  const candleBodyWidth = Math.max(2, Math.min(10, step * 0.58));
  const scaleY = (value: number) =>
    CHART_PADDING.top + ((maxValue - value) / (ySpan || 1)) * innerHeight;
  const latest = candles[candles.length - 1];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/35 shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-200/70 dark:border-gray-700/70 bg-gray-50/80 dark:bg-gray-800/60">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
          {block.title}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
          Latest {latest.x}: O {formatChartMetric(latest.open)}, H {formatChartMetric(latest.high)}, L {formatChartMetric(latest.low)}, C {formatChartMetric(latest.close)}
        </p>
      </div>
      <div className="px-2 py-2">
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full h-44" role="img" aria-label={block.title}>
          <line
            x1={CHART_PADDING.left}
            y1={CHART_HEIGHT - CHART_PADDING.bottom}
            x2={CHART_WIDTH - CHART_PADDING.right}
            y2={CHART_HEIGHT - CHART_PADDING.bottom}
            stroke="currentColor"
            className="text-gray-300 dark:text-gray-700"
            strokeWidth={1}
          />
          {candles.map((candle, index) => {
            const centerX = CHART_PADDING.left + step * index + step * 0.5;
            const highY = scaleY(candle.high);
            const lowY = scaleY(candle.low);
            const openY = scaleY(candle.open);
            const closeY = scaleY(candle.close);
            const topY = Math.min(openY, closeY);
            const bodyHeight = Math.max(1, Math.abs(closeY - openY));
            const isUp = candle.close >= candle.open;
            const color = isUp ? "#10b981" : "#ef4444";
            return (
              <g key={`${candle.x}-${index}`}>
                <line x1={centerX} y1={highY} x2={centerX} y2={lowY} stroke={color} strokeWidth={1} />
                <rect
                  x={centerX - candleBodyWidth / 2}
                  y={topY}
                  width={candleBodyWidth}
                  height={bodyHeight}
                  fill={isUp ? `${color}33` : `${color}55`}
                  stroke={color}
                  strokeWidth={1}
                />
              </g>
            );
          })}
        </svg>
        <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
          <span>{candles[0].x}</span>
          <span>{latest.x}</span>
        </div>
      </div>
      {block.note && (
        <p className="px-3 py-2 text-[11px] text-gray-500 dark:text-gray-400 border-t border-gray-200/70 dark:border-gray-700/70">
          {block.note}
        </p>
      )}
    </div>
  );
}

function EmptyChartState({ title, note }: { title: string; note?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/30 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">{title}</p>
      <p className="text-sm text-gray-700 dark:text-gray-200">No chart data available.</p>
      {note && <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">{note}</p>}
    </div>
  );
}

function normalizeLineChartPoints(
  points: Extract<AssistantMessageBlock, { type: "chart"; chartType: "line" }>["points"]
): Array<{ x: string; y: number }> {
  if (!Array.isArray(points)) return [];
  const normalized: Array<{ x: string; y: number }> = [];
  for (const point of points.slice(-MAX_CHART_POINTS)) {
    const x = typeof point?.x === "string" ? point.x.trim() : "";
    const y = parseChartNumber(point?.y);
    if (!x || y === null) continue;
    normalized.push({ x, y });
  }
  return normalized;
}

function normalizeCandlestickPoints(
  points: Extract<AssistantMessageBlock, { type: "chart"; chartType: "candlestick" }>["points"]
): Array<{ x: string; open: number; high: number; low: number; close: number }> {
  if (!Array.isArray(points)) return [];
  const normalized: Array<{ x: string; open: number; high: number; low: number; close: number }> = [];
  for (const point of points.slice(-MAX_CHART_POINTS)) {
    const x = typeof point?.x === "string" ? point.x.trim() : "";
    const open = parseChartNumber(point?.open);
    const high = parseChartNumber(point?.high);
    const low = parseChartNumber(point?.low);
    const close = parseChartNumber(point?.close);
    if (!x || open === null || high === null || low === null || close === null) continue;
    normalized.push({
      x,
      open,
      high: Math.max(high, open, close, low),
      low: Math.min(low, open, close, high),
      close,
    });
  }
  return normalized;
}

function parseChartNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatChartMetric(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return value.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 });
  }
  if (abs >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

type ContentBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'section'; title: string }
  | { type: 'paragraph'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; lines: string[] }
  | {
      type: 'mdtable';
      headers: string[];
      alignments: Array<'left' | 'center' | 'right'>;
      rows: string[][];
    }
  | { type: 'code'; code: string };

function MessageContent({ content, isUser }: { content: string; isUser: boolean }) {
  const blocks = useMemo(() => parseContentBlocks(content), [content]);

  return (
    <div className="space-y-2 break-words text-sm leading-relaxed">
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          return (
            <pre
              key={`code-${index}`}
              className={cn(
                'overflow-x-auto p-3 rounded-lg text-sm my-2',
                isUser ? 'bg-blue-700/50' : 'bg-gray-100 dark:bg-gray-950'
              )}
            >
              <code>{block.code}</code>
            </pre>
          );
        }

        if (block.type === 'heading') {
          const headingClass =
            block.level === 1 ? 'text-base font-semibold' : block.level === 2 ? 'text-sm font-semibold' : 'text-sm font-medium';
          return (
            <p key={`heading-${index}`} className={cn('mt-2', headingClass)}>
              {renderInline(block.text, isUser)}
            </p>
          );
        }

        if (block.type === 'section') {
          return (
            <div
              key={`section-${index}`}
              className={cn(
                "rounded-lg border px-3 py-2",
                isUser ? "border-blue-300/60 bg-blue-500/20 text-blue-50" : "border-blue-200 dark:border-blue-800/60 bg-blue-50/70 dark:bg-blue-900/20"
              )}
            >
              <p className={cn("text-xs font-semibold uppercase tracking-wide", isUser ? "text-blue-100" : "text-blue-700 dark:text-blue-200")}>
                {block.title}
              </p>
            </div>
          );
        }

        if (block.type === 'ul') {
          return (
            <ul key={`ul-${index}`} className="list-disc pl-5 space-y-1">
              {block.items.map((item, itemIndex) => (
                <li key={`ul-item-${index}-${itemIndex}`}>{renderInline(item, isUser)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === 'ol') {
          return (
            <ol key={`ol-${index}`} className="list-decimal pl-5 space-y-1">
              {block.items.map((item, itemIndex) => (
                <li key={`ol-item-${index}-${itemIndex}`}>{renderInline(item, isUser)}</li>
              ))}
            </ol>
          );
        }

        if (block.type === 'quote') {
          return (
            <blockquote
              key={`quote-${index}`}
              className={cn(
                'border-l-2 pl-3 italic',
                isUser ? 'border-blue-300 text-blue-100' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
              )}
            >
              {block.lines.map((line, lineIndex) => (
                <p key={`quote-line-${index}-${lineIndex}`}>{renderInline(line, isUser)}</p>
              ))}
            </blockquote>
          );
        }

        if (block.type === 'mdtable') {
          return <InlineMarkdownTable key={`mdtable-${index}`} block={block} />;
        }

        return (
          <p key={`paragraph-${index}`}>
            {renderInline(block.text, isUser)}
          </p>
        );
      })}
    </div>
  );
}

function parseContentBlocks(content: string): ContentBlock[] {
  const segments = content.split(/(```[\s\S]*?```)/g).filter((segment) => segment.trim().length > 0);
  const blocks: ContentBlock[] = [];

  for (const segment of segments) {
    if (segment.startsWith('```')) {
      const codeMatch = segment.match(/^```[\w-]*\n?([\s\S]*?)```$/);
      blocks.push({ type: 'code', code: codeMatch ? codeMatch[1] : segment.replace(/```/g, '') });
      continue;
    }

    blocks.push(...parsePlainTextBlocks(segment));
  }

  return blocks;
}

function parsePlainTextBlocks(segment: string): ContentBlock[] {
  const lines = segment.split('\n');
  const blocks: ContentBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index] ?? '';
    const line = rawLine.trim();

    if (!line) {
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 3) as 1 | 2 | 3;
      blocks.push({ type: 'heading', level, text: headingMatch[2].trim() });
      index += 1;
      continue;
    }

    const sectionTitle = parseSectionHeading(line);
    if (sectionTitle) {
      blocks.push({ type: 'section', title: sectionTitle });
      index += 1;
      continue;
    }

    const markdownTable = parseMarkdownTable(lines, index);
    if (markdownTable) {
      blocks.push(markdownTable.block);
      index = markdownTable.nextIndex;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test((lines[index] ?? '').trim())) {
        items.push((lines[index] ?? '').trim().replace(/^[-*]\s+/, '').trim());
        index += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test((lines[index] ?? '').trim())) {
        items.push((lines[index] ?? '').trim().replace(/^\d+\.\s+/, '').trim());
        index += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test((lines[index] ?? '').trim())) {
        quoteLines.push((lines[index] ?? '').trim().replace(/^>\s?/, '').trim());
        index += 1;
      }
      blocks.push({ type: 'quote', lines: quoteLines });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const candidate = (lines[index] ?? '').trim();
      if (!candidate || isStructuredLine(candidate)) break;
      paragraphLines.push(candidate);
      index += 1;
    }
    if (paragraphLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') });
      continue;
    }

    index += 1;
  }

  return blocks;
}

function isStructuredLine(line: string): boolean {
  return (
    /^(#{1,3})\s+/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    /^>\s?/.test(line) ||
    Boolean(parseSectionHeading(line)) ||
    isMarkdownTableStart(line)
  );
}

function InlineMarkdownTable({
  block,
}: {
  block: Extract<ContentBlock, { type: "mdtable" }>;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/35 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-xs border-collapse" aria-label="Assistant markdown table">
          <thead>
            <tr className="bg-gray-100/80 dark:bg-gray-800/70">
              {block.headers.map((header, headerIndex) => (
                <th
                  key={`${header}-${headerIndex}`}
                  className={cn(
                    "py-2 px-3 border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 uppercase tracking-wide text-[10px]",
                    block.alignments[headerIndex] === "right"
                      ? "text-right"
                      : block.alignments[headerIndex] === "center"
                        ? "text-center"
                        : "text-left"
                  )}
                  scope="col"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 0 ? "bg-transparent" : "bg-gray-50/60 dark:bg-gray-800/40"}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={cn(
                      "py-2 px-3 border-b border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-200",
                      block.alignments[cellIndex] === "right"
                        ? "text-right tabular-nums"
                        : block.alignments[cellIndex] === "center"
                          ? "text-center"
                          : "text-left",
                      getSignedValueTone(cell, block.headers[cellIndex])
                    )}
                  >
                    {formatTableCell(cell, block.headers[cellIndex])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function parseSectionHeading(line: string): string | null {
  const trimmed = line.trim().replace(/[:：]\s*$/, "");
  if (!trimmed) return null;
  const normalizedKey = normalizeKeyword(trimmed);
  const modernSectionTitles = new Set([
    "summary",
    "key data",
    "interpretation",
    "limitations",
    "next step",
    "next steps",
    "recommendation",
    "conclusion",
    "tom tat",
    "du lieu chinh",
    "nhan dinh",
    "de xuat",
    "ket luan",
    "han che",
    "khuyen nghi",
  ]);
  if (modernSectionTitles.has(normalizedKey)) return trimmed;
  const normalized = line.trim().replace(/[:：]\s*$/, "");
  if (!normalized) return null;
  const sectionTitles = [
    "summary",
    "key data",
    "interpretation",
    "next steps",
    "recommendation",
    "kết luận",
    "tóm tắt",
    "dữ liệu chính",
    "nhận định",
    "đề xuất",
  ];
  if (sectionTitles.includes(normalized.toLowerCase())) return normalized;
  return null;
}

function parseMarkdownTable(
  lines: string[],
  startIndex: number
): { block: Extract<ContentBlock, { type: "mdtable" }>; nextIndex: number } | null {
  if (startIndex + 1 >= lines.length) return null;
  const headerLine = (lines[startIndex] ?? "").trim();
  const dividerLine = (lines[startIndex + 1] ?? "").trim();
  if (!isMarkdownTableStart(headerLine) || !isMarkdownTableDivider(dividerLine)) return null;

  const headers = splitMarkdownTableRow(headerLine);
  if (headers.length === 0) return null;

  const alignments = splitMarkdownTableRow(dividerLine).map(parseTableAlignment);
  while (alignments.length < headers.length) alignments.push("left");

  const rows: string[][] = [];
  let index = startIndex + 2;
  while (index < lines.length) {
    const rowLine = (lines[index] ?? "").trim();
    if (!isMarkdownTableStart(rowLine)) break;
    const parsedRow = splitMarkdownTableRow(rowLine);
    if (parsedRow.length === 0) break;
    while (parsedRow.length < headers.length) parsedRow.push("");
    rows.push(parsedRow.slice(0, headers.length));
    index += 1;
  }

  if (rows.length === 0) return null;
  return {
    block: { type: "mdtable", headers, alignments: alignments.slice(0, headers.length), rows },
    nextIndex: index,
  };
}

function isMarkdownTableStart(line: string): boolean {
  if (!line.includes("|")) return false;
  const cells = splitMarkdownTableRow(line);
  return cells.length >= 2;
}

function isMarkdownTableDivider(line: string): boolean {
  if (!line.includes("|")) return false;
  const cells = splitMarkdownTableRow(line);
  if (cells.length < 2) return false;
  return cells.every((cell) => /^:?-{2,}:?$/.test(cell.trim()));
}

function splitMarkdownTableRow(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function parseTableAlignment(cell: string): "left" | "center" | "right" {
  const trimmed = cell.trim();
  if (/^:-+:$/.test(trimmed)) return "center";
  if (/^-+:$/.test(trimmed)) return "right";
  return "left";
}

function detectNumericColumns(rows: Array<Array<string | number | null>>): Set<number> {
  const columnScores = new Map<number, { numeric: number; total: number }>();
  for (const row of rows) {
    row.forEach((cell, index) => {
      const score = columnScores.get(index) ?? { numeric: 0, total: 0 };
      score.total += 1;
      if (toNumericValue(cell) !== null) score.numeric += 1;
      columnScores.set(index, score);
    });
  }

  const numericColumns = new Set<number>();
  for (const [index, score] of columnScores.entries()) {
    if (score.total > 0 && score.numeric / score.total >= 0.6) {
      numericColumns.add(index);
    }
  }
  return numericColumns;
}

function formatTableCell(cell: string | number | null, columnLabel?: string): string {
  const percentLike = isPercentLikeColumn(columnLabel);
  if (typeof cell === "number" && Number.isFinite(cell)) {
    return formatNumericValue(cell, percentLike);
  }
  const numericValue = toNumericValue(cell);
  if (numericValue !== null) return formatNumericValue(numericValue, percentLike);
  return String(cell ?? "n/a");
}

function toNumericValue(cell: string | number | null): number | null {
  if (typeof cell === "number" && Number.isFinite(cell)) return cell;
  if (typeof cell !== "string") return null;
  const normalized = cell.replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumericValue(value: number, percentLike: boolean): string {
  if (percentLike) {
    const normalizedPercent = Math.abs(value) <= 1 ? value * 100 : value;
    return `${normalizedPercent.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
  }
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return value.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 });
  }
  if (abs >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function isPercentLikeColumn(columnLabel?: string): boolean {
  if (!columnLabel) return false;
  const normalized = normalizeKeyword(columnLabel);
  return (
    normalized.includes("%") ||
    normalized.includes("pct") ||
    normalized.includes("percent") ||
    normalized.includes("margin") ||
    normalized.includes("ratio") ||
    normalized.includes("return") ||
    normalized.includes("drawdown") ||
    normalized.includes("volatility") ||
    normalized.includes("beta") ||
    normalized.includes("alpha") ||
    normalized.includes("cagr") ||
    normalized.includes("yoy") ||
    normalized.includes("qoq") ||
    normalized.includes("change")
  );
}

function isSignedSignalColumn(columnLabel?: string): boolean {
  if (!columnLabel) return false;
  const normalized = normalizeKeyword(columnLabel);
  return (
    normalized.includes("change") ||
    normalized.includes("return") ||
    normalized.includes("drawdown") ||
    normalized.includes("alpha") ||
    normalized.includes("beta") ||
    normalized.includes("upside") ||
    normalized.includes("downside") ||
    normalized.includes("margin") ||
    normalized.includes("delta") ||
    normalized.includes("chenh") ||
    normalized.includes("bien dong")
  );
}

function getSignedValueTone(cell: string | number | null, columnLabel?: string): string {
  if (!isSignedSignalColumn(columnLabel)) return "";
  const value = toNumericValue(cell);
  if (value === null || value === 0) return "";
  if (value > 0) return "text-emerald-700 dark:text-emerald-300";
  return "text-red-700 dark:text-red-300";
}

function normalizeKeyword(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function isSummaryLikeRow(row: Array<string | number | null>): boolean {
  if (row.length === 0) return false;
  const normalizedLabel = normalizeKeyword(String(row[0] ?? ""));
  if (
    normalizedLabel.includes("summary") ||
    normalizedLabel.includes("total") ||
    normalizedLabel.includes("average") ||
    normalizedLabel.includes("median") ||
    normalizedLabel.includes("tong") ||
    normalizedLabel.includes("ket luan")
  ) {
    return true;
  }
  const label = String(row[0] ?? "").toLowerCase();
  return (
    label.includes("summary") ||
    label.includes("total") ||
    label.includes("average") ||
    label.includes("median") ||
    label.includes("tổng") ||
    label.includes("kết luận")
  );
}

function renderInline(line: string, isUser: boolean): ReactNode {
  if (!line) return '';

  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = 0;

  for (const match of line.matchAll(tokenRegex)) {
    const token = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      nodes.push(line.slice(lastIndex, index));
    }

    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={`bold-${matchIndex}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={`code-${matchIndex}`}
          className={cn(
            'px-1.5 py-0.5 rounded text-sm',
            isUser ? 'bg-blue-700/50' : 'bg-gray-200 dark:bg-gray-700'
          )}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <a
            key={`link-${matchIndex}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "underline underline-offset-2",
              isUser ? "text-blue-100" : "text-blue-600 dark:text-blue-300"
            )}
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(token);
    }

    lastIndex = index + token.length;
    matchIndex += 1;
  }

  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }

  if (nodes.length === 0) return line;
  if (nodes.length === 1) return nodes[0];
  return <>{nodes}</>;
}

function formatTime(timestamp: Date | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
