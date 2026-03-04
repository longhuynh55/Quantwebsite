# Thesis Front Matter Style Profile (Reference-Based)

This profile is extracted from:

- `output/doc/sample_layout_reference.pdf`

It is used to calibrate automated generation of cover-adjacent pages.

## Page order

1. Cover page(s)
2. Roman page `i`: `ACKNOWLEDGEMENTS`
3. Roman page `ii`: `INSTRUCTOR'S COMMENT`

## Typography and spacing targets

- Font family: `Times New Roman`
- Front-matter body size: 12 pt (`w:sz=24`)
- Heading size: 15 pt (`w:sz=30`)
- Body line spacing: 1.5
- Acknowledgement body alignment: justified (`both`)
- First-line indent for acknowledgement paragraphs: 0.5 inch (`720` twips)

## Instructor comment page

- Centered roman numeral at top (`ii`)
- Centered heading: `INSTRUCTOR'S COMMENT`
- Dotted writing lines below heading

## Automation mapping

Current script implementation:

- `scripts/thesis-cover-autofill.ps1`

Relevant switch:

- `-AppendFrontMatter`: injects page `i` and page `ii` using this profile.

## Validation checklist

- Cover content remains on page 1 (no front-matter overflow before cover).
- Acknowledgements starts on a new page with roman `i` at top center.
- Instructor comment starts on a new page with roman `ii` at top center.
- Body text appears justified and readable at thesis zoom levels.
