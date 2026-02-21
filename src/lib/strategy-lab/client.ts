import type {
  StrategyLabCreateRunAccepted,
  StrategyLabCreateRunRequest,
  StrategyLabRunRecord,
  StrategyLabRunSummary,
} from "@/lib/strategy-lab/contracts";

const TERMINAL_RUN_STATUSES = new Set(["succeeded", "failed", "cancelled"]);

interface StrategyLabApiErrorPayload {
  code?: string;
  message?: string;
  details?: unknown;
}

interface StrategyLabApiErrorEnvelope {
  ok?: false;
  error?: StrategyLabApiErrorPayload;
}

interface StrategyLabApiSuccessEnvelope<TData> {
  ok: true;
  data: TData;
}

export interface StrategyLabSummaryResult {
  runId: string;
  status: StrategyLabRunRecord["status"];
  symbol: string;
  strategyType: string;
  strategyName: string;
  initialCapital: number;
  generatedAt: string;
  summary: StrategyLabRunSummary;
}

export class StrategyLabClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(input: {
    code: string;
    status: number;
    message: string;
    details?: unknown;
  }) {
    super(input.message);
    this.code = input.code;
    this.status = input.status;
    this.details = input.details;
  }
}

interface WaitForTerminalOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
  onStatusChange?: (run: StrategyLabRunRecord) => void;
  signal?: AbortSignal;
  sleep?: (ms: number) => Promise<void>;
}

function parsePayloadFromResponse(response: Response, payload: unknown): never {
  const envelope = payload as StrategyLabApiErrorEnvelope;
  const code = envelope?.error?.code ?? "INTERNAL_ERROR";
  const message =
    envelope?.error?.message ??
    `Strategy Lab request failed with status ${response.status}.`;
  throw new StrategyLabClientError({
    code,
    status: response.status,
    message,
    details: envelope?.error?.details,
  });
}

async function readJsonOrNull(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function requestStrategyLab<TData>(
  input: string,
  init?: RequestInit
): Promise<TData> {
  const response = await fetch(input, init);
  const payload = await readJsonOrNull(response);
  const success = payload as StrategyLabApiSuccessEnvelope<TData>;

  if (!response.ok || !success?.ok) {
    parsePayloadFromResponse(response, payload);
  }

  if (typeof success.data === "undefined") {
    throw new StrategyLabClientError({
      code: "INTERNAL_ERROR",
      status: response.status,
      message: "Strategy Lab response is missing data.",
    });
  }

  return success.data;
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(
        new StrategyLabClientError({
          code: "ABORTED",
          status: 499,
          message: "Request was aborted.",
        })
      );
      return;
    }

    const timeoutId = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeoutId);
      cleanup();
      reject(
        new StrategyLabClientError({
          code: "ABORTED",
          status: 499,
          message: "Request was aborted.",
        })
      );
    };

    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort);
  });
}

export async function createStrategyLabRunClient(
  payload: StrategyLabCreateRunRequest
): Promise<StrategyLabCreateRunAccepted> {
  return requestStrategyLab<StrategyLabCreateRunAccepted>("/api/strategy-lab/runs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function getStrategyLabRunClient(
  runId: string
): Promise<StrategyLabRunRecord> {
  return requestStrategyLab<StrategyLabRunRecord>(`/api/strategy-lab/runs/${runId}`);
}

export async function getStrategyLabRunSummaryClient(
  runId: string
): Promise<StrategyLabSummaryResult> {
  return requestStrategyLab<StrategyLabSummaryResult>(
    `/api/strategy-lab/runs/${runId}/result?include=summary`
  );
}

export async function cancelStrategyLabRunClient(
  runId: string
): Promise<StrategyLabRunRecord> {
  return requestStrategyLab<StrategyLabRunRecord>(
    `/api/strategy-lab/runs/${runId}/cancel`,
    {
      method: "POST",
    }
  );
}

export async function waitForStrategyLabRunTerminal(
  runId: string,
  options?: WaitForTerminalOptions
): Promise<StrategyLabRunRecord> {
  const startedAt = Date.now();
  const pollIntervalMs = options?.pollIntervalMs ?? 1000;
  const timeoutMs = options?.timeoutMs ?? 90_000;
  const sleep = options?.sleep ?? ((ms: number) => defaultSleep(ms, options?.signal));
  let latestStatus: string | null = null;

  while (Date.now() - startedAt <= timeoutMs) {
    if (options?.signal?.aborted) {
      throw new StrategyLabClientError({
        code: "ABORTED",
        status: 499,
        message: "Request was aborted.",
      });
    }

    const run = await getStrategyLabRunClient(runId);
    if (run.status !== latestStatus) {
      latestStatus = run.status;
      options?.onStatusChange?.(run);
    }
    if (TERMINAL_RUN_STATUSES.has(run.status)) {
      return run;
    }
    await sleep(pollIntervalMs);
  }

  throw new StrategyLabClientError({
    code: "TIMEOUT",
    status: 408,
    message: `Run ${runId} did not finish within ${timeoutMs}ms.`,
  });
}
