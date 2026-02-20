function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function toStatusCode(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function collectStatusCodes(statuses) {
  if (!Array.isArray(statuses)) return [];
  const normalized = [];
  for (const status of statuses) {
    const code = toStatusCode(status);
    if (code !== null) normalized.push(code);
  }
  return normalized;
}

function matchesAny(text, needles) {
  return needles.some((needle) => text.includes(needle));
}

function classifyFailureCause(input = {}) {
  const statusCodes = collectStatusCodes(input.statuses ?? [input.status]);
  const joinedText = [
    input.reason,
    input.error,
    ...(Array.isArray(input.failures) ? input.failures : []),
    ...(Array.isArray(input.validationErrors) ? input.validationErrors : []),
  ]
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0)
    .join(" | ");
  const text = normalizeText(joinedText);

  const hasStatus = (code) => statusCodes.includes(code);
  const hasStatusInRange = (from, to) => statusCodes.some((code) => code >= from && code <= to);

  if (hasStatus(401) || hasStatus(403)) {
    return { category: "auth", code: "http_auth_denied", detail: joinedText || "auth denied" };
  }
  if (
    matchesAny(text, [
      "unauthorized",
      "forbidden",
      "invalid token",
      "missing token",
      "auth token",
      "x-assistant-eval-token",
      "api key",
      "authentication",
      "authorization",
    ])
  ) {
    return { category: "auth", code: "auth_signal", detail: joinedText || "authentication signal" };
  }

  if (
    matchesAny(text, [
      "dry_run_report_in_ci",
      "dry-run is blocked in ci mode",
      "skipped_report_in_ci",
      "unknown suite",
      "missing_round_status",
      "invalid threshold",
      "invalid_config",
      "reportpath is required in ci mode",
      "report_write_failed",
      "report_write_skipped in ci mode",
      "no suites selected",
      "missing report path",
      "config",
    ]) ||
    hasStatus(404)
  ) {
    return { category: "config", code: "config_signal", detail: joinedText || "configuration signal" };
  }

  if (
    hasStatus(408) ||
    hasStatus(425) ||
    hasStatus(429) ||
    hasStatusInRange(500, 599) ||
    matchesAny(text, [
      "fetch failed",
      "network",
      "timeout",
      "timed out",
      "aborted",
      "econnrefused",
      "eai_again",
      "enotfound",
      "service unavailable",
      "missing_report_file",
      "malformed_report_json",
      "report_not_json_object",
      "rate limit",
      "retryable",
      "runtime",
    ])
  ) {
    return { category: "runtime", code: "runtime_signal", detail: joinedText || "runtime signal" };
  }

  if (statusCodes.length > 0 || text.length > 0) {
    return { category: "assertion", code: "gate_assertion_failed", detail: joinedText || "gate assertion failed" };
  }

  return { category: "unknown", code: "unknown_failure", detail: "unknown failure" };
}

function summarizeFailureCategories(entries = [], categoryField = "failureCategory") {
  const summary = {
    auth: 0,
    config: 0,
    runtime: 0,
    assertion: 0,
    unknown: 0,
  };
  for (const entry of entries) {
    if (!entry) continue;
    const key = String(entry[categoryField] ?? "unknown");
    if (!(key in summary)) {
      summary.unknown += 1;
      continue;
    }
    summary[key] += 1;
  }
  return summary;
}

function extractStatusesFromResults(results) {
  if (!Array.isArray(results)) return [];
  const statuses = [];
  for (const item of results) {
    const code = toStatusCode(item?.status);
    if (code !== null) statuses.push(code);
  }
  return statuses;
}

export {
  classifyFailureCause,
  extractStatusesFromResults,
  summarizeFailureCategories,
};
