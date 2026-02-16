#!/usr/bin/env python3

from __future__ import annotations

import csv
import json
import os
import sys
from collections import Counter
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable


FUNDAMENTALS_FILES = {
  "bs": "HOSE_VERIFIED_BalanceSheet_Quarterly_2018_2025.csv",
  "is": "HOSE_VERIFIED_IncomeStatement_Quarterly_2018_2025.csv",
  "cf": "HOSE_VERIFIED_CashFlow_Quarterly_2018_2025.csv",
}

METADATA_CANDIDATES = [
  "stock_metadata_2018_2025.csv",
  "HOSE_VERIFIED_2020_2025.csv",
]


def _unique_paths(paths: Iterable[Path]) -> list[Path]:
  seen: set[str] = set()
  out: list[Path] = []
  for p in paths:
    resolved = str(p.resolve())
    if resolved in seen:
      continue
    seen.add(resolved)
    out.append(Path(resolved))
  return out


def get_data_dir_candidates(project_root: Path) -> list[Path]:
  configured = os.environ.get("DATA_DIR", "").strip()
  candidates: list[Path] = []
  if configured:
    candidates.append(Path(configured))
  candidates.append(project_root.parent / "data")
  candidates.append(project_root / "public" / "data")
  return _unique_paths(candidates)


def resolve_first_existing_file(file_name: str, dir_candidates: list[Path]) -> Path | None:
  for dir_path in dir_candidates:
    candidate = dir_path / file_name
    if candidate.exists() and candidate.is_file():
      return candidate
  return None


def resolve_first_existing_from_candidates(
  file_names: list[str], dir_candidates: list[Path]
) -> tuple[str | None, Path | None]:
  for name in file_names:
    resolved = resolve_first_existing_file(name, dir_candidates)
    if resolved is not None:
      return name, resolved
  return None, None


def normalize_symbol(raw: object) -> str | None:
  if raw is None:
    return None
  symbol = str(raw).strip().upper()
  if not symbol:
    return None
  # Vietnam stock symbols should start with a letter; reject purely numeric fragments
  # that often appear when CSV rows are split across lines.
  if len(symbol) > 10 or not symbol[0].isalpha():
    return None
  if not all(ch.isalnum() for ch in symbol):
    return None
  return symbol


def read_active_symbols(metadata_path: Path | None) -> set[str]:
  if metadata_path is None:
    return set()
  with metadata_path.open("r", encoding="utf-8-sig", newline="") as f:
    reader = csv.DictReader(f)
    out: set[str] = set()
    for row in reader:
      symbol = normalize_symbol(row.get("symbol") or row.get("ticker"))
      status = str(row.get("status") or "").strip().upper()
      if symbol and status == "ACTIVE":
        out.add(symbol)
    return out


@dataclass(frozen=True)
class CsvIntegrityStats:
  path: str
  total_rows: int
  distinct_symbols: int
  missing_symbol_rows: int
  short_rows: int
  extra_column_rows: int
  extra_column_symbol_counts: dict[str, int]
  column_issue_samples: list[dict]
  invalid_key_rows: int
  invalid_key_samples: list[dict]
  duplicate_key_rows: int
  empty_payload_rows: int
  header_columns: int
  columns: list[str]


def scan_statement_csv(path: Path) -> tuple[CsvIntegrityStats, set[str]]:
  total_rows = 0
  missing_symbol_rows = 0
  short_rows = 0
  extra_column_rows = 0
  invalid_key_rows = 0
  duplicate_key_rows = 0
  empty_payload_rows = 0
  column_issue_samples: list[dict] = []
  invalid_key_samples: list[dict] = []
  extra_column_symbol_counts: Counter[str] = Counter()

  symbols: set[str] = set()
  seen_keys: set[tuple[str, str, str]] = set()

  with path.open("r", encoding="utf-8-sig", newline="") as f:
    reader = csv.reader(f)
    try:
      header = next(reader)
    except StopIteration:
      header = []

    columns = [c.strip() for c in header]
    # PapaParse is tolerant of duplicate headers; mirror that by de-duping field names.
    lower: list[str] = []
    seen_headers: Counter[str] = Counter()
    for col in header:
      base = col.replace("\ufeff", "").strip().lower()
      if not base:
        base = "__empty__"
      seen_headers[base] += 1
      if seen_headers[base] == 1:
        lower.append(base)
      else:
        lower.append(f"{base}__{seen_headers[base]}")
    ncols = len(columns)

    def col_index(*names: str) -> int | None:
      for name in names:
        try:
          return lower.index(name)
        except ValueError:
          continue
      return None

    # Prefer leading `ticker` over trailing `symbol` columns (some files contain both).
    symbol_idx = col_index("ticker", "symbol")
    year_idx = col_index("yearreport")
    len_idx = col_index("lengthreport")

    for line_no, row in enumerate(reader, start=2):
      if not row or all(not (cell or "").strip() for cell in row):
        continue

      total_rows += 1

      if ncols and len(row) > ncols:
        extra_column_rows += 1
        if row and row[0]:
          maybe_symbol = normalize_symbol(row[0])
          if maybe_symbol:
            extra_column_symbol_counts[maybe_symbol] += 1
        if len(column_issue_samples) < 10:
          column_issue_samples.append(
            {
              "line": line_no,
              "type": "extra_columns",
              "expected_cols": ncols,
              "actual_cols": len(row),
            }
          )

      # Rows may omit trailing empty fields; that's ok. But we still require that
      # ticker/year/length exist in their expected early positions.
      required_min_cols = 3
      if len(row) < required_min_cols:
        short_rows += 1
        if len(column_issue_samples) < 10:
          column_issue_samples.append(
            {"line": line_no, "type": "short_row", "actual_cols": len(row)}
          )

      # Build a tolerant mapping for the known columns we care about.
      if ncols:
        if len(row) < ncols:
          padded = list(row) + [""] * (ncols - len(row))
          row_main = padded[:ncols]
          row_extra: list[str] = []
        else:
          row_main = row[:ncols]
          row_extra = row[ncols:]
      else:
        row_main = row
        row_extra = []

      row_map = {lower[i]: row_main[i] for i in range(min(ncols, len(row_main)))}
      if row_extra:
        row_map["__extra__"] = ",".join(row_extra)

      raw_symbol = None
      if symbol_idx is not None and symbol_idx < len(row_main):
        raw_symbol = row_main[symbol_idx]
      else:
        raw_symbol = row_map.get("ticker") or row_map.get("symbol") or (row_main[0] if row_main else None)
      symbol = normalize_symbol(raw_symbol)
      if symbol is None:
        # If `ticker` looks broken, try the other column (some schemas place it under `symbol`).
        symbol = normalize_symbol(row_map.get("symbol"))
      if symbol is None:
        missing_symbol_rows += 1
      else:
        symbols.add(symbol)

      year = ""
      length = ""
      if year_idx is not None and year_idx < len(row_main):
        year = row_main[year_idx].strip()
      else:
        year = (row_map.get("yearreport") or "").strip()
      if len_idx is not None and len_idx < len(row_main):
        length = row_main[len_idx].strip()
      else:
        length = (row_map.get("lengthreport") or "").strip()
      if symbol and year and length:
        try:
          year_int = int(float(year))
          length_int = int(float(length))
        except ValueError:
          year_int = -1
          length_int = -1

        if not (1990 <= year_int <= 2100) or not (1 <= length_int <= 4):
          invalid_key_rows += 1
          if len(invalid_key_samples) < 10:
            invalid_key_samples.append(
              {"line": line_no, "ticker": symbol, "yearReport": year, "lengthReport": length}
            )
        else:
          key = (symbol, str(year_int), str(length_int))
          if key in seen_keys:
            duplicate_key_rows += 1
          else:
            seen_keys.add(key)
      elif symbol:
        invalid_key_rows += 1
        if len(invalid_key_samples) < 10:
          invalid_key_samples.append(
            {"line": line_no, "ticker": symbol, "yearReport": year, "lengthReport": length}
          )

      if ncols and len(row) == ncols:
        payload_indices = [
          i
          for i in range(ncols)
          if i not in {symbol_idx, year_idx, len_idx}
        ]
        if payload_indices and all(not row[i].strip() for i in payload_indices):
          empty_payload_rows += 1

  stats = CsvIntegrityStats(
    path=str(path),
    total_rows=total_rows,
    distinct_symbols=len(symbols),
    missing_symbol_rows=missing_symbol_rows,
    short_rows=short_rows,
    extra_column_rows=extra_column_rows,
    extra_column_symbol_counts=dict(extra_column_symbol_counts),
    column_issue_samples=column_issue_samples,
    invalid_key_rows=invalid_key_rows,
    invalid_key_samples=invalid_key_samples,
    duplicate_key_rows=duplicate_key_rows,
    empty_payload_rows=empty_payload_rows,
    header_columns=ncols,
    columns=columns,
  )
  return stats, symbols


def main() -> int:
  project_root = Path(__file__).resolve().parents[1]
  dir_candidates = get_data_dir_candidates(project_root)

  metadata_name, metadata_path = resolve_first_existing_from_candidates(METADATA_CANDIDATES, dir_candidates)
  active_symbols = read_active_symbols(metadata_path)

  resolved = {k: resolve_first_existing_file(v, dir_candidates) for k, v in FUNDAMENTALS_FILES.items()}
  missing_files = [k for k, p in resolved.items() if p is None]
  if missing_files:
    print(f"[audit] missing fundamentals files: {', '.join(missing_files)}", file=sys.stderr)
    for k, p in resolved.items():
      print(f"[audit] {k}: {p}", file=sys.stderr)
    return 2

  per_file_stats: dict[str, CsvIntegrityStats] = {}
  per_file_symbols: dict[str, set[str]] = {}
  for key, file_path in resolved.items():
    stats, symbols = scan_statement_csv(file_path)  # type: ignore[arg-type]
    per_file_stats[key] = stats
    per_file_symbols[key] = symbols

  union_symbols: set[str] = set().union(*per_file_symbols.values())
  missing_by_file = {k: sorted(active_symbols - s) for k, s in per_file_symbols.items()}
  missing_all = sorted(active_symbols - union_symbols)

  counts = {
    "active_symbols_total": len(active_symbols),
    "active_symbols_source": str(metadata_path) if metadata_path else None,
    "active_symbols_source_name": metadata_name,
    "has_bs": len(active_symbols & per_file_symbols["bs"]),
    "has_is": len(active_symbols & per_file_symbols["is"]),
    "has_cf": len(active_symbols & per_file_symbols["cf"]),
    "missing_bs": len(missing_by_file["bs"]),
    "missing_is": len(missing_by_file["is"]),
    "missing_cf": len(missing_by_file["cf"]),
    "missing_all_three": len(missing_all),
  }

  artifacts_dir = project_root / "artifacts"
  artifacts_dir.mkdir(parents=True, exist_ok=True)

  report_path = artifacts_dir / "fundamentals_integrity_audit.json"
  report = {
    "data_dir_candidates": [str(p) for p in dir_candidates],
    "resolved_files": {k: str(v) for k, v in resolved.items()},
    "counts": counts,
    "integrity": {k: asdict(v) for k, v in per_file_stats.items()},
    "missing_symbols_samples": {
      "missing_all_three": missing_all[:50],
      "missing_bs": missing_by_file["bs"][:50],
      "missing_is": missing_by_file["is"][:50],
      "missing_cf": missing_by_file["cf"][:50],
    },
  }
  report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

  # Also write a compact CSV for missing-all-three (useful for quick greps).
  missing_csv_path = artifacts_dir / "fundamentals_missing_all_three.csv"
  missing_csv_path.write_text("symbol\n" + "\n".join(missing_all) + "\n", encoding="utf-8")

  print(f"[audit] report: {report_path}")
  print(f"[audit] missing-all-three: {missing_csv_path}")
  for key in ["bs", "is", "cf"]:
    print(f"[audit] {key}: rows={per_file_stats[key].total_rows}, symbols={per_file_stats[key].distinct_symbols}")

  integrity_summary = Counter()
  for key, stats in per_file_stats.items():
    integrity_summary[f"{key}.short_rows"] = stats.short_rows
    integrity_summary[f"{key}.extra_column_rows"] = stats.extra_column_rows
    integrity_summary[f"{key}.invalid_key_rows"] = stats.invalid_key_rows
    integrity_summary[f"{key}.duplicate_key_rows"] = stats.duplicate_key_rows
    integrity_summary[f"{key}.empty_payload_rows"] = stats.empty_payload_rows
    integrity_summary[f"{key}.missing_symbol_rows"] = stats.missing_symbol_rows

  print("[audit] coverage:", json.dumps(counts, ensure_ascii=False))
  print("[audit] integrity:", json.dumps(dict(integrity_summary), ensure_ascii=False))

  return 0


if __name__ == "__main__":
  raise SystemExit(main())
