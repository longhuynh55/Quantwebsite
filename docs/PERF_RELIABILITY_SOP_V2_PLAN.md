# Perf/Reliability SOP v2 Plan

## 1. Context & gaps
- **Source requirement**: the Team Research/Unit-Test SOP v2 explicitly demands a perf/reliability suite with >=10 cases plus timeout/retry/rate-limit/health-probe guards before the PR, nightly, and release gates are considered green (docs/TEAM_RESEARCH_UNITTEST_SOP_V2.md:66-143). This is the charter for AI Engineering #3.
- **Existing coverage**: scripts/model-stress-lite.mjs currently only runs four assistant cases before logging latency/coverage, so the perf/reliability suite is not yet compliant (scripts/model-stress-lite.mjs:7-33).
- **Runtime primitives**: provider retries, abort-based timeouts, and rate limiting already live in the runtime (src/lib/assistant/providers.ts:290-315, src/lib/rateLimit.ts:13-83) and the health probe already exposes a probe mode that skips rate limiting (src/app/api/health/data/route.ts:267-298). scripts/runtime-endpoint-check.mjs already demonstrates how to wrap endpoints in an AbortController with CHECK_TIMEOUT_MS (lines 58-110).

## 2. Proposed perf/reliability matrix (>=10 cases)
Each row below satisfies the SOP metadata requirements (	est_id, precondition, input, expected endpoint/tool route, policy expectation, and severity).

| test_id | precondition | input/action | expected endpoint/tool route | expected policy status | expected citation/abstain behavior | severity | focus |
| --- | --- | --- | --- | --- | --- | --- | --- |
| perf-health-probe-ready | Server running, manifest loaded | GET /api/health/data?probe=true&includeFundamentals=false | health/data (probe) | n/a | ok: true, mode: probe, no error | P1 | health-probe |
| perf-health-refresh-blocked | No HEALTH_DATA_ADMIN_TOKEN configured | GET /api/health/data?refresh=true | health/data (refresh) | n/a | HTTP 503, ok: false, error explains refresh is disabled | P1 | health-probe |
| perf-stocks-list | Manifest stocks populated | GET /api/stocks?limit=1 | stocks | n/a | HTTP 200, array length >= 1, symbol present | P2 | timeout |
| perf-fundamental-symbol | Stocks list available | GET /api/fundamentals?symbol=&statement=all&period=latest | fundamentals | n/a | status 200, generatedAt, availablePeriods | P2 | timeout |
| perf-factors-latency | Manifest ready | GET /api/factors?limit=5 | factors | n/a | HTTP 200, data non-empty, latency < 500 ms | P2 | timeout |
| perf-assistant-market-snapshot | HOSE data + provider chain healthy | POST /api/assistant with market summary prompt | marketSnapshot success | success | usedTools contains marketSnapshot | P2 | baseline perf |
| perf-assistant-fundamental | Same symbol (VNM) | POST /api/assistant asking for latest revenue and net profit | fundamentalSnapshot success | success | usedTools contains fundamentalSnapshot | P3 | grounding |
| perf-assistant-backtest | Backtest data ready | POST /api/assistant that requests net_return, sharpe, max_drawdown | backtestSummary success | success | usedTools contains backtestSummary | P2 | baseline perf |
| perf-assistant-missing-symbol | Symbol ZZZZZ unknown | POST /api/assistant requesting SMA crossover | backtestSummary error | success:false or policyStatus fallback | response contains INSUFFICIENT_DATA | P2 | reliability |
| perf-assistant-rate-limit | PERF_RELIABILITY_TEST_MODE sets limit to 3 | Issue 4 assistant POSTs with the same client identifier | 429 response from /api/assistant | rate_limit or empty | message Too many requests, Retry-After header present | P1 | rate-limit |
| perf-health-rate-limit | PERF_RELIABILITY_TEST_MODE sets limit to 3 | Issue 4 health GETs without probe mode | 429 response from /api/health/data | n/a | Retry-After header and error: Too many requests | P2 | rate-limit |
| perf-assistant-timeout | PERF_RELIABILITY_TEST_MODE sets ASSISTANT_TEST_TIMEOUT_MS=50 | Send longer assistant prompt (e.g., ask for 5 metrics with context) | /api/assistant returns timeout path | success:false | providerErrors contains kind: timeout and logged message includes timeout | P1 | timeout/retry |

The perf mode uses a dedicated PERF_RELIABILITY_TEST_MODE flag so tests can temporarily shrink RATE_LIMIT and timeout settings without affecting normal QA. The script will capture latency (avg/p95) to enforce the documented TTFMP <= 1.2 s nightly target.

## 3. Timeout/retry/rate-limit/health-probe checks
1. **Timeout and retry coverage** � generateWithProviderFallback already enforces deterministic timeouts and backoff across providers (src/lib/assistant/providers.ts:290-315). The new script will treat non-success responses as failures unless the response records retry/fallback metadata (meta.fallbackUsed, meta.providerUsed) and will surface the timeout path through providerErrors.kind === 'timeout'.
2. **Rate-limit instrumentation** � checkRateLimit lives in src/lib/rateLimit.ts: introducing TEST_RATE_LIMIT_MAX/TEST_RATE_LIMIT_WINDOW_MS overrides when PERF_RELIABILITY_TEST_MODE is true allows the script to saturate a bucket (health and assistant) and assert that HTTP 429 responses include the Retry-After header.
3. **Health probes** � the health route already offers a probe mode (probe=true, includeFundamentals=false) that skips rate limiting plus a guarded refresh path with admin token handling (src/app/api/health/data/route.ts:267-298). The script will call both modes so the Docker/QA probe and the full readiness workflow stay aligned with the SLO doc (docs/OBSERVABILITY_SLO.md).
4. **Client-side enforcement** � scripts/runtime-endpoint-check.mjs (lines 58-110) demonstrates how to wrap every call in an AbortController timeout guard; the proposed perf script will reuse that helper so the reported latencies align with the runtime's CHECK_TIMEOUT_MS and can gate the TTFMP threshold.

## 4. Implementation steps
1. **New script** � author scripts/perf-reliability-sop-v2.mjs to (a) reuse the timeout helper, (b) run the case matrix, (c) emit a structured JSON report/exit code like model-stress-lite, and (d) honor PERF_RELIABILITY_TEST_MODE so limits and timeouts stay test-friendly.
2. **Runtime tweaks** � allow PERF_RELIABILITY_TEST_MODE to override provider timeouts (src/lib/assistant/providers.ts:156-215) and rate-limit windows (src/lib/rateLimit.ts:13-83) during the run so the script can trigger timeout, retry, and 429 paths deterministically.
3. **New npm script** � add pnpm run eval:assistant:perf-reliability plus Docker aliases so QA/CI pipelines can call the suite; update README.md/docs/TEAM_RESEARCH_UNITTEST_SOP_V2.md to reference the command and the requirement to attach the JSON report.
4. **Gating** � treat this script as part of the PR/nightly gates listed in docs/TEAM_RESEARCH_UNITTEST_SOP_V2.md:66-101; fail when pass rate < 90%, any case returns ok: false, or latency exceeds 1.2 s.
5. **Documentation and automation** � add a Makefile/Docker target that runs the suite, and update docs/OBSERVABILITY_SLO.md/docs/INCIDENT_RESPONSE.md to mention the perf reliability report as a daily/incident artifact for health regressions.
