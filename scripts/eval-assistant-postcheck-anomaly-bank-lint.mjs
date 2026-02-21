import fs from "node:fs";
import path from "node:path";
import {
  postcheckAnomalyBankV1,
  POSTCHECK_ANOMALY_BANK_V1_VERSION,
} from "./assistant-postcheck-anomaly-bank-v1.mjs";

function fail(message) {
  throw new Error(message);
}

function ensure(condition, message) {
  if (!condition) fail(message);
}

function countBy(items, key) {
  const out = new Map();
  for (const item of items) {
    const value = item?.[key] ?? "unknown";
    out.set(value, (out.get(value) ?? 0) + 1);
  }
  return out;
}

function toObject(map) {
  const out = {};
  for (const [key, value] of map.entries()) out[String(key)] = value;
  return out;
}

function getExpectedAt(item, turnIndex = null) {
  if (item.mode === "multi_turn") {
    const turn = Array.isArray(item.turns) ? item.turns[turnIndex ?? 0] : null;
    return turn?.expected ?? {};
  }
  return item.expected ?? {};
}

function run() {
  const bank = Array.isArray(postcheckAnomalyBankV1) ? postcheckAnomalyBankV1 : [];
  ensure(bank.length >= 20, `expected >= 20 scenarios, got ${bank.length}`);

  const ids = bank.map((item) => item?.id).filter(Boolean);
  ensure(new Set(ids).size === ids.length, "duplicate scenario IDs detected");
  ensure(bank.every((item) => item.hoseOnly === true), "all scenarios must be HOSE-only");

  const requiredCategories = [
    "parser_noise",
    "conflicting_filters",
    "timeline_anomaly",
    "non_hose_scope_guard",
    "symbol_hallucination",
    "fabrication_injection",
    "output_format_contract",
    "citation_integrity",
    "rate_limit_resilience",
    "provider_degradation",
    "multi_turn_context_drift",
    "policy_boundary_followup",
    "scope_guard_followup",
  ];
  const categories = new Set(bank.map((item) => String(item.category ?? "").trim()).filter(Boolean));
  for (const category of requiredCategories) {
    ensure(categories.has(category), `missing required category: ${category}`);
  }

  const modeCount = countBy(bank, "mode");
  ensure((modeCount.get("multi_turn") ?? 0) >= 4, "must include >= 4 multi-turn anomaly scenarios");
  ensure((modeCount.get("single_turn") ?? 0) >= 12, "must include >= 12 single-turn anomaly scenarios");

  const phaseCount = countBy(bank, "phase");
  ensure((phaseCount.get("canary") ?? 0) >= 4, "must include >= 4 canary scenarios");
  ensure((phaseCount.get("regression") ?? 0) >= 8, "must include >= 8 regression scenarios");
  ensure((phaseCount.get("nightly") ?? 0) >= 4, "must include >= 4 nightly scenarios");

  let forbiddenCount = 0;
  let conditionalCount = 0;
  let requiredCount = 0;
  for (const item of bank) {
    if (item.mode === "multi_turn") {
      const turns = Array.isArray(item.turns) ? item.turns : [];
      ensure(turns.length >= 2, `${item.id}: multi-turn scenario must have at least 2 turns`);
      for (let i = 0; i < turns.length; i += 1) {
        const expected = getExpectedAt(item, i);
        const mode = String(expected?.numericRule?.mode ?? "");
        if (mode === "forbidden") forbiddenCount += 1;
        if (mode === "conditional") conditionalCount += 1;
        if (mode === "required") requiredCount += 1;
      }
      continue;
    }
    const expected = getExpectedAt(item);
    const mode = String(expected?.numericRule?.mode ?? "");
    if (mode === "forbidden") forbiddenCount += 1;
    if (mode === "conditional") conditionalCount += 1;
    if (mode === "required") requiredCount += 1;
  }

  ensure(forbiddenCount >= 8, `forbidden numeric-rule coverage too low: ${forbiddenCount}`);
  ensure(conditionalCount >= 8, `conditional numeric-rule coverage too low: ${conditionalCount}`);
  ensure(requiredCount >= 6, `required numeric-rule coverage too low: ${requiredCount}`);

  const missingPrompt = bank.filter((item) => {
    if (item.mode === "multi_turn") {
      const turns = Array.isArray(item.turns) ? item.turns : [];
      return turns.some((turn) => String(turn?.prompt ?? "").trim().length < 6);
    }
    return String(item?.prompt ?? "").trim().length < 6;
  });
  ensure(missingPrompt.length === 0, "all scenarios/turns must have non-trivial prompts");

  const summary = {
    schemaVersion: "assistant-postcheck-anomaly-bank-v1-lint-2026-02-20",
    questionBankVersion: POSTCHECK_ANOMALY_BANK_V1_VERSION,
    generatedAt: new Date().toISOString(),
    totals: {
      scenarios: bank.length,
      byMode: toObject(modeCount),
      byPhase: toObject(phaseCount),
      categories: Array.from(categories).sort(),
      numericRule: {
        required: requiredCount,
        conditional: conditionalCount,
        forbidden: forbiddenCount,
      },
    },
    status: "pass",
  };

  const outputPath = path.resolve(process.cwd(), "artifacts/assistant-postcheck-anomaly-bank-v1-lint.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log("Postcheck anomaly bank v1 lint passed.");
  console.log(`Report: ${outputPath}`);
}

try {
  run();
} catch (error) {
  console.error(`Postcheck anomaly bank v1 lint failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

