# Figure 3.1: System Context (QuantVN Strategy Forge)

```mermaid
flowchart LR
  U[User / Analyst] --> UI[Next.js UI (App Router pages)]
  UI --> API[Next.js API routes (/api/*)]
  API --> Q[Quant Engine (src/lib/quant/*)]
  API --> D[Data Layer (src/lib/data.ts)]

  subgraph RuntimeData[Runtime Data]
    CSV[public/data/*.csv + data_manifest*.json]
    DUCK[public/data/quant_data.duckdb (optional)]
  end

  D --> CSV
  D --> DUCK

  Q --> API
  D --> API
  API --> UI
  UI --> U
```

