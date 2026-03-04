import csv, os
data_dir = r'D:\KLTN\Quant wwebsite\quant-website\public\data'
files = {
    'ohlcv_2018_2025.csv': 'OHLCV',
    'stock_metadata_2018_2025.csv': 'Metadata',
    'Market_Indices_Daily_2020_2025.csv': 'Index',
    'HOSE_VERIFIED_BalanceSheet_Quarterly_2018_2025.csv': 'BalanceSheet',
    'HOSE_VERIFIED_IncomeStatement_Quarterly_2018_2025.csv': 'IncomeStatement',
    'HOSE_VERIFIED_CashFlow_Quarterly_2018_2025.csv': 'CashFlow',
    'industry_by_symbol_2018_2025.csv': 'Industry',
}
for fname, label in files.items():
    fpath = os.path.join(data_dir, fname)
    if os.path.exists(fpath):
        with open(fpath, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader)
            rows = sum(1 for _ in reader)
        size_mb = os.path.getsize(fpath) / 1024 / 1024
        cols_preview = ', '.join(header[:6])
        print(f'{label}: {rows:,} rows | {size_mb:.1f} MB | {len(header)} cols ({cols_preview})')
