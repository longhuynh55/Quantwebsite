import fs from "node:fs";
import path from "node:path";
import { questionBankV21, QUESTION_BANK_V21_VERSION } from "./assistant-question-bank-v2_1.mjs";

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

function run() {
  const bank = Array.isArray(questionBankV21) ? questionBankV21 : [];

  ensure(bank.length === 48, `expected 48 prompts, got ${bank.length}`);

  const ids = bank.map((item) => item.id);
  const uniqueIds = new Set(ids);
  ensure(uniqueIds.size === bank.length, "duplicate prompt IDs detected");

  const byLevel = countBy(bank, "level");
  ensure((byLevel.get("basic") ?? 0) === 12, "basic level must have 12 prompts");
  ensure((byLevel.get("intermediate") ?? 0) === 12, "intermediate level must have 12 prompts");
  ensure((byLevel.get("hard") ?? 0) === 12, "hard level must have 12 prompts");
  ensure((byLevel.get("adversarial") ?? 0) === 12, "adversarial level must have 12 prompts");

  const allHoseOnly = bank.every((item) => item.hoseOnly === true);
  ensure(allHoseOnly, "all prompts must be HOSE-only");

  const bsIsCfCount = bank.filter((item) => item.bsIsCfRequired === true).length;
  ensure(bsIsCfCount >= 20, `bs+is+cf prompts too low: ${bsIsCfCount}`);

  const requiredEdgeTags = [
    "ipo_during_period",
    "delisted_or_suspended",
    "non_trading_day",
    "multi_symbol_3_5",
    "explicit_date_compare",
    "topk_by_date",
    "small_cap",
    "future_date_trap",
    "non_hose_trap",
    "ambiguous_ticker",
    "fabrication_injection",
  ];

  const presentTags = new Set();
  for (const item of bank) {
    for (const tag of item.edgeTags ?? []) presentTags.add(tag);
  }

  for (const tag of requiredEdgeTags) {
    ensure(presentTags.has(tag), `missing required edgeTag: ${tag}`);
  }

  const forbiddenCount = bank.filter((item) => String(item?.expected?.numericRule?.mode) === "forbidden").length;
  ensure(forbiddenCount >= 8, `forbidden numeric-rule prompts too low: ${forbiddenCount}`);

  const conditionalCount = bank.filter((item) => String(item?.expected?.numericRule?.mode) === "conditional").length;
  ensure(conditionalCount >= 20, `conditional numeric-rule prompts too low: ${conditionalCount}`);

  const requiredCount = bank.filter((item) => String(item?.expected?.numericRule?.mode) === "required").length;
  ensure(requiredCount >= 5, `required numeric-rule prompts too low: ${requiredCount}`);

  const missingOracleType = bank.filter((item) => !String(item?.expected?.oracle?.type ?? "").trim());
  ensure(missingOracleType.length === 0, "all prompts must define expected.oracle.type");

  const missingPrompt = bank.filter((item) => String(item?.prompt ?? "").trim().length < 8);
  ensure(missingPrompt.length === 0, "all prompts must have non-trivial Vietnamese text");

  const summary = {
    schemaVersion: "assistant-question-bank-v2.1-lint-2026-02-19",
    questionBankVersion: QUESTION_BANK_V21_VERSION,
    generatedAt: new Date().toISOString(),
    totals: {
      prompts: bank.length,
      bsIsCfPrompts: bsIsCfCount,
      byLevel: toObject(byLevel),
      numericRule: {
        required: requiredCount,
        conditional: conditionalCount,
        forbidden: forbiddenCount,
      },
      uniqueEdgeTags: Array.from(presentTags).sort(),
    },
    status: "pass",
  };

  const outputPath = path.resolve(process.cwd(), "artifacts/assistant-question-bank-v2_1-lint.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log("Question bank v2.1 lint passed.");
  console.log(`Report: ${outputPath}`);
}

try {
  run();
} catch (error) {
  console.error(`Question bank v2.1 lint failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

