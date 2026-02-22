# Thesis Draft Pack (English)

This folder contains a five-chapter starter draft for the graduation thesis on QuantVN Strategy Forge (grounded analysis + AI-assisted trading strategy design).

## Files
- `ch1_introduction.md`
- `ch2_literature_review.md`
- `ch3_system_design_and_methodology.md`
- `ch4_implementation_and_results.md`
- `ch5_conclusion_and_future_work.md`
- `EVALUATION_GATES.md` (deep dive: criteria + purpose + citations)
- `THESIS_5CH_FULL.md` (single-file wrapper pointing to chapters)
- `figures/` (Mermaid sources for all workflow/system diagrams used in Chapters 3-4)
- `PRESENTATION_FIGURES.md` (copy/paste pack of Mermaid figures for slide decks)
- `references_apa.md`

## Usage
- Keep chapter language in English.
- Use in-text APA citations like `(Lin et al., 2022)`.
- Each chapter should end with a `References` section for works cited in that chapter.
- Maintain the full reference list in `references_apa.md` (master list).
- If you add new external citations/URLs, also register them in `docs/REFERENCE_REGISTRY.md`.

## Figures (Mermaid -> PNG/SVG for Slides/Thesis)
This thesis uses Mermaid blocks as the single source of truth for diagrams. The `figures/` folder contains one file per figure.

To generate presentation-ready images:
- Run: `pnpm run thesis:figures:export`
- Outputs:
  - `docs/thesis/figures/_mmd/` (extracted `.mmd` sources)
  - `docs/thesis/figures/_export/` (rendered `.png` and `.svg` when Mermaid CLI is available)

If you do not have Mermaid CLI installed, the export script will still generate `_mmd/` and print manual export instructions (VS Code Mermaid preview or Mermaid Live export).
