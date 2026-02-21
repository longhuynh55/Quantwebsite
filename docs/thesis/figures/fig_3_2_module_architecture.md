# Figure 3.2: Module Architecture (Code Map)

```mermaid
flowchart TB
  subgraph App[UI + Routes]
    P[src/app/* pages]
    A[src/app/api/*/route.ts]
    M[src/middleware.ts]
  end

  subgraph Components[src/components/*]
    L[layout/*]
    C[charts/*]
    UIK[ui/*]
    ASUI[assistant/*]
  end

  subgraph Lib[src/lib/*]
    DATA[data.ts + dataBackend.ts + dataManifest.ts]
    QUANT[quant/* (backtest, risk, portfolio, factors, indicators)]
    ASSIST[assistant/* (planner, tools, policy, providers)]
    RL[rateLimit.ts]
  end

  subgraph Scripts[scripts/*.mjs]
    PREP[data:prepare (prepare_data_2018_2025.mjs)]
    SMOKE[smoke/qa]
    EVAL[assistant eval suites]
  end

  subgraph Runtime[public/data/*]
    DS[CSV + manifest + optional DuckDB]
  end

  P --> Components
  P --> A
  A --> Lib
  A --> DS
  PREP --> DS
  SMOKE --> A
  EVAL --> A
  M --> A
```

