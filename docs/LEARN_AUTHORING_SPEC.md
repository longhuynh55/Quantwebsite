# Learn Articles (Academic) - Authoring Spec (MDX) + Component Set

This spec defines how to write and render academic-style Learn articles in `content/learn/*.mdx`, including:
- citations and references
- equations / math
- callouts
- figures
- tables
- table-of-contents (ToC)

It also includes a migration plan from the current `content/learn/*.md` pipeline.

## Goals
- Keep authoring ergonomic for non-engineers (mostly Markdown).
- Support academic affordances (citations, references, equations, figures, captions).
- Ensure predictable rendering (styling + ToC) without hand-tuned per-article CSS.
- Make content metadata queryable (frontmatter index for lists, cards, filters).

## File Layout
- Source: `quant-website/content/learn/<slug>.mdx`
- Assets:
  - preferred: `quant-website/public/learn/<slug>/...` (images, small SVGs)
  - allowed: `quant-website/public/images/...` for shared assets

`<slug>` must match the route param: `/learn/<slug>`.

## Frontmatter Schema

Each article MUST begin with YAML frontmatter.

```yaml
---
slug: what-is-quant
title: "What Is Quantitative Finance?"
description: "A rigorous overview of how data, models, and risk controls translate ideas into testable decisions."
level: beginner # beginner | intermediate | advanced
durationMinutes: 18
publishedAt: "2026-02-20" # YYYY-MM-DD
updatedAt: "2026-02-20"   # YYYY-MM-DD
authors:
  - name: "QuantVN Team"
tags: ["foundations", "research", "risk"]
toc: true
math: true
references:
  - id: markowitz1952
    type: paper
    authors: "Markowitz, H."
    year: 1952
    title: "Portfolio Selection"
    venue: "The Journal of Finance"
    url: "https://example.org/..."
  - id: lo2002
    type: paper
    authors: "Lo, A. W."
    year: 2002
    title: "The Statistics of Sharpe Ratios"
    venue: "Financial Analysts Journal"
    doi: "10.2469/faj.v58.n4.2453"
---
```

### Required keys
- `slug` (string)
- `title` (string)
- `description` (string)
- `level` (`beginner|intermediate|advanced`)
- `durationMinutes` (number)

### Optional keys (recommended)
- `publishedAt`, `updatedAt` (YYYY-MM-DD)
- `authors` (list)
- `tags` (list)
- `toc` (boolean; default true in layout)
- `math` (boolean; enables math plugins and KaTeX CSS)
- `references` (list; enables citation + references patterns)

## Document Structure Rules
- The page layout owns the H1 (use frontmatter `title`). In body, start with `##` sections.
- Use consistent heading levels:
  - `##` for top-level sections
  - `###` for subsections
  - Avoid skipping levels (no `####` unless truly needed).
- One concept per section; keep sections short enough to be scannable.
- Prefer fenced code blocks with language tags (e.g. ```ts, ```python).

## ToC (Table of Contents)

### Behavior
- ToC is generated from `##` and `###` headings (depth 2-3).
- IDs are derived from the heading text (kebab-case) and must be stable.
- The layout renders ToC automatically when `toc: true`.

### Authoring requirements
- Headings must be unique within the page (or the ToC generator will need to disambiguate).
- Avoid punctuation-heavy headings; prefer short descriptive phrases.

## Callouts

Use MDX component:

```mdx
<Callout type="definition" title="What is leakage?">
Leakage is when information from the future influences a model during training or validation.
</Callout>
```

### Types
- `note` (default)
- `tip`
- `warning`
- `definition`
- `example`

Callouts should be used sparingly; they create visual weight.

## Figures

### Simple image figure
```mdx
<Figure
  src="/learn/what-is-quant/flow.png"
  alt="Data to decision pipeline: data, features, model, risk, execution."
  caption="A minimal quant workflow from data to decisions."
  credit="Illustration: QuantVN"
/>
```

### Custom figure content (charts, SVG, etc.)
```mdx
<Figure caption="Cumulative returns of strategy vs benchmark.">
  <StrategyReturnsChart />
</Figure>
```

Rules:
- Always set `alt` for images that convey information.
- Captions should be full sentences when describing results; fragments are fine for labels.
- Credits are optional; include when required by licensing or attribution norms.

## Tables

### Markdown tables (preferred)
Use GFM tables for most cases:

```md
| Metric | Meaning | Pitfall |
|---|---|---|
| Sharpe | Return per unit volatility | Inflated by autocorrelation |
| Max DD | Peak-to-trough loss | Sensitive to sample window |
```

### Complex tables
Use the `<Table>` wrapper when you need captions, footnotes, or horizontal scroll:

```mdx
<Table caption="Common backtest pitfalls.">
  <table>
    <thead>
      <tr><th>Pitfall</th><th>Effect</th><th>Mitigation</th></tr>
    </thead>
    <tbody>
      <tr><td>Lookahead</td><td>Overstates performance</td><td>Lag features</td></tr>
    </tbody>
  </table>
</Table>
```

## Equations / Math

### Authoring syntax (recommended)
- Inline math: `$r_t = \\ln(P_t / P_{t-1})$`
- Block math:

```md
$$
\\hat{\\beta} = (X^\\top X)^{-1} X^\\top y
$$
```

### Rendering
- Use KaTeX (fast, deterministic) via MDX pipeline (`remark-math` + `rehype-katex`).
- Enable math per-article with `math: true` in frontmatter, or globally for Learn.

### Equation numbering (optional)
If you need equation numbers, prefer explicit labels in text:
- "Equation (1) defines ..."
- Keep numbering stable across edits (do not auto-number unless you are OK with renumber churn).

## Citations and References

This spec intentionally avoids a heavy BibTeX workflow. References live in frontmatter, citations are lightweight links.

### Add references in frontmatter
Each reference MUST have a stable `id` (kebab-case).

### Cite in the body
```mdx
Mean-variance optimization formalizes the tradeoff between expected return and variance <Cite id="markowitz1952" />.
```

### Render references section
Option A (layout-driven): the Learn layout appends references automatically if frontmatter has `references`.

Option B (author-controlled): add at the end:
```mdx
## References
<References />
```

### Style requirements
- Citations render as compact bracketed links like `[Markowitz 1952]` or `[markowitz1952]`.
- References render as an ordered list sorted by `authors, year` (or keep frontmatter order if you want manual curation).

## Minimal Component Set

All components are designed to be MDX-safe and also usable directly from React pages.

- `Callout`
  - Props: `type?: "note"|"tip"|"warning"|"definition"|"example"`, `title?: string`, `children: ReactNode`
- `Figure`
  - Props: `src?: string`, `alt?: string`, `caption?: string`, `credit?: string`, `children?: ReactNode`
- `Table`
  - Props: `caption?: string`, `children: ReactNode` (expects a `<table>` inside)
- `Cite`
  - Props: `id: string`, `label?: string` (renders link to `#ref-<id>`)
- `References`
  - Props: `items?: Reference[]` (if not provided, it expects the layout to inject article references)
- `ToC`
  - Props: `items: { id: string; text: string; depth: 2|3 }[]`

Recommended file locations:
- `src/components/learn/Callout.tsx`
- `src/components/learn/Figure.tsx`
- `src/components/learn/Table.tsx`
- `src/components/learn/Cite.tsx`
- `src/components/learn/References.tsx`
- `src/components/learn/ToC.tsx`

## Migration Plan: `content/learn/*.md` -> `.mdx` + Frontmatter

### Phase 0: Stabilize metadata source of truth (no renderer changes yet)
1. Add frontmatter to each existing `.md` (frontmatter is still valid Markdown).
2. Update the Learn list page to prefer metadata from frontmatter when present, but fall back to `LEARNING_TOPICS`.
3. Keep the current renderer for body content unchanged.

Deliverable: frontmatter exists everywhere; cards and routes are stable.

### Phase 1: Introduce MDX rendering behind a feature flag
1. Add an MDX compiler for server rendering (recommended options):
   - `@mdx-js/mdx` (compile on demand, cache per file)
   - or `next-mdx-remote/rsc` (convenient wrapper for RSC)
2. Add remark/rehype plugins:
   - `remark-gfm` (tables)
   - `remark-math` + `rehype-katex` (math)
   - `rehype-slug` (heading IDs)
3. Add KaTeX CSS inclusion when `math: true`.
4. Implement ToC extraction from the markdown AST and render in the page layout when `toc: true`.
5. Allow both `.md` and `.mdx` during transition:
   - loader tries `<slug>.mdx` then `<slug>.md`

Deliverable: a single pilot article renders from `.mdx` with Callout/Figure/Table/Cite/ToC.

### Phase 2: Convert all articles to `.mdx`
1. Rename each file to `.mdx`.
2. Replace any legacy markdown patterns that the old parser supported but MDX pipeline does not (rare).
3. Add `## References` + `<References />` (or ensure layout auto-appends).
4. Add at least one example per feature across the corpus (callout, figure, table, math, citation).

Deliverable: the old markdown parser can be deleted; Learn pages become uniform.

### Phase 3: Remove `LEARNING_TOPICS` hardcoding
1. Generate the Learn index by scanning frontmatter at build time or server runtime.
2. Enforce schema validation:
   - missing required frontmatter fails CI
   - unknown keys are flagged
3. Add a small script `scripts/learn-lint.mjs` to validate slugs, heading uniqueness, and reference IDs.

Deliverable: content directory becomes the single source of truth.

## Acceptance Criteria (for the migration)
- `/learn` list renders titles/descriptions/levels/duration from frontmatter.
- `/learn/<slug>` renders:
  - ToC with working anchors
  - math with KaTeX (when `math: true`)
  - callouts, figures, tables with consistent styling
  - citations that link into References
- `pnpm run lint`, `pnpm exec tsc --noEmit`, and `pnpm run build` pass.

