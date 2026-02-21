# Figure 3.6: QuantVN Strategy Forge Workflow (Canvas + AI -> Run -> Diagnose)

```mermaid
flowchart TB
  subgraph Build[Build Strategy]
    CANVAS[Strategy Canvas (drag-and-drop)]
    AIGEN[AI Strategy Generator (/api/ai/generate-strategy)]
  end

  CANVAS --> SPEC[Strategy Spec (type + params + costs)]
  AIGEN --> SPEC

  SPEC --> RUN[Strategy Lab Run API (/api/strategy-lab/runs)]
  RUN --> EVENTS[Run Events (/events)]
  RUN --> RESULT[Run Result (/result)]

  RESULT --> DIAG[Diagnostics (coverage, gaps, exclusions)]
  RESULT --> KPI[KPI (return, Sharpe, drawdown, etc.)]

  KPI --> COMPARE[Compare Runs]
  DIAG --> COMPARE
  COMPARE --> USER[User decision / iteration]
```

