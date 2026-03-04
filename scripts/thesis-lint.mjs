import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function listFiles(relDir) {
  const abs = path.join(ROOT, relDir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).map((name) => path.join(relDir, name));
}

function splitReferences(md) {
  const idx = md.indexOf("\n## References");
  if (idx === -1) return { body: md, references: "" };
  return {
    body: md.slice(0, idx),
    references: md.slice(idx),
  };
}

function extractFigureNumbers(mdBody) {
  const out = new Set();
  const re = /\bFigure\s+(\d+\.\d+)\b/g;
  for (const match of mdBody.matchAll(re)) out.add(match[1]);
  return [...out].sort();
}

function extractNarrativeCitations(mdBody) {
  // Matches "Surname (2020)" or "Surname et al. (2020)".
  const out = [];
  const re = /\b([A-Z][A-Za-z.'-]+(?:\s+et\s+al\.)?)\s*\(((?:19|20)\d{2}[a-z]?)\)/g;
  for (const match of mdBody.matchAll(re)) {
    out.push({ surname: match[1], year: match[2], raw: match[0] });
  }
  return out;
}

function extractParentheticalCitations(mdBody) {
  // Parses "(A, 2020; B et al., 2021)" into {surname, year}.
  const out = [];
  const parenRe = /\(([^()]*?(?:19|20)\d{2}[a-z]?[^()]*)\)/g;
  for (const m of mdBody.matchAll(parenRe)) {
    const inside = m[1];
    const parts = inside.split(";").map((p) => p.trim());
    for (const part of parts) {
      // Ignore non-APA bits that lack a year.
      const yearMatch = part.match(/\b((?:19|20)\d{2}[a-z]?)\b/);
      if (!yearMatch) continue;
      const year = yearMatch[1];
      const beforeYear = part.slice(0, yearMatch.index ?? 0).trim();
      // Surname is usually the last token before the comma preceding the year.
      // Example: "Fama & French, " -> "Fama"
      const surname = beforeYear.split(",")[0].trim().split(/\s+/)[0];
      if (!surname) continue;
      out.push({ surname, year, raw: `(${part})` });
    }
  }
  return out;
}

function dedupeCitations(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const normSurname = String(it.surname ?? "")
      .trim()
      .replace(/\s+et\s+al\.\s*$/i, "")
      .split(/\s+/)[0];
    const key = `${normSurname.toLowerCase()}|${String(it.year ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...it, surname: normSurname || it.surname });
  }
  return out;
}

function referencesContain(refBlock, citation) {
  const s = citation.surname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const y = citation.year.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${s}[^\\n]*\\(${y}\\)`, "i");
  return re.test(refBlock);
}

function parseFigureCatalog() {
  const files = listFiles("docs/thesis/figures").filter((p) => path.basename(p).startsWith("fig_") && p.endsWith(".md"));
  const map = new Map(); // "3.1" -> { md, mmd }
  for (const mdPath of files) {
    const md = readText(mdPath);
    const header = md.split("\n")[0] ?? "";
    const numMatch = header.match(/Figure\s+(\d+\.\d+)/);
    if (!numMatch) continue;
    const num = numMatch[1];
    const base = path.basename(mdPath, ".md");
    const mmdPath = `docs/thesis/figures/_mmd/${base}.mmd`;
    const hasMermaid = /```mermaid[\s\S]*?```/m.test(md);
    map.set(num, { md: mdPath, mmd: mmdPath, hasMermaid });
  }
  return map;
}

function parseListOfFigures() {
  const md = readText("docs/thesis/THESIS_5CH_FULL.md");
  const nums = new Set();
  const re = /^\-\s+Figure\s+(\d+\.\d+)\:/gm;
  for (const m of md.matchAll(re)) nums.add(m[1]);
  return nums;
}

function lintChapter(chapterPath, figureCatalog) {
  const md = readText(chapterPath);
  const { body, references } = splitReferences(md);
  const errors = [];
  const warnings = [];

  if (!references.trim()) {
    errors.push(`Missing "## References" section in ${chapterPath}`);
  }

  const citations = dedupeCitations([...extractNarrativeCitations(body), ...extractParentheticalCitations(body)]);
  for (const c of citations) {
    if (!referencesContain(references, c)) {
      warnings.push(`Citation not found in References (${chapterPath}): ${c.surname} (${c.year}) from ${c.raw}`);
    }
  }

  const figNums = extractFigureNumbers(body);
  for (const n of figNums) {
    if (!figureCatalog.has(n)) {
      errors.push(`Referenced figure missing from catalog (${chapterPath}): Figure ${n}`);
    }
  }

  return { errors, warnings, figures: figNums, citations };
}

function main() {
  const chapters = [
    "docs/thesis/ch1_introduction.md",
    "docs/thesis/ch2_literature_review.md",
    "docs/thesis/ch3_system_design_and_methodology.md",
    "docs/thesis/ch4_implementation_and_results.md",
    "docs/thesis/ch5_conclusion_and_future_work.md",
  ].filter((p) => exists(p));

  const figureCatalog = parseFigureCatalog();
  const listOfFigures = parseListOfFigures();

  const allErrors = [];
  const allWarnings = [];
  const referencedFigures = new Set();

  for (const ch of chapters) {
    const { errors, warnings, figures } = lintChapter(ch, figureCatalog);
    allErrors.push(...errors);
    allWarnings.push(...warnings);
    for (const f of figures) referencedFigures.add(f);
  }

  // Ensure each cataloged figure has a canonical .mmd source.
  for (const [num, entry] of figureCatalog.entries()) {
    if (entry.hasMermaid && !exists(entry.mmd)) {
      allErrors.push(`Figure ${num} missing canonical Mermaid source: ${entry.mmd}`);
    }
  }

  // Ensure all referenced figures are listed in THESIS_5CH_FULL.md.
  for (const f of referencedFigures) {
    if (!listOfFigures.has(f)) {
      allWarnings.push(`Figure referenced in chapters but missing from List of Figures: Figure ${f}`);
    }
  }

  // Detect stale presentation pack patterns (non-fatal).
  if (exists("docs/thesis/PRESENTATION_FIGURES.md")) {
    const pack = readText("docs/thesis/PRESENTATION_FIGURES.md");
    const isAutoGenerated = /auto-generated from `docs\/thesis\/figures\/_mmd/i.test(pack);
    const stale = /(\/api\/|src\/|Next\.js|App Router)/i.test(pack);
    if (!isAutoGenerated && stale) {
      allWarnings.push("PRESENTATION_FIGURES.md appears stale (engineering-heavy labels). Regenerate via pnpm run thesis:figures:pack.");
    }
  }

  for (const w of allWarnings) console.warn(`WARN: ${w}`);
  for (const e of allErrors) console.error(`ERROR: ${e}`);

  if (allErrors.length > 0) process.exit(2);
  if (allWarnings.length > 0) process.exit(1);
  console.log("OK: thesis lint passed (no errors/warnings).");
}

main();
