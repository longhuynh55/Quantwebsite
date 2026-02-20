export type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LOG_LEVEL = resolveLogLevel();
const LOG_PRETTY = parseBoolean(process.env.LOG_PRETTY, false);
const LOG_INCLUDE_STACK = parseBoolean(process.env.LOG_INCLUDE_STACK, false);
const SENSITIVE_KEY_PATTERN = /(authorization|api[_-]?key|token|secret|password|cookie|set-cookie)/i;

export interface AppLogger {
  debug: (event: string, context?: LogContext) => void;
  info: (event: string, context?: LogContext) => void;
  warn: (event: string, context?: LogContext) => void;
  error: (event: string, context?: LogContext) => void;
  child: (context: LogContext) => AppLogger;
}

export function createLogger(scope: string, baseContext: LogContext = {}): AppLogger {
  const emit = (level: LogLevel, event: string, context?: LogContext) => {
    if (!shouldLog(level)) return;

    const payload = {
      ts: new Date().toISOString(),
      level,
      scope,
      event,
      ...sanitizeContext(baseContext),
      ...sanitizeContext(context ?? {}),
    };

    if (LOG_PRETTY) {
      const message = `[${payload.ts}] ${payload.level.toUpperCase()} ${payload.scope} ${payload.event}`;
      logToConsole(level, message, payload);
      return;
    }

    logToConsole(level, JSON.stringify(payload));
  };

  return {
    debug: (event, context) => emit("debug", event, context),
    info: (event, context) => emit("info", event, context),
    warn: (event, context) => emit("warn", event, context),
    error: (event, context) => emit("error", event, context),
    child: (context) => createLogger(scope, { ...baseContext, ...context }),
  };
}

export function createTraceId(prefix: string = "req"): string {
  const safePrefix = String(prefix || "req")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "")
    .slice(0, 20) || "req";
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${safePrefix}-${timestamp}-${random}`;
}

export function hashText(input: string): string {
  // FNV-1a 32-bit for lightweight log digesting (not cryptographic).
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function digestUnknown(input: unknown): string {
  try {
    return hashText(JSON.stringify(input));
  } catch {
    return hashText(String(input));
  }
}

export function toErrorMeta(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      ...(LOG_INCLUDE_STACK && error.stack ? { errorStack: error.stack } : {}),
    };
  }

  return {
    errorMessage: String(error),
  };
}

function resolveLogLevel(): LogLevel {
  const raw = String(process.env.LOG_LEVEL ?? "info").trim().toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LOG_LEVEL];
}

function sanitizeContext(context: LogContext): LogContext {
  const entries = Object.entries(context);
  const output: LogContext = {};
  for (const [key, value] of entries) {
    output[key] = sanitizeValue(key, value, 0);
  }
  return output;
}

function sanitizeValue(key: string, value: unknown, depth: number): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return "[REDACTED]";
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (depth >= 4) {
    return "[TRUNCATED]";
  }
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => sanitizeValue(key, item, depth + 1));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const nested: Record<string, unknown> = {};
    for (const [nestedKey, nestedValue] of Object.entries(record)) {
      nested[nestedKey] = sanitizeValue(nestedKey, nestedValue, depth + 1);
    }
    return nested;
  }
  return String(value);
}

function logToConsole(level: LogLevel, message: string, payload?: unknown): void {
  if (typeof window === "undefined" && typeof process !== "undefined") {
    const suffix =
      payload === undefined
        ? ""
        : ` ${typeof payload === "string" ? payload : safeStringify(payload)}`;
    const line = `${message}${suffix}\n`;
    if (level === "error" || level === "warn") {
      process.stderr.write(line);
      return;
    }
    process.stdout.write(line);
    return;
  }

  if (level === "error") {
    if (payload !== undefined) {
      console.error(message, payload);
      return;
    }
    console.error(message);
    return;
  }
  if (level === "warn") {
    if (payload !== undefined) {
      console.warn(message, payload);
      return;
    }
    console.warn(message);
    return;
  }
  if (level === "debug") {
    if (payload !== undefined) {
      console.log(message, payload);
      return;
    }
    console.log(message);
    return;
  }
  if (payload !== undefined) {
    console.log(message, payload);
    return;
  }
  console.log(message);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
