import fs from "node:fs";
import path from "node:path";

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function listFiles(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).map((name) => path.join(dir, name));
}

function fail(message) {
  console.error(`KB LINT FAIL: ${message}`);
  process.exitCode = 1;
}

function warn(message) {
  console.warn(`KB LINT WARN: ${message}`);
}

const root = process.cwd();
const kbDir = path.join(root, "docs", "thesis", "_internal");
const modulesDir = path.join(kbDir, "modules");

const requiredFiles = [
  path.join(kbDir, "kb_index.md"),
  path.join(kbDir, "functional_map.yml"),
  path.join(kbDir, "business_rules.yml"),
  path.join(kbDir, "workflows.yml"),
  path.join(kbDir, "glossary.yml"),
  path.join(kbDir, "non_claims.yml"),
  path.join(kbDir, "evidence_map.yml"),
];

for (const filePath of requiredFiles) {
  if (!exists(filePath)) {
    fail(`Missing required KB file: ${path.relative(root, filePath)}`);
  }
}

if (!exists(modulesDir)) {
  fail(`Missing modules directory: ${path.relative(root, modulesDir)}`);
} else {
  const templatePath = path.join(modulesDir, "_TEMPLATE.md");
  if (!exists(templatePath)) {
    warn(`Missing module template: ${path.relative(root, templatePath)}`);
  }
}

// Extract module ids from functional_map.yml without a YAML parser.
const functionalMapPath = path.join(kbDir, "functional_map.yml");
const functionalMapText = readText(functionalMapPath);
const idMatches = [...functionalMapText.matchAll(/^\s*-\s*id:\s*([a-z0-9_]+)\s*$/gim)];
const moduleIds = idMatches.map((m) => m[1]);

if (moduleIds.length === 0) {
  fail(`Could not find any module ids in ${path.relative(root, functionalMapPath)}`);
}

const expectedModuleDocs = moduleIds.map((id) => path.join(modulesDir, `${id}.md`));
for (const docPath of expectedModuleDocs) {
  if (!exists(docPath)) {
    fail(`Missing module doc: ${path.relative(root, docPath)}`);
    continue;
  }
  const text = readText(docPath);
  const requiredHeadings = [
    "## Purpose",
    "## User Stories",
    "## Inputs And Controls",
    "## Outputs And Evidence Artifacts",
    "## Business Rules And Guardrails",
    "## Failure Modes",
    "## Dependencies (Conceptual)",
    "## UI Evidence (Chapter 4)",
    "## Internal Evidence Pointers (Do Not Cite In Thesis Body)",
  ];
  for (const heading of requiredHeadings) {
    if (!text.includes(heading)) {
      fail(`${path.relative(root, docPath)} missing heading: ${heading}`);
      break;
    }
  }
}

// Ensure there are no obvious mojibake sequences in KB files.
const mojibakePatterns = ["â€œ", "â€\u009d", "â€™", "â€”", "Ã©", "Ã "];
for (const filePath of [...requiredFiles, ...expectedModuleDocs]) {
  if (!exists(filePath)) continue;
  const text = readText(filePath);
  for (const pat of mojibakePatterns) {
    if (text.includes(pat)) {
      warn(`${path.relative(root, filePath)} contains possible encoding artifact: ${JSON.stringify(pat)}`);
      break;
    }
  }
}

// Detect unexpected module docs (not referenced in functional_map).
const moduleDocFiles = listFiles(modulesDir)
  .filter((p) => p.endsWith(".md"))
  .map((p) => path.basename(p));

for (const name of moduleDocFiles) {
  if (name === "_TEMPLATE.md") continue;
  if (!name.endsWith(".md")) continue;
  const id = name.slice(0, -3);
  if (!moduleIds.includes(id)) {
    warn(`Module doc not referenced in functional_map.yml: ${path.relative(root, path.join(modulesDir, name))}`);
  }
}

if (!process.exitCode) {
  console.log("KB LINT OK");
}

