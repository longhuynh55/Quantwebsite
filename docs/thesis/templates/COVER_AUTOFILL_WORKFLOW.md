# Cover DOCX Autofill Workflow

This workflow lets you use your school cover style as a reusable DOCX template and auto-fill fields later.

## Layout baseline (reference)

Formatting is aligned to this sample thesis:

- `output/doc/sample_layout_reference.pdf`

Reference structure:

- cover page(s)
- page `i`: `ACKNOWLEDGEMENTS`
- page `ii`: `INSTRUCTOR'S COMMENT` with dotted lines

## Recommended mode for strict layout

Use OpenXML autofill and keep front matter disabled by default. This mode only fills text and keeps the original cover layout as stable as possible.

```powershell
pnpm -C quant-website run thesis:cover:autofill -- `
  -TemplateDocxPath "docs/thesis/templates/school_cover_template.docx" `
  -DataJsonPath "docs/thesis/templates/cover_lieu_hoai_phuc_test.json" `
  -OutputDocxPath "docs/thesis/templates/school_cover_lieu_hoai_phuc_clean.docx"
```

## Optional: append acknowledgement/instructor page

Only enable this when you really need extra pages in the same file.

```powershell
pnpm -C quant-website run thesis:cover:autofill -- `
  -TemplateDocxPath "docs/thesis/templates/school_cover_template.docx" `
  -DataJsonPath "docs/thesis/templates/cover_lieu_hoai_phuc_test.json" `
  -OutputDocxPath "docs/thesis/templates/school_cover_with_frontmatter.docx" `
  -AppendFrontMatter
```

When `-AppendFrontMatter` is enabled, the added pages follow the reference flow:

- page `i`: centered roman numeral + acknowledgement heading + justified paragraphs with first-line indent
- page `ii`: centered roman numeral + instructor heading + dotted comment lines

## Placeholder style (for editable template mode)

If your template uses placeholders, supported keys are:

- `{{UNIVERSITY_NAME}}`
- `{{FACULTY_NAME}}`
- `{{THESIS_TITLE}}`
- `{{STUDENT_NAME}}`
- `{{STUDENT_ID}}`
- `{{SUPERVISOR_NAME}}`
- `{{CITY}}`
- `{{YEAR}}`
- `{{ACKNOWLEDGEMENT_TITLE}}` (optional)
- `{{ACKNOWLEDGEMENT_TEXT}}` (optional)
- `{{INSTRUCTOR_COMMENT}}` (optional)

For school cover files without placeholders, scripts also map legacy labels:

- `TÊN ĐỀ TÀI`
- `GVHD:`
- `SVTH:`
- `MSSV:`

## Python replace-only mode

If you want a pure replace-only pass (no page insertion and no Word COM), use:

```powershell
python "scripts/docx_cover_fill.py" `
  --template "docs/thesis/templates/school_cover_template.docx" `
  --data "docs/thesis/templates/cover_lieu_hoai_phuc_test.json" `
  --output "docs/thesis/templates/school_cover_lieu_hoai_phuc_python.docx"
```

If your machine uses `py` launcher:

```powershell
py -3 "scripts/docx_cover_fill.py" `
  --template "docs/thesis/templates/school_cover_template.docx" `
  --data "docs/thesis/templates/cover_lieu_hoai_phuc_test.json" `
  --output "docs/thesis/templates/school_cover_lieu_hoai_phuc_python.docx"
```

## Python-docx mode (inspired by generate_thesis.py style)

This mode follows the same approach as `generate_thesis.py` (python-docx formatting control),
but keeps cover-safe defaults:

- default: fill cover only
- optional: append front matter with `--append-front-matter`

```powershell
python "scripts/docx_cover_fill_pythondocx.py" `
  --template "docs/thesis/templates/school_cover_template.docx" `
  --data "docs/thesis/templates/cover_lieu_hoai_phuc_test.json" `
  --output "docs/thesis/templates/school_cover_lieu_hoai_phuc_python_docx.docx"
```

Optional append page:

```powershell
python "scripts/docx_cover_fill_pythondocx.py" `
  --template "docs/thesis/templates/school_cover_template.docx" `
  --data "docs/thesis/templates/cover_lieu_hoai_phuc_test.json" `
  --output "docs/thesis/templates/school_cover_lieu_hoai_phuc_python_docx_with_frontmatter.docx" `
  --append-front-matter
```

## Notes

- If Word is opening the target output file, scripts auto-fallback to a timestamped filename.
- If your HTML template references local images under `images/`, provide those files before converting HTML to DOCX.
- If your repo already has a file named `tmp`, use `output/doc/` for intermediate render artifacts.
