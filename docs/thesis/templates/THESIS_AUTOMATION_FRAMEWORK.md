# Thesis Automation Framework (Layout-First)

This framework separates two concerns clearly:

1. Document layout and front matter (mandatory by school format)
2. Chapter content structure (project-dependent, optional)

Reference sample:

- `output/doc/sample_layout_reference.pdf`

## A. Layout-only pack (recommended baseline)

Use this when you want to follow the sample's presentation logic only:

- cover page
- acknowledgements (roman page i)
- instructor's comment (roman page ii)
- table of contents
- list of tables/figures
- abbreviations
- abstract

Command:

```powershell
pnpm -C quant-website run thesis:layout:create -- `
  -ConfigPath docs/thesis/templates/thesis_scaffold_config.sample.json `
  -Force
```

Script:

- `scripts/thesis-generate-layout-pack.ps1`

Output:

- `docs/thesis/generated/layout_<slug>/LAYOUT_RULES.md`
- `docs/thesis/generated/layout_<slug>/cover_data.json`
- `docs/thesis/generated/layout_<slug>/front-matter/*`

## B. Content scaffold (optional)

Use this only if you also want a prepared chapter template:

```powershell
pnpm -C quant-website run thesis:scaffold:create -- `
  -ConfigPath docs/thesis/templates/thesis_scaffold_config.sample.json `
  -Force
```

Script:

- `scripts/thesis-generate-scaffold.ps1`

## Cover generation (shared)

Both flows reuse:

- `scripts/thesis-cover-autofill.ps1`
- `docs/thesis/templates/COVER_AUTOFILL_WORKFLOW.md`

## Notes

- The sample is used to infer layout style, not to force identical chapter logic.
- Chapter organization should follow your project and supervisor requirements.
- Keep citations in APA 7 with DOI/URL when available.
