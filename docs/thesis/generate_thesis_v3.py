"""
Thesis Auto-Generation Pipeline v3.

Reads markdown chapter files, references, cover template, and configuration
to produce a fully formatted .docx thesis document.

Usage:
    python generate_thesis_v3.py [--config thesis_build_config.json]

Output:
    generated/thesis_full_draft.docx  (or as configured)
"""
import os
import re
import json
import sys
import argparse
import subprocess
import tempfile
from pathlib import Path

from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn, nsdecls
from docx.oxml import parse_xml


# ─────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────

DEFAULT_CONFIG = "thesis_build_config.json"


def load_config(config_path: str) -> dict:
    with open(config_path, "r", encoding="utf-8-sig") as f:
        return json.load(f)


# ─────────────────────────────────────────────────────────────────────
# Formatting helpers
# ─────────────────────────────────────────────────────────────────────

class DocxFormatter:
    """Encapsulates all DOCX formatting logic."""

    def __init__(self, doc: Document, fmt_config: dict):
        self.doc = doc
        self.cfg = fmt_config
        self.font_name = fmt_config.get("font_name", "Times New Roman")
        self.body_size = Pt(fmt_config.get("body_font_size", 13))
        self.h1_size = Pt(fmt_config.get("h1_font_size", 16))
        self.h2_size = Pt(fmt_config.get("h2_font_size", 14))
        self.h3_size = Pt(fmt_config.get("h3_font_size", 13))
        self.line_spacing = fmt_config.get("line_spacing", 1.5)
        self.indent = Cm(fmt_config.get("first_line_indent_cm", 1.27))
        # Cross-reference tracking
        self._bookmark_id = 0
        self._bookmarks = {}  # e.g. {'Figure 4.1': 'fig_4_1', 'Table 3.1': 'tbl_3_1'}

    def _set_run_font(self, run, font_size=None, bold=False, italic=False,
                      color=None):
        """Apply font settings to a run."""
        run.font.name = self.font_name
        run.font.size = font_size or self.body_size
        run.bold = bold
        run.italic = italic
        if color:
            run.font.color.rgb = color
        # Vietnamese font fallback
        rpr = run._element.get_or_add_rPr()
        rFonts = rpr.find(qn('w:rFonts'))
        if rFonts is None:
            rFonts = parse_xml(f'<w:rFonts {nsdecls("w")} />')
            rpr.insert(0, rFonts)
        rFonts.set(qn('w:eastAsia'), self.font_name)

    def _set_paragraph_format(self, paragraph, space_after=None,
                              space_before=None, line_spacing=None,
                              first_line_indent=None, alignment=None,
                              left_indent=None):
        """Apply paragraph formatting."""
        fmt = paragraph.paragraph_format
        fmt.space_after = space_after if space_after is not None else Pt(6)
        fmt.space_before = space_before if space_before is not None else Pt(0)
        fmt.line_spacing = line_spacing or self.line_spacing
        if first_line_indent is not None:
            fmt.first_line_indent = first_line_indent
        if left_indent is not None:
            fmt.left_indent = left_indent
        if alignment is not None:
            paragraph.alignment = alignment

    def _add_bookmark(self, paragraph, bookmark_name):
        """Add a Word bookmark around the last run in a paragraph."""
        self._bookmark_id += 1
        bid = str(self._bookmark_id)
        bm_start = parse_xml(
            f'<w:bookmarkStart {nsdecls("w")} w:id="{bid}" w:name="{bookmark_name}"/>'
        )
        bm_end = parse_xml(
            f'<w:bookmarkEnd {nsdecls("w")} w:id="{bid}"/>'
        )
        runs = paragraph._element.findall(qn('w:r'))
        if runs:
            last_run = runs[-1]
            last_run.addprevious(bm_start)
            last_run.addnext(bm_end)

    def _insert_cross_ref(self, paragraph, bookmark_name, display_text,
                          bold=False, italic=False):
        """Insert a Word cross-reference (REF field) into a paragraph."""
        # Field char begin
        run_begin = paragraph.add_run()
        self._set_run_font(run_begin, bold=bold, italic=italic)
        run_begin._element.append(parse_xml(
            f'<w:fldChar {nsdecls("w")} w:fldCharType="begin"/>'
        ))
        # Field code
        run_code = paragraph.add_run()
        self._set_run_font(run_code, bold=bold, italic=italic)
        run_code._element.append(parse_xml(
            f'<w:instrText {nsdecls("w")} xml:space="preserve"> REF {bookmark_name} \\h </w:instrText>'
        ))
        # Separate
        run_sep = paragraph.add_run()
        self._set_run_font(run_sep, bold=bold, italic=italic)
        run_sep._element.append(parse_xml(
            f'<w:fldChar {nsdecls("w")} w:fldCharType="separate"/>'
        ))
        # Display text
        run_display = paragraph.add_run(display_text)
        self._set_run_font(run_display, bold=bold, italic=italic)
        # End
        run_end = paragraph.add_run()
        self._set_run_font(run_end, bold=bold, italic=italic)
        run_end._element.append(parse_xml(
            f'<w:fldChar {nsdecls("w")} w:fldCharType="end"/>'
        ))

    def _render_text_with_crossrefs(self, paragraph, text, bold=False, italic=False):
        """Render text, replacing 'Figure X.Y' / 'Table X.Y' with cross-ref fields."""
        pattern = re.compile(r'((?:Figure|Table|Hình|Bảng)\s+[A-Z]?\d+\.\d+)')
        parts = pattern.split(text)
        for part in parts:
            if pattern.match(part):
                ref_key = part.strip()
                bm_name = self._bookmarks.get(ref_key)
                if bm_name:
                    self._insert_cross_ref(paragraph, bm_name, ref_key,
                                           bold=bold, italic=italic)
                else:
                    # No bookmark registered yet — render as plain text
                    run = paragraph.add_run(part)
                    self._set_run_font(run, bold=bold, italic=italic)
            elif part:
                run = paragraph.add_run(part)
                self._set_run_font(run, bold=bold, italic=italic)

    def add_heading(self, text: str, level: int = 1):
        """Add a styled heading (manual formatting, no built-in styles).
        Used for front matter headings that should NOT appear in TOC."""
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        fmt = p.paragraph_format
        fmt.space_before = Pt(18) if level == 1 else Pt(12)
        fmt.space_after = Pt(6)
        fmt.line_spacing = self.line_spacing
        fmt.first_line_indent = None

        size_map = {1: self.h1_size, 2: self.h2_size, 3: self.h3_size}
        font_size = size_map.get(level, self.h3_size)

        run = p.add_run(text)
        self._set_run_font(run, font_size=font_size, bold=True,
                           color=RGBColor(0, 0, 0))
        return p

    def add_toc_heading(self, text: str, level: int = 1):
        """Add a heading that WILL appear in the auto-generated Table of Contents.
        Uses outline level on the paragraph so Word TOC picks it up,
        even if the template lacks built-in Heading styles."""
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(18) if level == 1 else Pt(12)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.line_spacing = self.line_spacing
        p.paragraph_format.first_line_indent = None

        # Set outline level so Word TOC recognizes this as a heading
        # Level 1 = outline level 0, Level 2 = outline level 1, etc.
        pPr = p._p.get_or_add_pPr()
        outline_lvl = parse_xml(
            f'<w:outlineLvl {nsdecls("w")} w:val="{level - 1}"/>'
        )
        pPr.append(outline_lvl)

        size_map = {1: self.h1_size, 2: self.h2_size, 3: self.h3_size}
        font_size = size_map.get(level, self.h3_size)

        run = p.add_run(text)
        self._set_run_font(run, font_size=font_size, bold=True,
                           color=RGBColor(0, 0, 0))
        return p

    def add_body_text(self, text: str, bold=False, italic=False,
                      align=WD_ALIGN_PARAGRAPH.JUSTIFY,
                      first_line_indent=None):
        """Add a paragraph of body text with cross-references."""
        p = self.doc.add_paragraph()
        p.alignment = align
        indent = first_line_indent if first_line_indent is not None else self.indent
        self._set_paragraph_format(p, first_line_indent=indent)
        self._render_text_with_crossrefs(p, text, bold=bold, italic=italic)
        return p

    def add_rich_paragraph(self, segments: list, align=WD_ALIGN_PARAGRAPH.JUSTIFY,
                           first_line_indent=None):
        """Add a paragraph with mixed bold/italic/normal runs and cross-references.

        segments: list of (text, bold, italic) tuples
        """
        p = self.doc.add_paragraph()
        p.alignment = align
        indent = first_line_indent if first_line_indent is not None else self.indent
        self._set_paragraph_format(p, first_line_indent=indent)
        for text, bold, italic in segments:
            self._render_text_with_crossrefs(p, text, bold=bold, italic=italic)
        return p

    def add_bullet(self, text: str, level: int = 0):
        """Add a bullet point."""
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        self._set_paragraph_format(
            p,
            first_line_indent=None,
            left_indent=Cm(1.27 + level * 0.63),
            space_after=Pt(3)
        )
        # Bullet marker
        bullet_char = "•" if level == 0 else "◦"
        run = p.add_run(f"{bullet_char}  ")
        self._set_run_font(run)

        # Parse inline formatting for bullet text
        segments = parse_inline_formatting(text)
        for seg_text, bold, italic in segments:
            self._render_text_with_crossrefs(p, seg_text, bold=bold, italic=italic)
        return p

    def add_numbered_item(self, number: int, text: str, level: int = 0):
        """Add a numbered list item."""
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        self._set_paragraph_format(
            p,
            first_line_indent=None,
            left_indent=Cm(1.27 + level * 0.63),
            space_after=Pt(3)
        )
        run = p.add_run(f"{number}.  ")
        self._set_run_font(run)

        segments = parse_inline_formatting(text)
        for seg_text, bold, italic in segments:
            self._render_text_with_crossrefs(p, seg_text, bold=bold, italic=italic)
        return p

    def add_table(self, headers: list, rows: list, caption: str = None):
        """Add a formatted table with optional caption (below the table)."""

        num_cols = len(headers)
        table = self.doc.add_table(rows=1 + len(rows), cols=num_cols)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        try:
            table.style = 'Table Grid'
        except KeyError:
            # Template may not have 'Table Grid' style — add borders manually
            tbl = table._element
            tbl_pr = tbl.find(qn('w:tblPr'))
            if tbl_pr is None:
                tbl_pr = parse_xml(f'<w:tblPr {nsdecls("w")}/>')
                tbl.insert(0, tbl_pr)
            borders = parse_xml(
                f'<w:tblBorders {nsdecls("w")}>'
                '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
                '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
                '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
                '<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
                '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
                '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
                '</w:tblBorders>'
            )
            tbl_pr.append(borders)

        # Header row
        for i, header in enumerate(headers):
            cell = table.rows[0].cells[i]
            cell.text = ""
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run(header.strip())
            self._set_run_font(run, font_size=Pt(11), bold=True)
            # Header background
            shading = parse_xml(
                f'<w:shd {nsdecls("w")} w:fill="D9E2F3" w:val="clear"/>'
            )
            cell._element.get_or_add_tcPr().append(shading)

        # Data rows
        for r_idx, row in enumerate(rows):
            for c_idx, cell_text in enumerate(row):
                cell = table.rows[r_idx + 1].cells[c_idx]
                cell.text = ""
                p = cell.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                segments = parse_inline_formatting(cell_text.strip())
                for seg_text, bold, italic in segments:
                    run = p.add_run(seg_text)
                    self._set_run_font(run, font_size=Pt(11),
                                       bold=bold, italic=italic)

        # Caption BELOW the table (academic convention for tables)
        if caption:
            p = self.doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            self._set_paragraph_format(p, space_before=Pt(4), space_after=Pt(10),
                                       first_line_indent=None)
            run = p.add_run(caption)
            self._set_run_font(run, font_size=Pt(11), italic=True)
            # Register bookmark for cross-referencing
            m = re.match(r'((?:Table|Bảng)\s+[A-Z]?\d+\.\d+)', caption)
            if m:
                ref_key = m.group(1)
                bm_name = '_' + ref_key.replace(' ', '_').replace('.', '_')
                self._bookmarks[ref_key] = bm_name
                self._add_bookmark(p, bm_name)
        else:
            # Spacing after table
            p = self.doc.add_paragraph()
            self._set_paragraph_format(p, space_after=Pt(6), first_line_indent=None)
        return table

    def add_figure_placeholder(self, figure_id: str, caption: str,
                               image_path: str = None):
        """Add a figure (image or placeholder box)."""
        if image_path and os.path.exists(image_path):
            # Insert actual image
            p = self.doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            self._set_paragraph_format(p, space_before=Pt(12),
                                       first_line_indent=None)
            run = p.add_run()
            try:
                # Smart sizing: cap both width and height so tall diagrams fit
                MAX_W = Cm(13)
                MAX_H = Cm(17)
                try:
                    from PIL import Image as PILImage
                    with PILImage.open(image_path) as img:
                        img_w, img_h = img.size
                    scale_w = MAX_W / img_w
                    scale_h = MAX_H / img_h
                    scale = min(scale_w, scale_h)
                    final_w = int(img_w * scale)
                    final_h = int(img_h * scale)
                    run.add_picture(image_path, width=final_w, height=final_h)
                except ImportError:
                    run.add_picture(image_path, width=MAX_W)
            except Exception as e:
                run.add_text(f"[Image load error: {e}]")
                self._set_run_font(run, italic=True)
        else:
            # Placeholder box
            p = self.doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            self._set_paragraph_format(p, space_before=Pt(12),
                                       first_line_indent=None)
            run = p.add_run(f"[{figure_id}: Diagram — see mermaid source]")
            self._set_run_font(run, font_size=Pt(11), italic=True,
                               color=RGBColor(0x66, 0x66, 0x66))

        # Caption
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        self._set_paragraph_format(p, space_after=Pt(12),
                                   first_line_indent=None)
        run = p.add_run(caption)
        self._set_run_font(run, font_size=Pt(11), italic=True)
        # Register bookmark for cross-referencing
        m = re.match(r'((?:Figure|Hình)\s+[A-Z]?\d+\.\d+)', caption)
        if m:
            ref_key = m.group(1)
            bm_name = '_' + ref_key.replace(' ', '_').replace('.', '_')
            self._bookmarks[ref_key] = bm_name
            self._add_bookmark(p, bm_name)
        return p

    def add_page_break(self):
        self.doc.add_page_break()

    def add_reference_entry(self, index: int, text: str):
        """Add a reference in APA hanging-indent format with inline markdown support."""
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        self._set_paragraph_format(
            p,
            space_after=Pt(4),
            space_before=Pt(2),
            line_spacing=1.3,
            first_line_indent=Cm(-1.27),
            left_indent=Cm(1.27)
        )
        # Parse *italic* and **bold** markers so journal names render correctly
        segments = parse_inline_formatting(text)
        for seg_text, bold, italic in segments:
            run = p.add_run(seg_text)
            self._set_run_font(run, font_size=Pt(12), bold=bold, italic=italic)
        return p


# ─────────────────────────────────────────────────────────────────────
# Markdown parser
# ─────────────────────────────────────────────────────────────────────

def parse_inline_formatting(text: str) -> list:
    """Parse **bold** and *italic* markers into segments.

    Returns: list of (text, bold, italic) tuples
    """
    segments = []
    # Pattern: **bold**, *italic*, ***bold-italic***
    pattern = re.compile(
        r'(\*\*\*(.+?)\*\*\*)'   # bold+italic
        r'|(\*\*(.+?)\*\*)'      # bold
        r'|(\*(.+?)\*)'          # italic
        r'|(`([^`]+)`)'          # inline code
    )
    last_end = 0
    for m in pattern.finditer(text):
        # Add text before match
        if m.start() > last_end:
            segments.append((text[last_end:m.start()], False, False))

        if m.group(2):  # bold+italic
            segments.append((m.group(2), True, True))
        elif m.group(4):  # bold
            segments.append((m.group(4), True, False))
        elif m.group(6):  # italic
            segments.append((m.group(6), False, True))
        elif m.group(8):  # inline code
            segments.append((m.group(8), False, False))

        last_end = m.end()

    # Remaining text
    if last_end < len(text):
        segments.append((text[last_end:], False, False))

    return segments if segments else [(text, False, False)]


def parse_markdown_table(lines: list) -> tuple:
    """Parse a markdown table into (headers, rows).

    lines: list of raw table lines (including separator)
    Returns: (headers: list[str], rows: list[list[str]])
    """
    if len(lines) < 2:
        return [], []

    def split_row(line):
        line = line.strip()
        if line.startswith('|'):
            line = line[1:]
        if line.endswith('|'):
            line = line[:-1]
        return [c.strip() for c in line.split('|')]

    headers = split_row(lines[0])

    # Skip separator line (---  | --- | ---)
    data_lines = []
    for line in lines[1:]:
        stripped = line.strip()
        # Check if it's a separator line
        if re.match(r'^[\|\s\-:]+$', stripped):
            continue
        data_lines.append(split_row(line))

    return headers, data_lines


class MarkdownBlock:
    """Represents a parsed block from a markdown file."""
    HEADING = "heading"
    PARAGRAPH = "paragraph"
    TABLE = "table"
    MERMAID = "mermaid"
    CODE = "code"
    BULLET = "bullet"
    NUMBERED = "numbered"
    IMAGE = "image"
    BLANK = "blank"

    def __init__(self, block_type, content, level=0, meta=None):
        self.block_type = block_type
        self.content = content  # str for most, dict for tables
        self.level = level
        self.meta = meta or {}


def parse_markdown_file(filepath: str) -> list:
    """Parse a markdown file into a list of MarkdownBlocks."""
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()

    blocks = []
    i = 0
    numbered_counter = 0

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Skip empty lines
        if not stripped:
            i += 1
            numbered_counter = 0
            continue

        # Image: ![caption](path)
        img_match = re.match(r'^!\[([^\]]*)\]\(([^)]+)\)$', stripped)
        if img_match:
            caption = img_match.group(1)
            img_path = img_match.group(2)
            blocks.append(MarkdownBlock(
                MarkdownBlock.IMAGE, caption,
                meta={"path": img_path}
            ))
            i += 1
            continue

        # Heading
        heading_match = re.match(r'^(#{1,4})\s+(.+)$', stripped)
        if heading_match:
            level = len(heading_match.group(1))
            text = heading_match.group(2).strip()
            blocks.append(MarkdownBlock(MarkdownBlock.HEADING, text, level=level))
            i += 1
            numbered_counter = 0
            continue

        # Mermaid code block
        if stripped.startswith('```mermaid'):
            mermaid_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith('```'):
                mermaid_lines.append(lines[i])
                i += 1
            i += 1  # skip closing ```
            # Try to extract figure id from nearby lines
            mermaid_code = "".join(mermaid_lines)
            blocks.append(MarkdownBlock(
                MarkdownBlock.MERMAID, mermaid_code,
                meta={"raw": mermaid_code}
            ))
            continue

        # Generic code block
        if stripped.startswith('```'):
            lang = stripped[3:].strip()
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith('```'):
                code_lines.append(lines[i])
                i += 1
            i += 1  # skip closing ```
            blocks.append(MarkdownBlock(
                MarkdownBlock.CODE, "".join(code_lines),
                meta={"language": lang}
            ))
            continue

        # Table (starts with |)
        if stripped.startswith('|'):
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                table_lines.append(lines[i])
                i += 1
            headers, rows = parse_markdown_table(table_lines)
            if headers:
                blocks.append(MarkdownBlock(
                    MarkdownBlock.TABLE, {"headers": headers, "rows": rows}
                ))
            continue

        # Bullet list
        bullet_match = re.match(r'^(\s*)([-*])\s+(.+)$', stripped)
        if bullet_match:
            indent = len(line) - len(line.lstrip())
            level = indent // 2
            text = bullet_match.group(3)
            blocks.append(MarkdownBlock(MarkdownBlock.BULLET, text, level=level))
            i += 1
            numbered_counter = 0
            continue

        # Numbered list
        num_match = re.match(r'^(\s*)(\d+)\.\s+(.+)$', stripped)
        if num_match:
            numbered_counter += 1
            indent = len(line) - len(line.lstrip())
            level = indent // 3
            text = num_match.group(3)
            blocks.append(MarkdownBlock(
                MarkdownBlock.NUMBERED, text, level=level,
                meta={"number": numbered_counter}
            ))
            i += 1
            continue

        # Regular paragraph — accumulate contiguous non-empty lines
        para_lines = []
        while i < len(lines):
            l = lines[i].strip()
            if not l:
                break
            # Stop if next line is a heading, list, table, or code block
            if re.match(r'^#{1,4}\s', l):
                break
            if re.match(r'^[-*]\s', l):
                break
            if re.match(r'^\d+\.\s', l):
                break
            if l.startswith('|'):
                break
            if l.startswith('```'):
                break
            para_lines.append(l)
            i += 1
        text = " ".join(para_lines)
        if text:
            blocks.append(MarkdownBlock(MarkdownBlock.PARAGRAPH, text))
        numbered_counter = 0

    return blocks


# ─────────────────────────────────────────────────────────────────────
# Figure resolver
# ─────────────────────────────────────────────────────────────────────

class FigureResolver:
    """Resolves mermaid blocks to figure IDs and finds pre-rendered images.

    If no pre-rendered image exists, attempts to auto-render mermaid code
    to PNG using npx @mermaid-js/mermaid-cli (mmdc).
    """

    def __init__(self, figures_dir: str, export_dir: str):
        self.figures_dir = figures_dir
        self.export_dir = export_dir
        self.figure_counter = 0
        self.chapter_num = 0
        self._mmdc_available = None  # lazy check

    def set_chapter(self, chapter_num: int):
        self.chapter_num = chapter_num
        self.figure_counter = 0

    def _check_mmdc(self) -> bool:
        """Check if mmdc (mermaid-cli) is available via npx."""
        if self._mmdc_available is not None:
            return self._mmdc_available
        try:
            result = subprocess.run(
                ["npx", "-y", "@mermaid-js/mermaid-cli", "--version"],
                capture_output=True, text=True, timeout=30,
                shell=True
            )
            self._mmdc_available = result.returncode == 0
            if self._mmdc_available:
                ver = result.stdout.strip().split('\n')[-1]
                print(f"    mmdc available: v{ver}")
            else:
                print("    mmdc not available, diagrams will be placeholders")
        except Exception:
            self._mmdc_available = False
            print("    mmdc check failed, diagrams will be placeholders")
        return self._mmdc_available

    @staticmethod
    def _sanitize_mermaid(code: str) -> str:
        """Sanitize mermaid code for mmdc CLI compatibility.

        Handles:
        - Replaces \\n in node labels with <br/> (mermaid HTML labels)
        - Quotes bracket labels containing special chars like () or +
          which mmdc would otherwise misparse as shape delimiters
        """
        lines = code.split('\n')
        sanitized = []
        for line in lines:
            # Replace \n with <br/> inside bracket labels
            if '\\n' in line:
                line = re.sub(
                    r'\[([^\]"]*?\\n[^\]]*?)\]',
                    lambda m: '["' + m.group(1).replace('\\n', '<br/>') + '"]',
                    line
                )

            # Quote bracket labels containing parentheses or +
            # These characters cause mmdc to misinterpret the node shape
            # Only process labels that aren't already quoted
            line = re.sub(
                r'\[([^\]"]*?[()][^\]]*?)\]',
                lambda m: '["' + m.group(1) + '"]',
                line
            )
            line = re.sub(
                r'\[([^\]"]*?\+[^\]]*?)\]',
                lambda m: '["' + m.group(1) + '"]',
                line
            )

            sanitized.append(line)
        return '\n'.join(sanitized)

    def _render_mermaid(self, mermaid_code: str, output_path: str) -> bool:
        """Render mermaid code to PNG using mmdc."""
        if not self._check_mmdc():
            return False

        # Sanitize mermaid code for mmdc compatibility
        sanitized = self._sanitize_mermaid(mermaid_code)

        # Write mermaid code to a temp file
        tmp_dir = tempfile.mkdtemp(prefix="mermaid_")
        mmd_file = os.path.join(tmp_dir, "diagram.mmd")
        try:
            with open(mmd_file, "w", encoding="utf-8") as f:
                f.write(sanitized)

            # Ensure output directory exists
            os.makedirs(os.path.dirname(output_path), exist_ok=True)

            # Run mmdc
            result = subprocess.run(
                [
                    "npx", "-y", "@mermaid-js/mermaid-cli",
                    "-i", mmd_file,
                    "-o", output_path,
                    "-b", "white",
                    "-w", "1200",
                    "--scale", "2"
                ],
                capture_output=True, text=True, timeout=60,
                shell=True
            )
            if result.returncode == 0 and os.path.exists(output_path):
                return True
            else:
                stderr = result.stderr.strip()[:200] if result.stderr else ""
                print(f"    mmdc render failed: {stderr}")
                return False
        except Exception as e:
            print(f"    mmdc render error: {e}")
            return False
        finally:
            # Clean up temp file
            try:
                os.remove(mmd_file)
                os.rmdir(tmp_dir)
            except OSError:
                pass

    def resolve_next(self, mermaid_code: str = None) -> dict:
        """Get info for the next figure in current chapter.

        If no pre-rendered image is found and mermaid_code is provided,
        auto-renders the diagram to PNG.
        """
        self.figure_counter += 1
        fig_id = f"Figure {self.chapter_num}.{self.figure_counter}"
        fig_filename = f"fig_{self.chapter_num}_{self.figure_counter}.png"

        # Look for pre-rendered image
        patterns = [
            f"fig_{self.chapter_num}_{self.figure_counter}.png",
            f"fig_{self.chapter_num}_{self.figure_counter}.jpg",
            f"fig_{self.chapter_num}_{self.figure_counter}.svg",
        ]
        image_path = None
        if self.export_dir and os.path.isdir(self.export_dir):
            for pat in patterns:
                candidate = os.path.join(self.export_dir, pat)
                if os.path.exists(candidate):
                    image_path = candidate
                    break

        # Auto-render if no pre-rendered image found
        if image_path is None and mermaid_code:
            target_path = os.path.join(self.export_dir, fig_filename)
            print(f"    Rendering {fig_id} via mmdc...")
            if self._render_mermaid(mermaid_code, target_path):
                image_path = target_path
                print(f"    OK -> {fig_filename}")
            else:
                print(f"    SKIP -> placeholder for {fig_id}")

        return {
            "id": fig_id,
            "image_path": image_path,
        }


# ─────────────────────────────────────────────────────────────────────
# Front matter
# ─────────────────────────────────────────────────────────────────────

def create_cover_page(fmt: DocxFormatter, cover_data: dict):
    """Generate a formatted thesis cover page."""
    university_parent = cover_data.get("UNIVERSITY_PARENT", "Vietnam National University Ho Chi Minh City")
    university = cover_data.get("UNIVERSITY", "University of Economics and Law")
    department = cover_data.get("DEPARTMENT", "School of Finance and Banking")
    thesis_type = cover_data.get("THESIS_TYPE", "GRADUATION THESIS")
    thesis_title = cover_data.get("THESIS_TITLE", "[Thesis Title]")
    student_name = cover_data.get("STUDENT_NAME", "[Student Name]")
    student_id = cover_data.get("STUDENT_ID", "[Student ID]")
    student_class = cover_data.get("STUDENT_CLASS", "[Class]")
    supervisor_name = cover_data.get("SUPERVISOR_NAME", "[Supervisor]")
    city = cover_data.get("CITY", "Ho Chi Minh City")
    year = cover_data.get("YEAR", "2026")

    # University header
    p = fmt.doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run(university_parent.upper())
    fmt._set_run_font(run, font_size=Pt(14), bold=True)

    p = fmt.doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run(university.upper())
    fmt._set_run_font(run, font_size=Pt(14), bold=True)

    p = fmt.doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(6)
    run = p.add_run(department)
    fmt._set_run_font(run, font_size=Pt(13), bold=True)

    # Decorative line
    p = fmt.doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(6)
    run = p.add_run("\u2500" * 20)
    fmt._set_run_font(run, font_size=Pt(12))

    # Thesis type
    p = fmt.doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(48)
    p.paragraph_format.space_after = Pt(24)
    run = p.add_run(thesis_type.upper())
    fmt._set_run_font(run, font_size=Pt(18), bold=True)

    # Thesis title
    p = fmt.doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(48)
    run = p.add_run(thesis_title)
    fmt._set_run_font(run, font_size=Pt(16), bold=True)

    # Student and supervisor info (supervisor first)
    # Using a table or tab stops is best for alignment in docx, but we can simulate with tabs
    for label, value in [
        ("Supervisor", supervisor_name),
        ("Student name", student_name),
        ("Student ID", student_id),
        ("Class", student_class),
    ]:
        p = fmt.doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(5.0) # Indent the whole block
        p.paragraph_format.space_after = Pt(4)
        run = p.add_run(f"{label}")
        fmt._set_run_font(run, font_size=Pt(13))
        # Add tab and colon
        run = p.add_run(f"\t: ")
        fmt._set_run_font(run, font_size=Pt(13))
        run = p.add_run(value)
        fmt._set_run_font(run, font_size=Pt(13), bold=True)

    # City and year
    p = fmt.doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(72)
    run = p.add_run(f"{city} \u2013 {year}")
    fmt._set_run_font(run, font_size=Pt(13), bold=True)

    fmt.add_page_break()


def create_front_matter(fmt: DocxFormatter, cover_data: dict, outline_path: str):
    """Generate declaration, instructor comment, acknowledgment, abstract, TOC, abbreviations."""

    student_name = cover_data.get("STUDENT_NAME", "[Student Name]")
    student_id = cover_data.get("STUDENT_ID", "[Student ID]")
    student_class = cover_data.get("STUDENT_CLASS", "[Class]")
    supervisor_name = cover_data.get("SUPERVISOR_NAME", "[Supervisor Name]")
    thesis_type = cover_data.get("THESIS_TYPE", "graduation thesis")
    thesis_type_lower = thesis_type.lower()
    department = cover_data.get("DEPARTMENT", "[Department]")
    university = cover_data.get("UNIVERSITY", "[University]")

    # ── Declaration ──
    decl_title = cover_data.get("DECLARATION_TITLE", "DECLARATION")
    decl_text = cover_data.get("DECLARATION_TEXT", "")
    fmt.add_heading(decl_title, level=1)
    if decl_text:
        for para in decl_text.split("\n"):
            if para.strip():
                fmt.add_body_text(para.strip())
    else:
        fmt.add_body_text(
            f"I hereby declare that this {thesis_type_lower} is my own original "
            f"work, conducted under the supervision of {supervisor_name}. "
            f"The data, results, and findings presented herein are truthful "
            f"and have not been previously published in any other work."
        )
        fmt.add_body_text(
            f"I take full responsibility for the accuracy and integrity of "
            f"the content presented in this {thesis_type_lower}."
        )

    # Student info block
    p = fmt.doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_before = Pt(18)
    run = p.add_run(f"Student: {student_name}")
    fmt._set_run_font(run)
    p = fmt.doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(f"Student ID: {student_id}    Class: {student_class}")
    fmt._set_run_font(run)

    # Signature block
    p = fmt.doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_before = Pt(36)
    city = cover_data.get("CITY", "Ho Chi Minh City")
    run = p.add_run(f"{city}, .... / .... / 2026")
    fmt._set_run_font(run, italic=True)

    p = fmt.doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_before = Pt(12)
    run = p.add_run("Student")
    fmt._set_run_font(run, bold=True)

    p = fmt.doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_before = Pt(36)
    run = p.add_run(student_name)
    fmt._set_run_font(run)

    fmt.add_page_break()

    # Helper for assessment pages
    def add_assessment_page(title, reviewer_name, reviewer_label):
        fmt.add_heading(title, level=1)
        
        p = fmt.doc.add_paragraph()
        p.paragraph_format.space_before = Pt(6)
        run = p.add_run(f"{reviewer_label}: {reviewer_name}")
        fmt._set_run_font(run, bold=True)
        
        p = fmt.doc.add_paragraph()
        p.paragraph_format.space_before = Pt(12)
        run = p.add_run("1. Common contents")
        fmt._set_run_font(run, bold=True)

        dotted_line = "." * 120
        for _ in range(16):
            p = fmt.doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.line_spacing = 1.5
            p.paragraph_format.first_line_indent = None
            p.paragraph_format.left_indent = Pt(0)
            run = p.add_run(dotted_line)
            fmt._set_run_font(run, font_size=Pt(13))
            
        p = fmt.doc.add_paragraph()
        p.paragraph_format.space_before = Pt(12)
        run = p.add_run("2. Grade: ")
        fmt._set_run_font(run, bold=True)
        run = p.add_run("........................")
        fmt._set_run_font(run)
        
        p = fmt.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        p.paragraph_format.space_before = Pt(24)
        run = p.add_run(f"{city}, .... / .... / 2026")
        fmt._set_run_font(run, italic=True)

        p = fmt.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        p.paragraph_format.space_before = Pt(12)
        run = p.add_run(reviewer_label)
        fmt._set_run_font(run, bold=True)

        p = fmt.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        p.paragraph_format.space_before = Pt(36)
        run = p.add_run(reviewer_name)
        fmt._set_run_font(run)

        fmt.add_page_break()

    # ── Instructor's Assessment ──
    add_assessment_page("INSTRUCTOR'S ASSESSMENT", supervisor_name, "Instructor")

    # ── Reviewer's Assessment ──
    add_assessment_page("REVIEWER'S ASSESSMENT", "........................................................", "Reviewer")

    # ── Acknowledgements ──
    ack_title = cover_data.get("ACKNOWLEDGEMENT_TITLE", "ACKNOWLEDGEMENTS")
    ack_text = cover_data.get("ACKNOWLEDGEMENT_TEXT", "")
    fmt.add_heading(ack_title, level=1)
    if ack_text:
        for para in ack_text.split("\n"):
            if para.strip():
                fmt.add_body_text(para.strip())
    else:
        fmt.add_body_text(
            f"I would like to express my sincere gratitude to my supervisor, "
            f"{supervisor_name}, for his guidance and support throughout this "
            f"{thesis_type_lower}."
        )
        fmt.add_body_text(
            f"I also thank the faculty of the {department}, {university}, "
            f"for providing the academic foundation that made this work possible."
        )
        fmt.add_body_text(
            f"Finally, I would like to thank my family for their encouragement "
            f"and support throughout this journey."
        )
    fmt.add_page_break()

    # ── Abstract ──
    abstract_title = cover_data.get("ABSTRACT_TITLE", "ABSTRACT")
    abstract_text = cover_data.get("ABSTRACT_TEXT", "")
    abstract_keywords = cover_data.get("ABSTRACT_KEYWORDS", "")
    _, _, abbreviations = _extract_from_outline(outline_path)

    fmt.add_heading(abstract_title, level=1)
    if abstract_text:
        for para in abstract_text.split("\n"):
            if para.strip():
                fmt.add_body_text(para.strip())
        if abstract_keywords:
            segments = [("Keywords: ", True, False), (abstract_keywords, False, True)]
            fmt.add_rich_paragraph(segments)
    else:
        fmt.add_body_text("[Abstract to be updated]", italic=True)

    fmt.add_page_break()

    # ── TOC placeholder ──
    fmt.add_heading("TABLE OF CONTENTS", level=1)
    fmt.add_body_text(
        "[Table of Contents to be generated in Word: References > Table of Contents]",
        italic=True
    )
    fmt.add_page_break()

    # ── List of Figures ──
    fmt.add_heading("LIST OF FIGURES", level=1)
    figures = [
        ("Figure 4.1", "QuantVN Strategy Forge landing page showing platform coverage"),
        ("Figure 4.2", "Systematic analytical workflow on the QuantVN platform"),
        ("Figure 4.3", "Backtesting process flow integrating data quality validation and Vietnamese market cost parameters"),
        ("Figure 4.4", "Visual Strategy Builder showing a drag-and-drop RSI Reversal strategy"),
        ("Figure A.1", "Stock Screener interface with multi-criteria filtering across 412 HOSE-listed symbols"),
        ("Figure A.2", "Interactive Charts module showing stock analysis with price data, returns, volatility, and comparison workspace"),
        ("Figure A.3", "Portfolio Optimisation module with asset universe selection and Mean-Variance solver configuration"),
        ("Figure A.4", "Risk Management dashboard displaying VaR, Volatility, Beta, Maximum Drawdown, Sortino Ratio, drawdown history, and rolling volatility charts"),
    ]
    for fig_id, fig_caption in figures:
        p = fmt.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        fmt._set_paragraph_format(p, space_after=Pt(4), first_line_indent=None)
        run_id = p.add_run(f"{fig_id}: ")
        fmt._set_run_font(run_id, font_size=Pt(12), bold=True)
        run_cap = p.add_run(fig_caption)
        fmt._set_run_font(run_cap, font_size=Pt(12))
    fmt.add_page_break()

    # ── List of Tables ──
    fmt.add_heading("LIST OF TABLES", level=1)
    tables = [
        ("Table 2.1", "Feature comparison of platforms available to Vietnamese investors"),
        ("Table 3.1", "Research questions, hypotheses, and evaluation methods"),
        ("Table 3.2", "Dataset description"),
        ("Table 3.3", "Descriptive statistics of the OHLCV dataset (HOSE, 2018–2025)"),
        ("Table 4.1", "Key risk metrics provided by the platform"),
        ("Table A.1", "Research hypothesis evaluation summary"),
    ]
    for tbl_id, tbl_caption in tables:
        p = fmt.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        fmt._set_paragraph_format(p, space_after=Pt(4), first_line_indent=None)
        run_id = p.add_run(f"{tbl_id}: ")
        fmt._set_run_font(run_id, font_size=Pt(12), bold=True)
        run_cap = p.add_run(tbl_caption)
        fmt._set_run_font(run_cap, font_size=Pt(12))
    fmt.add_page_break()

    # ── Abbreviations (table format) ──
    fmt.add_heading("LIST OF ABBREVIATIONS", level=1)
    if abbreviations:
        # Create a 2-column table: Abbreviation | Meaning
        table = fmt.doc.add_table(rows=1, cols=2)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        # Add table borders via XML
        tbl = table._tbl
        tbl_pr = tbl.tblPr if tbl.tblPr is not None else parse_xml(f'<w:tblPr {nsdecls("w")}/>')
        borders = parse_xml(
            f'<w:tblBorders {nsdecls("w")}>'
            '<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
            '<w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
            '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
            '<w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
            '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
            '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
            '</w:tblBorders>'
        )
        tbl_pr.append(borders)

        # Header row
        hdr = table.rows[0]
        for i, text in enumerate(["Abbreviation", "Meaning"]):
            cell = hdr.cells[i]
            cell.text = ""
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run(text)
            fmt._set_run_font(run, font_size=Pt(12), bold=True)
            # Shade header
            shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="D9E2F3"/>')
            cell._tc.get_or_add_tcPr().append(shading)

        # Data rows
        for abbr, meaning in abbreviations:
            row = table.add_row()
            c0 = row.cells[0]
            c0.text = ""
            p = c0.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run(abbr)
            fmt._set_run_font(run, font_size=Pt(12), bold=True)

            c1 = row.cells[1]
            c1.text = ""
            p = c1.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            run = p.add_run(meaning)
            fmt._set_run_font(run, font_size=Pt(12))

        # Set column widths
        for row in table.rows:
            row.cells[0].width = Cm(4.0)
            row.cells[1].width = Cm(12.0)
    else:
        fmt.add_body_text("[Abbreviations to be updated]", italic=True)
    fmt.add_page_break()


def _extract_from_outline(outline_path: str) -> tuple:
    """Extract abstract and abbreviations from THESIS_5CH_FULL.md."""
    abstract_vi = []
    abstract_en = []
    abbreviations = []

    if not os.path.exists(outline_path):
        return abstract_vi, abstract_en, abbreviations

    with open(outline_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract abstract section
    abstract_match = re.search(
        r'## Abstract\n(.+?)(?=\n## |\Z)', content, re.DOTALL
    )
    if abstract_match:
        abstract_text = abstract_match.group(1).strip()
        # Split at "Keywords:" if present
        parts = abstract_text.split("Keywords:")
        main_text = parts[0].strip()
        for line in main_text.split("\n"):
            line = line.strip()
            if line:
                abstract_vi.append(line)

    # Extract abbreviations
    abbr_match = re.search(
        r'## Abbreviations\n(.+?)(?=\n## |\Z)', content, re.DOTALL
    )
    if abbr_match:
        for line in abbr_match.group(1).strip().split("\n"):
            line = line.strip()
            m = re.match(r'^-\s+(\w+):\s+(.+)$', line)
            if m:
                abbreviations.append((m.group(1), m.group(2)))

    return abstract_vi, abstract_en, abbreviations


# ─────────────────────────────────────────────────────────────────────
# Chapter renderer
# ─────────────────────────────────────────────────────────────────────

def render_chapter(fmt: DocxFormatter, blocks: list, fig_resolver: FigureResolver):
    """Render parsed markdown blocks into the document."""
    # Track figure captions from nearby paragraphs
    i = 0
    while i < len(blocks):
        block = blocks[i]

        if block.block_type == MarkdownBlock.HEADING:
            fmt.add_toc_heading(block.content, level=block.level)

        elif block.block_type == MarkdownBlock.PARAGRAPH:
            # Skip: figure captions handled by mermaid/image blocks
            fig_caption_match = re.match(
                r'^(Figure\s+\d+[\.]\d+)[:.]?\s*(.*)$', block.content
            )
            # Skip: table captions that immediately precede a TABLE block
            tbl_caption_match = re.match(
                r'^(Table\s+[A-Z]?[\d\.]+)[:.]?\s*(.*)', block.content
            )
            next_is_table = (
                i + 1 < len(blocks) and
                blocks[i + 1].block_type == MarkdownBlock.TABLE
            )
            if fig_caption_match:
                pass  # Already handled by the mermaid/image block above
            elif tbl_caption_match and next_is_table:
                pass  # Will be picked up BELOW the table by TABLE handler
            else:
                segments = parse_inline_formatting(block.content)
                fmt.add_rich_paragraph(segments)

        elif block.block_type == MarkdownBlock.TABLE:
            headers = block.content["headers"]
            rows = block.content["rows"]
            # Caption is in the PREVIOUS block (before the table in markdown)
            # but we render it BELOW the table for academic convention
            caption = None
            if i > 0 and blocks[i - 1].block_type == MarkdownBlock.PARAGRAPH:
                tbl_match = re.match(
                    r'^(Table\s+[A-Z]?[\d\.]+)[:.]?\s*(.*)',
                    blocks[i - 1].content
                )
                if tbl_match:
                    caption = blocks[i - 1].content
            fmt.add_table(headers, rows, caption=caption)

        elif block.block_type == MarkdownBlock.MERMAID:
            fig_info = fig_resolver.resolve_next(block.content)
            # Try to find caption in the next block
            caption = fig_info["id"]
            if i + 1 < len(blocks) and blocks[i + 1].block_type == MarkdownBlock.PARAGRAPH:
                next_text = blocks[i + 1].content
                fig_match = re.match(
                    r'^(Figure\s+\d+\.\d+)[:.]?\s*(.*)$', next_text
                )
                if fig_match:
                    caption = next_text
                    i += 1  # Skip the caption paragraph
            fmt.add_figure_placeholder(
                fig_info["id"], caption, fig_info["image_path"]
            )

        elif block.block_type == MarkdownBlock.CODE:
            # Render code as indented monospace text
            p = fmt.doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            fmt._set_paragraph_format(
                p, first_line_indent=None, left_indent=Cm(1.0),
                space_before=Pt(6), space_after=Pt(6)
            )
            run = p.add_run(block.content.rstrip())
            run.font.name = "Consolas"
            run.font.size = Pt(10)
            run.font.color.rgb = RGBColor(0x33, 0x33, 0x33)

        elif block.block_type == MarkdownBlock.BULLET:
            fmt.add_bullet(block.content, level=block.level)

        elif block.block_type == MarkdownBlock.NUMBERED:
            number = block.meta.get("number", 1)
            fmt.add_numbered_item(number, block.content, level=block.level)

        elif block.block_type == MarkdownBlock.IMAGE:
            img_path = block.meta.get("path", "")
            caption = block.content or ""
            # Resolve relative path against the thesis base directory
            base_dir = os.path.dirname(os.path.abspath(__file__))
            abs_img_path = os.path.join(base_dir, img_path) if not os.path.isabs(img_path) else img_path
            # Generate a figure ID from caption
            fig_match = re.match(r'^(Figure\s+\d+\.\d+)', caption)
            fig_id = fig_match.group(1) if fig_match else f"Figure"
            fmt.add_figure_placeholder(fig_id, caption, abs_img_path)

        i += 1


# ─────────────────────────────────────────────────────────────────────
# References renderer
# ─────────────────────────────────────────────────────────────────────

def render_references(fmt: DocxFormatter, ref_path: str):
    """Render references_apa.md as APA-formatted entries."""
    fmt.add_heading("TÀI LIỆU THAM KHẢO", level=1)

    if not os.path.exists(ref_path):
        fmt.add_body_text("[References file not found]", italic=True)
        return

    with open(ref_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    idx = 0
    for line in lines:
        stripped = line.strip()
        # Skip heading and empty lines
        if not stripped or stripped.startswith('#'):
            continue
        idx += 1
        fmt.add_reference_entry(idx, stripped)


# ─────────────────────────────────────────────────────────────────────
# Page number footer helper
# ─────────────────────────────────────────────────────────────────────

def add_page_number_footer(section, font_name: str = "Times New Roman"):
    """Add a centered footer with Arabic page number to a section."""
    from docx.oxml.ns import qn
    from docx.oxml import parse_xml

    footer = section.footer
    footer.is_linked_to_previous = False

    # Clear any existing paragraphs
    for p in footer.paragraphs:
        p._element.getparent().remove(p._element)

    # Build footer paragraph with centered page number field
    footer_para = footer.add_paragraph()
    footer_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    pf = footer_para.paragraph_format
    pf.space_before = Pt(6)
    pf.space_after = Pt(0)

    run = footer_para.add_run()
    run.font.name = font_name
    run.font.size = Pt(12)

    # Insert PAGE field: <w:fldChar w:fldCharType="begin"/>
    fld_begin = parse_xml(
        f'<w:fldChar {nsdecls("w")} w:fldCharType="begin"/>'
    )
    run._element.append(fld_begin)

    # Separate run for instrText
    run2 = footer_para.add_run()
    run2.font.name = font_name
    run2.font.size = Pt(12)
    instr = parse_xml(
        f'<w:instrText {nsdecls("w")} xml:space="preserve"> PAGE </w:instrText>'
    )
    run2._element.append(instr)

    # Separate run for field end
    run3 = footer_para.add_run()
    run3.font.name = font_name
    run3.font.size = Pt(12)
    fld_end = parse_xml(
        f'<w:fldChar {nsdecls("w")} w:fldCharType="end"/>'
    )
    run3._element.append(fld_end)


# ─────────────────────────────────────────────────────────────────────
# Chapter number from filename
# ─────────────────────────────────────────────────────────────────────

def extract_chapter_number(filename: str) -> int:
    """Extract chapter number from filename like 'ch3_xxx.md'."""
    m = re.match(r'ch(\d+)', os.path.basename(filename))
    return int(m.group(1)) if m else 0


# ─────────────────────────────────────────────────────────────────────
# Main pipeline
# ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate thesis DOCX")
    parser.add_argument("--config", default=DEFAULT_CONFIG,
                        help="Path to thesis_build_config.json")
    args = parser.parse_args()

    # Resolve paths relative to script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(script_dir, args.config)

    print(f"📋 Loading config: {config_path}")
    config = load_config(config_path)

    # Resolve all paths relative to script_dir
    def resolve(p):
        return os.path.join(script_dir, p) if not os.path.isabs(p) else p

    cover_template = resolve(config["cover_template"])
    cover_data_path = resolve(config["cover_data"])
    chapter_files = [resolve(c) for c in config["chapters"]]
    ref_path = resolve(config["references"])
    appendix_files = [resolve(a) for a in config.get("appendices", [])]
    figures_dir = resolve(config.get("figures_dir", "figures"))
    export_dir = resolve(config.get("mermaid_export_dir", "figures/_export"))
    outline_path = resolve(config.get("outline", "THESIS_5CH_FULL.md"))
    output_path = resolve(config["output"])

    # Load cover data
    with open(cover_data_path, "r", encoding="utf-8-sig") as f:
        cover_data = json.load(f)

    # Create document from template
    if os.path.exists(cover_template):
        doc = Document(cover_template)
        print(f"📄 Loaded cover template: {cover_template}")
    else:
        doc = Document()
        print("⚠️  Cover template not found, creating blank document")

    # Set default font
    try:
        style = doc.styles["Normal"]
        font = style.font
        font.name = "Times New Roman"
        font.size = Pt(13)
    except KeyError:
        pass

    # New section for thesis front matter (cover + TOC — no page numbers)
    new_section = doc.add_section()
    margins = config["formatting"]["page_margins"]
    new_section.page_width = Cm(21.0)
    new_section.page_height = Cm(29.7)
    new_section.top_margin = Cm(margins["top_cm"])
    new_section.bottom_margin = Cm(margins["bottom_cm"])
    new_section.left_margin = Cm(margins["left_cm"])
    new_section.right_margin = Cm(margins["right_cm"])
    # Ensure no footer in the front matter section
    new_section.footer.is_linked_to_previous = False

    # Create formatter
    fmt = DocxFormatter(doc, config["formatting"])
    fig_resolver = FigureResolver(figures_dir, export_dir)

    # ── Cover page ──
    print("📄 Generating cover page...")
    create_cover_page(fmt, cover_data)

    # ── Front matter ──
    print("📝 Generating front matter...")
    create_front_matter(fmt, cover_data, outline_path)

    # ── Chapters: start a new section with page numbers from 1 ──
    font_name = config["formatting"].get("font_name", "Times New Roman")
    chapter_section = doc.add_section()
    chapter_section.page_width = Cm(21.0)
    chapter_section.page_height = Cm(29.7)
    chapter_section.top_margin = Cm(margins["top_cm"])
    chapter_section.bottom_margin = Cm(margins["bottom_cm"])
    chapter_section.left_margin = Cm(margins["left_cm"])
    chapter_section.right_margin = Cm(margins["right_cm"])
    # Add page number footer and restart numbering from 1
    add_page_number_footer(chapter_section, font_name)
    from docx.oxml import OxmlElement
    sect_pr = chapter_section._sectPr
    pg_num_type = OxmlElement('w:pgNumType')
    pg_num_type.set(qn('w:start'), '1')
    sect_pr.append(pg_num_type)

    # ── Pre-scan: register all Figure/Table labels for cross-references ──
    all_md_files = chapter_files + appendix_files
    label_pattern = re.compile(r'((?:Figure|Table|Hình|Bảng)\s+[A-Z]?\d+\.\d+)')
    for md_file in all_md_files:
        if not os.path.exists(md_file):
            continue
        with open(md_file, "r", encoding="utf-8-sig") as f:
            content = f.read()
        for m in label_pattern.finditer(content):
            ref_key = m.group(1)
            if ref_key not in fmt._bookmarks:
                bm_name = '_' + ref_key.replace(' ', '_').replace('.', '_')
                fmt._bookmarks[ref_key] = bm_name
    print(f"   🔗 Pre-registered {len(fmt._bookmarks)} cross-reference labels")

    for ch_file in chapter_files:
        if not os.path.exists(ch_file):
            print(f"⚠️  Chapter file not found: {ch_file}")
            continue

        ch_num = extract_chapter_number(ch_file)
        ch_name = os.path.basename(ch_file)
        print(f"📖 Rendering chapter {ch_num}: {ch_name}")

        fig_resolver.set_chapter(ch_num)
        blocks = parse_markdown_file(ch_file)
        render_chapter(fmt, blocks, fig_resolver)
        fmt.add_page_break()

    # ── References ──
    print("📚 Rendering references...")
    render_references(fmt, ref_path)
    fmt.add_page_break()

    # ── Appendices ──
    if appendix_files:
        for app_file in appendix_files:
            if not os.path.exists(app_file):
                print(f"⚠️  Appendix file not found: {app_file}")
                continue
            app_name = os.path.basename(app_file)
            print(f"📎 Rendering appendix: {app_name}")
            blocks = parse_markdown_file(app_file)
            render_chapter(fmt, blocks, fig_resolver)
            fmt.add_page_break()

    # ── Save ──
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc.save(output_path)

    print(f"\n✅ Thesis generated: {output_path}")
    print(f"   📋 Cover → Declaration → Instructor's Comments → Acknowledgements → Abstract")
    print(f"   📋 Table of Contents → List of Figures/Tables → Abbreviations")
    print(f"   📖 {len([f for f in chapter_files if os.path.exists(f)])} chapters rendered")
    print(f"   📚 References (APA format)")
    if appendix_files:
        print(f"   📎 {len([f for f in appendix_files if os.path.exists(f)])} appendices")
    print(f"\n💡 Tip: Open in Word and use References → Table of Contents to generate TOC")


if __name__ == "__main__":
    main()
