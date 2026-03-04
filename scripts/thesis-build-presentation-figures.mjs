import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function writeText(relPath, value) {
  fs.writeFileSync(path.join(ROOT, relPath), value, "utf8");
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function listFigureMdFiles() {
  const dir = path.join(ROOT, "docs/thesis/figures");
  const items = fs.readdirSync(dir);
  return items
    .filter((name) => name.startsWith("fig_") && name.endsWith(".md"))
    .map((name) => `docs/thesis/figures/${name}`)
    .sort((a, b) => a.localeCompare(b));
}

function parseFigureHeader(md) {
  const line = (md.split("\n")[0] ?? "").trim();
  // Example: "# Figure 3.1: System Context (QuantVN Strategy Forge)"
  if (!line.startsWith("#")) return null;
  return line.replace(/^#+\s*/, "").trim();
}

function parseFigureNumber(header) {
  const m = header.match(/\bFigure\s+(\d+)\.(\d+)\b/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), id: `${m[1]}.${m[2]}` };
}

function sortByFigureNumber(a, b) {
  if (!a.num && !b.num) return a.mdPath.localeCompare(b.mdPath);
  if (!a.num) return 1;
  if (!b.num) return -1;
  if (a.num.major !== b.num.major) return a.num.major - b.num.major;
  if (a.num.minor !== b.num.minor) return a.num.minor - b.num.minor;
  return a.mdPath.localeCompare(b.mdPath);
}

function main() {
  const mdFiles = listFigureMdFiles();
  const figures = [];
  const warnings = [];

  for (const mdPath of mdFiles) {
    const md = readText(mdPath);
    const header = parseFigureHeader(md);
    if (!header) {
      warnings.push(`Missing header in ${mdPath}`);
      continue;
    }
    const num = parseFigureNumber(header);
    const base = path.basename(mdPath, ".md");
    const mmdPath = `docs/thesis/figures/_mmd/${base}.mmd`;
    if (!exists(mmdPath)) {
      warnings.push(`Missing canonical .mmd for ${mdPath}: ${mmdPath}`);
      continue;
    }
    const mmd = readText(mmdPath).trimEnd();
    figures.push({ mdPath, header, num, mmd });
  }

  figures.sort(sortByFigureNumber);

  const out = [];
  out.push("# Presentation Figures (Copy/Paste Pack)");
  out.push("");
  out.push("This file is auto-generated from `docs/thesis/figures/_mmd/*.mmd` and figure headers in `docs/thesis/figures/fig_*.md`.");
  out.push("Do not edit manually; run `pnpm run thesis:figures:pack` to regenerate.");
  out.push("");

  for (const fig of figures) {
    out.push(`## ${fig.header}`);
    out.push("```mermaid");
    out.push(fig.mmd);
    out.push("```");
    out.push("");
  }

  if (warnings.length > 0) {
    out.push("<!-- WARNINGS (generation) -->");
    for (const w of warnings) out.push(`<!-- ${w} -->`);
    out.push("");
  }

  writeText("docs/thesis/PRESENTATION_FIGURES.md", `${out.join("\n").trimEnd()}\n`);
}

main();

