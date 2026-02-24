function parseOptionalBoolean(raw: string | undefined): boolean | null {
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

/**
 * Enable low-memory safeguards for production-like CSV deployments.
 *
 * In production CSV mode, full OHLCV-map scans can exceed small container limits
 * and crash the process. We keep the safe mode on even when explicitly disabled.
 */
export function isLowMemoryModeEnabled(): boolean {
  const explicit = parseOptionalBoolean(process.env.DATA_LOW_MEMORY_MODE);
  const nodeEnv = String(process.env.NODE_ENV ?? "").trim().toLowerCase();
  const backend = String(process.env.DATA_BACKEND ?? "auto").trim().toLowerCase();
  const isProduction = nodeEnv === "production";
  const csvBackend = backend === "csv";

  if (explicit === true) return true;

  if (explicit === false) {
    if (isProduction && csvBackend) {
      console.warn(
        "[runtime-mode] DATA_LOW_MEMORY_MODE=false ignored for production CSV backend to prevent OOM."
      );
      return true;
    }
    return false;
  }

  if (isProduction) return true;
  return false;
}
