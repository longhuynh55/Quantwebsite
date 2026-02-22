import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function execCmd(cmd, args, opts) {
  // Windows: spawning .cmd shims directly can fail in some environments.
  // Running via cmd.exe is the most compatible approach.
  if (process.platform === "win32") {
    return execFileSync("cmd.exe", ["/c", cmd, ...args], opts);
  }
  return execFileSync(cmd, args, opts);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function listFigureMarkdownFiles(figuresDir) {
  return fs
    .readdirSync(figuresDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".md") && d.name !== "FIGURES.md")
    .map((d) => path.join(figuresDir, d.name))
    .sort();
}

function extractFirstMermaidBlock(mdText) {
  // Extract the first ```mermaid ... ``` block.
  const re = /```mermaid\s*\r?\n([\s\S]*?)\r?\n```/m;
  const m = mdText.match(re);
  if (!m) return null;
  return m[1].trimEnd();
}

function findMmdc() {
  // Prefer local bin (repo) if present, otherwise use PATH.
  // Use a relative path so `cmd.exe /c` doesn't have to deal with spaces in absolute paths.
  const binDir = path.join("node_modules", ".bin");
  const localCmd = path.join(binDir, process.platform === "win32" ? "mmdc.cmd" : "mmdc");
  if (fs.existsSync(localCmd)) return localCmd;
  return "mmdc";
}

function canRunMmdc(mmdcCmd) {
  try {
    execCmd(mmdcCmd, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function main() {
  const repoRoot = process.cwd(); // expected: quant-website/
  const figuresDir = path.join(repoRoot, "docs", "thesis", "figures");
  const outMmdDir = path.join(figuresDir, "_mmd");
  const outExportDir = path.join(figuresDir, "_export");

  ensureDir(outMmdDir);
  ensureDir(outExportDir);

  const mdFiles = listFigureMarkdownFiles(figuresDir);
  if (mdFiles.length === 0) {
    console.error(`No figure markdown files found under ${figuresDir}`);
    process.exitCode = 1;
    return;
  }

  const extracted = [];
  for (const mdPath of mdFiles) {
    const text = fs.readFileSync(mdPath, "utf8");
    const mermaid = extractFirstMermaidBlock(text);
    if (!mermaid) {
      console.warn(`Skipping (no mermaid block): ${path.relative(repoRoot, mdPath)}`);
      continue;
    }

    const base = path.basename(mdPath, ".md");
    const mmdPath = path.join(outMmdDir, `${base}.mmd`);
    fs.writeFileSync(mmdPath, mermaid + "\n", "utf8");
    extracted.push({ base, mmdPath });
  }

  console.log(`Extracted ${extracted.length} Mermaid figure(s) to: ${path.relative(repoRoot, outMmdDir)}`);

  const mmdcCmd = findMmdc();
  const hasMmdc = canRunMmdc(mmdcCmd);
  if (!hasMmdc) {
    console.log("");
    console.log("Mermaid CLI (mmdc) not found. To render PNG/SVG:");
    console.log("1) Install Mermaid CLI (recommended dev-only): pnpm add -D @mermaid-js/mermaid-cli");
    console.log("2) Re-run: pnpm run thesis:figures:export");
    console.log("");
    console.log("Manual alternative:");
    console.log("- Open any .mmd file in docs/thesis/figures/_mmd and export via VS Code Mermaid preview,");
    console.log("  or paste into mermaid.live and export PNG/SVG with a consistent theme.");
    return;
  }

  // Render with a stable neutral theme; do not assume a dark background for thesis slides.
  const themeJson = path.join(outExportDir, "mermaid.theme.json");
  if (!fs.existsSync(themeJson)) {
    fs.writeFileSync(
      themeJson,
      JSON.stringify(
        {
          theme: "neutral",
          themeVariables: {
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: "14px",
            primaryColor: "#ffffff",
            primaryBorderColor: "#111827",
            primaryTextColor: "#111827",
            lineColor: "#111827",
          },
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
  }

  let rendered = 0;
  for (const { base, mmdPath } of extracted) {
    const outPng = path.join(outExportDir, `${base}.png`);
    const outSvg = path.join(outExportDir, `${base}.svg`);
    try {
      execCmd(
        mmdcCmd,
        [
          "-i",
          mmdPath,
          "-o",
          outPng,
          "-t",
          "neutral",
          "--configFile",
          themeJson,
          "--backgroundColor",
          "white",
        ],
        { stdio: "ignore" }
      );
      execCmd(
        mmdcCmd,
        [
          "-i",
          mmdPath,
          "-o",
          outSvg,
          "-t",
          "neutral",
          "--configFile",
          themeJson,
          "--backgroundColor",
          "white",
        ],
        { stdio: "ignore" }
      );
      rendered += 1;
    } catch (err) {
      console.warn(`Failed to render ${base} (mmdc error).`);
    }
  }

  console.log(`Rendered ${rendered}/${extracted.length} figure(s) to: ${path.relative(repoRoot, outExportDir)}`);
}

main();
