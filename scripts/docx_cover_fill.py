#!/usr/bin/env python3
"""
Replace cover markers in a DOCX while preserving existing layout.

This script only performs text replacement inside existing XML parts.
It does not insert new paragraphs/tables/shapes, which helps keep cover
positioning stable.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import tempfile
import zipfile
from pathlib import Path


def load_data(path: Path) -> dict[str, str]:
    with path.open("r", encoding="utf-8") as f:
        raw = json.load(f)
    return {str(k): "" if v is None else str(v) for k, v in raw.items()}


def build_replacements(data: dict[str, str]) -> dict[str, str]:
    out: dict[str, str] = {}

    # Placeholder style: {{KEY}}
    for k, v in data.items():
        out[f"{{{{{k}}}}}"] = v

    thesis_title = data.get("THESIS_TITLE", "").strip()
    student_name = data.get("STUDENT_NAME", "").strip()
    student_id = data.get("STUDENT_ID", "").strip()
    supervisor_name = data.get("SUPERVISOR_NAME", "").strip()
    city = data.get("CITY", "").strip()
    year = data.get("YEAR", "").strip()

    # Legacy cover labels.
    if supervisor_name:
        out["GVHD:"] = f"GVHD: {supervisor_name}"
    if student_name:
        out["SVTH:"] = f"SVTH: {student_name}"
    if student_id:
        out["MSSV:"] = f"MSSV: {student_id}"
    if thesis_title:
        out["TÊN ĐỀ TÀI"] = thesis_title
        out["TEN DE TAI"] = thesis_title
    if city:
        out["TP.HCM,"] = f"{city},"
    if year:
        out["/…."] = year
        out["/..."] = year

    return out


def replace_text(content: str, replacements: dict[str, str]) -> str:
    updated = content
    for src, dst in replacements.items():
        updated = updated.replace(src, dst)
    return updated


def process_docx(template: Path, output: Path, replacements: dict[str, str]) -> None:
    target_parts = {
        "word/document.xml",
    }

    with tempfile.TemporaryDirectory(prefix="cover_fill_") as tmp_dir:
        tmp_zip = Path(tmp_dir) / "out.zip"
        with zipfile.ZipFile(template, "r") as zin, zipfile.ZipFile(tmp_zip, "w", zipfile.ZIP_DEFLATED) as zout:
            for info in zin.infolist():
                data = zin.read(info.filename)
                if info.filename in target_parts or info.filename.startswith("word/header") or info.filename.startswith("word/footer"):
                    text = data.decode("utf-8")
                    text = replace_text(text, replacements)
                    data = text.encode("utf-8")
                zout.writestr(info, data)

        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(tmp_zip, output)


def main() -> int:
    parser = argparse.ArgumentParser(description="Fill school cover DOCX without reflowing layout.")
    parser.add_argument("--template", required=True, help="Path to source DOCX template.")
    parser.add_argument("--data", required=True, help="Path to JSON data file.")
    parser.add_argument("--output", required=True, help="Path to output DOCX.")
    args = parser.parse_args()

    template = Path(args.template).resolve()
    data_path = Path(args.data).resolve()
    output = Path(args.output).resolve()

    if not template.exists():
        raise FileNotFoundError(f"Template not found: {template}")
    if not data_path.exists():
        raise FileNotFoundError(f"Data JSON not found: {data_path}")

    data = load_data(data_path)
    replacements = build_replacements(data)
    process_docx(template, output, replacements)

    print(f"DOCX generated: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

