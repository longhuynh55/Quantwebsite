import argparse
import csv
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple


EMPTY_TOKENS = {
    "",
    "na",
    "n/a",
    "nan",
    "null",
    "none",
    "-",
    "--",
}


KEY_COLS = ("symbol", "yearReport", "lengthReport")

SCRIPT_DIR = Path(__file__).resolve().parent
QUANT_WEBSITE_DIR = SCRIPT_DIR.parent
WORKSPACE_DIR = QUANT_WEBSITE_DIR.parent


def _norm(value: Optional[str]) -> str:
    return (value or "").strip()


def _norm_symbol(value: Optional[str]) -> str:
    return _norm(value).upper()


def _is_empty_cell(value: Optional[str]) -> bool:
    v = _norm(value)
    if not v:
        return True
    return v.lower() in EMPTY_TOKENS


def read_symbol_universe(path: Path) -> Set[str]:
    symbols: Set[str] = set()
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sym = _norm_symbol(row.get("symbol") or row.get("ticker"))
            if sym:
                symbols.add(sym)
    return symbols


@dataclass(frozen=True)
class MalformedRow:
    line: int
    expected_cols: int
    actual_cols: int


@dataclass(frozen=True)
class EmptyBesidesKeysRow:
    line: int
    symbol: str
    year_report: str
    length_report: str


@dataclass(frozen=True)
class DuplicateKey:
    symbol: str
    year_report: str
    length_report: str
    first_line: int
    count: int
    lines_sample: List[int]


@dataclass
class FileAudit:
    file: str
    header_cols: int
    data_rows: int
    unique_symbols: int
    present_symbols: Set[str]
    missing_symbols: List[str]
    symbols_only_empty: List[str]
    duplicates: List[DuplicateKey]
    duplicate_rows_total: int
    malformed_rows: List[MalformedRow]
    malformed_key_rows: int
    empty_besides_keys_rows: List[EmptyBesidesKeysRow]
    ticker_symbol_mismatches: int


def _find_col_index(header: Sequence[str], name: str) -> Optional[int]:
    for i, col in enumerate(header):
        if col == name:
            return i
    return None


def _canonical_symbol(
    row: Sequence[str],
    symbol_idx: Optional[int],
    ticker_idx: Optional[int],
) -> str:
    symbol = _norm_symbol(row[symbol_idx]) if symbol_idx is not None and symbol_idx < len(row) else ""
    ticker = _norm_symbol(row[ticker_idx]) if ticker_idx is not None and ticker_idx < len(row) else ""
    return symbol or ticker


def audit_financial_csv(
    path: Path,
    *,
    master_symbols: Optional[Set[str]] = None,
    max_empty_samples: int = 20000,
    max_duplicate_line_samples_per_key: int = 20,
) -> FileAudit:
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        if not header:
            raise RuntimeError(f"Empty CSV (no header): {path}")

        header_cols = len(header)
        symbol_idx = _find_col_index(header, "symbol")
        ticker_idx = _find_col_index(header, "ticker")
        year_idx = _find_col_index(header, "yearReport")
        length_idx = _find_col_index(header, "lengthReport")

        if year_idx is None or length_idx is None:
            raise RuntimeError(
                f"Missing required key columns in {path.name}; expected {KEY_COLS}, got: {header[:10]}..."
            )
        if symbol_idx is None and ticker_idx is None:
            raise RuntimeError(f"Missing both 'symbol' and 'ticker' columns in {path.name}")

        key_symbol_idx = ticker_idx if ticker_idx is not None else symbol_idx

        ignore_indices = {year_idx, length_idx}
        if symbol_idx is not None:
            ignore_indices.add(symbol_idx)
        if ticker_idx is not None:
            ignore_indices.add(ticker_idx)

        present_symbols: Set[str] = set()
        total_rows = 0
        malformed_rows: List[MalformedRow] = []
        malformed_key_rows = 0
        empty_besides_keys_rows: List[EmptyBesidesKeysRow] = []
        ticker_symbol_mismatches = 0

        rows_by_symbol: Dict[str, int] = {}
        meaningful_rows_by_symbol: Dict[str, int] = {}
        wellformed_rows_by_symbol: Dict[str, int] = {}

        key_first_line: Dict[Tuple[str, str, str], int] = {}
        key_counts: Dict[Tuple[str, str, str], int] = {}
        key_duplicate_samples: Dict[Tuple[str, str, str], List[int]] = {}
        duplicate_rows_total = 0

        for i, row in enumerate(reader, start=2):
            total_rows += 1
            original_len = len(row)
            row_well_formed = original_len == header_cols
            if not row_well_formed:
                malformed_rows.append(MalformedRow(line=i, expected_cols=header_cols, actual_cols=len(row)))
                if len(row) < header_cols:
                    row = row + ([""] * (header_cols - len(row)))
                else:
                    row = row[:header_cols]

            year_report = _norm(row[year_idx])
            length_report = _norm(row[length_idx])
            symbol = _norm_symbol(row[key_symbol_idx]) if key_symbol_idx is not None else ""

            if row_well_formed and symbol_idx is not None and ticker_idx is not None:
                ticker = _norm_symbol(row[ticker_idx])
                sym_raw = _norm_symbol(row[symbol_idx])
                if ticker and sym_raw and ticker != sym_raw:
                    ticker_symbol_mismatches += 1

            if not symbol or not year_report or not length_report:
                malformed_key_rows += 1
                continue

            present_symbols.add(symbol)
            rows_by_symbol[symbol] = rows_by_symbol.get(symbol, 0) + 1
            if row_well_formed:
                wellformed_rows_by_symbol[symbol] = wellformed_rows_by_symbol.get(symbol, 0) + 1

            key = (symbol, year_report, length_report)
            if key not in key_first_line:
                key_first_line[key] = i
                key_counts[key] = 1
            else:
                key_counts[key] += 1
                duplicate_rows_total += 1
                samples = key_duplicate_samples.setdefault(key, [])
                if len(samples) < max_duplicate_line_samples_per_key:
                    samples.append(i)

            # Evaluate emptiness only based on cells actually present in the CSV row.
            # (Missing trailing columns are common and should not be treated as "empty".)
            cells_to_check = row[: min(original_len, header_cols)]
            is_empty_besides_keys = True
            for idx, cell in enumerate(cells_to_check):
                if idx in ignore_indices:
                    continue
                if not _is_empty_cell(cell):
                    is_empty_besides_keys = False
                    break

            if is_empty_besides_keys:
                if len(empty_besides_keys_rows) < max_empty_samples:
                    empty_besides_keys_rows.append(
                        EmptyBesidesKeysRow(
                            line=i,
                            symbol=symbol,
                            year_report=year_report,
                            length_report=length_report,
                        )
                    )
            else:
                meaningful_rows_by_symbol[symbol] = meaningful_rows_by_symbol.get(symbol, 0) + 1

        duplicates: List[DuplicateKey] = []
        for (symbol, year_report, length_report), count in key_counts.items():
            if count <= 1:
                continue
            duplicates.append(
                DuplicateKey(
                    symbol=symbol,
                    year_report=year_report,
                    length_report=length_report,
                    first_line=key_first_line[(symbol, year_report, length_report)],
                    count=count,
                    lines_sample=key_duplicate_samples.get((symbol, year_report, length_report), []),
                )
            )
        duplicates.sort(key=lambda d: (d.symbol, d.year_report, d.length_report))

        only_empty = sorted(
            sym
            for sym, wf in wellformed_rows_by_symbol.items()
            if wf > 0 and meaningful_rows_by_symbol.get(sym, 0) == 0
        )

        missing_symbols: List[str] = []
        if master_symbols is not None:
            missing_symbols = sorted(sym for sym in master_symbols if sym not in present_symbols)

        return FileAudit(
            file=str(path),
            header_cols=header_cols,
            data_rows=total_rows,
            unique_symbols=len(present_symbols),
            present_symbols=present_symbols,
            missing_symbols=missing_symbols,
            symbols_only_empty=only_empty,
            duplicates=duplicates,
            duplicate_rows_total=duplicate_rows_total,
            malformed_rows=malformed_rows,
            malformed_key_rows=malformed_key_rows,
            empty_besides_keys_rows=empty_besides_keys_rows,
            ticker_symbol_mismatches=ticker_symbol_mismatches,
        )


def _write_csv(path: Path, header: Sequence[str], rows: Iterable[Sequence[object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(list(header))
        for r in rows:
            writer.writerow(list(r))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Audit financial statement CSVs for missing symbols, duplicate keys, malformed rows, and empty rows."
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=WORKSPACE_DIR / "data",
        help="Directory containing raw CSVs (default: <workspace>/data).",
    )
    parser.add_argument(
        "--symbols-csv",
        type=Path,
        default=WORKSPACE_DIR / "data" / "HOSE_VERIFIED_2020_2025.csv",
        help=(
            "CSV with a 'symbol' column used as the symbol universe "
            "(default: <workspace>/data/HOSE_VERIFIED_2020_2025.csv)."
        ),
    )
    parser.add_argument(
        "--files",
        type=str,
        nargs="*",
        default=[
            "HOSE_VERIFIED_BalanceSheet_Quarterly_2018_2025.csv",
            "HOSE_VERIFIED_IncomeStatement_Quarterly_2018_2025.csv",
            "HOSE_VERIFIED_CashFlow_Quarterly_2018_2025.csv",
        ],
        help="Financial CSV filenames under --data-dir.",
    )
    parser.add_argument(
        "--artifacts-dir",
        type=Path,
        default=QUANT_WEBSITE_DIR / "artifacts",
        help="Directory to write audit outputs (default: quant-website/artifacts/).",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit with code 1 if any issues are found.",
    )
    args = parser.parse_args()

    master_symbols: Optional[Set[str]] = None
    if args.symbols_csv.exists():
        master_symbols = read_symbol_universe(args.symbols_csv)

    audits: Dict[str, FileAudit] = {}
    for name in args.files:
        p = args.data_dir / name
        if not p.exists():
            raise RuntimeError(f"Missing CSV: {p}")
        audits[name] = audit_financial_csv(p, master_symbols=master_symbols)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    base = f"financial_csv_audit_{ts}"
    artifacts_dir = args.artifacts_dir

    summary = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "data_dir": str(args.data_dir),
        "symbols_csv": str(args.symbols_csv),
        "master_symbol_count": len(master_symbols) if master_symbols is not None else None,
        "files": {},
    }

    any_issues = False
    for name, a in audits.items():
        malformed_hist: Dict[int, int] = {}
        for m in a.malformed_rows:
            malformed_hist[m.actual_cols] = malformed_hist.get(m.actual_cols, 0) + 1
        malformed_top = [
            {"actual_cols": actual_cols, "count": count}
            for actual_cols, count in sorted(malformed_hist.items(), key=lambda kv: (-kv[1], kv[0]))[:5]
        ]

        summary["files"][name] = {
            "path": a.file,
            "header_cols": a.header_cols,
            "data_rows": a.data_rows,
            "unique_symbols": a.unique_symbols,
            "missing_symbols_count": len(a.missing_symbols),
            "symbols_only_empty_count": len(a.symbols_only_empty),
            "duplicates_key_count": len(a.duplicates),
            "duplicate_rows_total": a.duplicate_rows_total,
            "malformed_rows_count": len(a.malformed_rows),
            "malformed_rows_actual_cols_top": malformed_top,
            "malformed_key_rows_count": a.malformed_key_rows,
            "empty_besides_keys_rows_count": len(a.empty_besides_keys_rows),
            "ticker_symbol_mismatches_count": a.ticker_symbol_mismatches,
        }

        if (
            len(a.missing_symbols)
            or len(a.symbols_only_empty)
            or len(a.duplicates)
            or len(a.malformed_rows)
            or a.malformed_key_rows
            or len(a.empty_besides_keys_rows)
        ):
            any_issues = True

    artifacts_dir.mkdir(parents=True, exist_ok=True)
    (artifacts_dir / f"{base}.json").write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")

    zero_rows_rows: List[Sequence[object]] = []
    duplicates_rows: List[Sequence[object]] = []
    malformed_rows_out: List[Sequence[object]] = []
    malformed_cols_dist_out: List[Sequence[object]] = []
    empty_rows_out: List[Sequence[object]] = []
    only_empty_symbols_rows: List[Sequence[object]] = []

    for name, a in audits.items():
        statement = name
        for sym in a.missing_symbols:
            zero_rows_rows.append([statement, sym, "missing_symbol"])
        for sym in a.symbols_only_empty:
            only_empty_symbols_rows.append([statement, sym, "only_empty_rows"])

        for d in a.duplicates:
            duplicates_rows.append(
                [
                    statement,
                    d.symbol,
                    d.year_report,
                    d.length_report,
                    d.count,
                    d.first_line,
                    ";".join(str(x) for x in d.lines_sample),
                ]
            )
        for m in a.malformed_rows:
            malformed_rows_out.append([statement, m.line, m.expected_cols, m.actual_cols])
        if a.malformed_rows:
            dist: Dict[int, int] = {}
            for m in a.malformed_rows:
                dist[m.actual_cols] = dist.get(m.actual_cols, 0) + 1
            for actual_cols, count in sorted(dist.items(), key=lambda kv: (-kv[1], kv[0])):
                malformed_cols_dist_out.append([statement, a.header_cols, actual_cols, count])
        for e in a.empty_besides_keys_rows:
            empty_rows_out.append([statement, e.line, e.symbol, e.year_report, e.length_report])

    _write_csv(
        artifacts_dir / f"{base}.zero_rows.csv",
        ["statement", "symbol", "reason"],
        zero_rows_rows,
    )
    _write_csv(
        artifacts_dir / f"{base}.only_empty_symbols.csv",
        ["statement", "symbol", "reason"],
        only_empty_symbols_rows,
    )
    _write_csv(
        artifacts_dir / f"{base}.duplicate_keys.csv",
        ["statement", "symbol", "yearReport", "lengthReport", "count", "first_line", "duplicate_lines_sample"],
        duplicates_rows,
    )
    _write_csv(
        artifacts_dir / f"{base}.malformed_rows.csv",
        ["statement", "line", "expected_cols", "actual_cols"],
        malformed_rows_out,
    )
    _write_csv(
        artifacts_dir / f"{base}.malformed_cols_distribution.csv",
        ["statement", "expected_cols", "actual_cols", "count"],
        malformed_cols_dist_out,
    )
    _write_csv(
        artifacts_dir / f"{base}.empty_rows.csv",
        ["statement", "line", "symbol", "yearReport", "lengthReport"],
        empty_rows_out,
    )

    print(json.dumps(summary, indent=2, sort_keys=True))

    if args.strict and any_issues:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
