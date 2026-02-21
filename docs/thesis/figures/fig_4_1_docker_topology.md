# Figure 4.1: Docker Topology (Dev/Smoke/QA)

```mermaid
flowchart LR
  subgraph Compose[docker-compose.yml]
    APP[app (Next.js dev)]
    SMOKE[smoke (scripts/smoke.mjs)]
    QA[qa (scripts/qa.mjs)]
    APPP[app-prod (prod profile)]
    SMOKEP[smoke-prod]
    QAP[qa-prod]
  end

  SMOKE -->|depends_on healthy| APP
  QA -->|depends_on healthy| APP
  SMOKEP -->|depends_on healthy| APPP
  QAP -->|depends_on healthy| APPP
```

