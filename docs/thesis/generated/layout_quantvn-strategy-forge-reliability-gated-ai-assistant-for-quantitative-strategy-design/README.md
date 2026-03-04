# Thesis Layout Pack

This pack standardizes document layout only (not chapter logic).

## Generated files
- LAYOUT_RULES.md
- cover_data.json
- front-matter/*.md

## Cover generation
Use this command pattern:
pnpm -C quant-website run thesis:cover:autofill --
  -TemplateDocxPath docs/thesis/templates/school_cover_template.docx
  -DataJsonPath <path-to-generated-cover_data.json>
  -OutputDocxPath docs/thesis/generated/cover_output.docx
  -AppendFrontMatter
