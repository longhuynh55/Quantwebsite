# Figure 3.3: Data Pipeline and Runtime Contract

```mermaid
flowchart LR
  RAW[Raw datasets (../data/*)] --> PREP[scripts/prepare_data_2018_2025.mjs]
  PREP --> RCSV[public/data/*.csv]
  PREP --> MAN[data_manifest_2018_2025.json]
  RCSV --> LOADER[src/lib/data.ts loaders]
  MAN --> LOADER

  PREP -->|optional| DUCKEXP[scripts/export_duckdb_from_runtime.mjs]
  DUCKEXP --> DUCK[public/data/quant_data.duckdb]
  DUCK --> LOADER

  LOADER --> API[API routes (/api/*)]
  API --> UI[UI pages]
  UI --> USER[User]
```

