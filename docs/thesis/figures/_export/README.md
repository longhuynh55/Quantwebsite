# Rendered Figures (PNG/SVG)

This folder is intended to hold rendered images exported from Mermaid sources in `docs/thesis/figures/`.

Recommended workflow:
1. Extract and export via script: `pnpm run thesis:figures:export`
2. Use the resulting `.png` files for PowerPoint/Google Slides and `.svg` files for Word/LaTeX embedding.

Notes:
- The canonical sources are the Mermaid blocks in `docs/thesis/figures/*.md`.
- If Mermaid CLI (`mmdc`) is not installed, the export script will still generate `.mmd` files in `docs/thesis/figures/_mmd/`.
