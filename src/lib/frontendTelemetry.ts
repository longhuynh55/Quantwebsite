type UiLogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<UiLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LEVEL = resolveUiLogLevel();

export function logUiEvent(level: UiLogLevel, event: string, context: Record<string, unknown> = {}): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[MIN_LEVEL]) return;
  const payload = {
    ts: new Date().toISOString(),
    scope: "ui.assistant",
    level,
    event,
    ...context,
  };
  const text = safeSerialize(payload);
  if (level === "error") {
    console.error(text);
    return;
  }
  if (level === "warn") {
    console.warn(text);
    return;
  }
  if (level === "debug") {
    console.debug(text);
    return;
  }
  console.info(text);
}

function safeSerialize(value: unknown): string {
  try {
    return JSON.stringify(value, createSafeReplacer());
  } catch (error) {
    return JSON.stringify({
      ts: new Date().toISOString(),
      scope: "ui.assistant",
      level: "error",
      event: "assistant.telemetry.serialization_failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function createSafeReplacer(): (this: unknown, key: string, value: unknown) => unknown {
  const seen = new WeakSet<object>();
  return (_key: string, current: unknown): unknown => {
    if (typeof current === "bigint") {
      return current.toString();
    }
    if (current instanceof Error) {
      return {
        name: current.name,
        message: current.message,
        stack: current.stack,
      };
    }
    if (typeof current === "function") {
      return "[Function]";
    }
    if (typeof current === "symbol") {
      return current.toString();
    }
    if (typeof current === "object" && current !== null) {
      if (seen.has(current)) {
        return "[Circular]";
      }
      seen.add(current);
    }
    return current;
  };
}

function resolveUiLogLevel(): UiLogLevel {
  const raw = String(process.env.NEXT_PUBLIC_LOG_LEVEL ?? "info").trim().toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}
