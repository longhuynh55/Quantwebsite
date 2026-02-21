# Composer Agent Tracking Automation

## Purpose
- Auto-generate progress tracking and next-step plan from tracker JSON.
- Keep human docs (`PROGRESS.md`, weekly status) synchronized with AGT milestone statuses.

## Commands
1. `pnpm run agent:track`
2. `pnpm run agent:track:weekly`
3. `pnpm run agent:track:set-status -- --id AGT-03 --status in_progress --note "Composer UI skeleton landed"`

## Docker Integration
- `pnpm run docker:smoke` and `pnpm run docker:qa` now auto-run `agent:track` after the Docker checks pass.
- `pnpm run docker:smoke:prod` and `pnpm run docker:qa:prod` also auto-run `agent:track`.
- `pnpm run docker:eval:assistant:routing:stable` runs with `ASSISTANT_EVAL_MAX_LATENCY_P95_MS=30000` for container stability.

## Outputs
- `artifacts/composer-agent-progress-report.json`
- `artifacts/composer-agent-progress-board.md`
- `docs/COMPOSER_AGENT_WEEKLY_STATUS_AUTO.md`
- Auto-sync block in `docs/PROGRESS.md` between:
  - `<!-- AGENT_PROGRESS_AUTO_START -->`
  - `<!-- AGENT_PROGRESS_AUTO_END -->`

## CLI Options
- `--tracker <path>` override tracker file (default: `docs/COMPOSER_AGENT_FUNCTION_CALLING_TRACKER_V1.json`)
- `--progress <path>` override progress doc (default: `docs/PROGRESS.md`)
- `--report-path <path>` override JSON report output
- `--board-path <path>` override Markdown board output
- `--weekly-path <path>` override weekly status output
- `--dry-run true` to preview without writing files

## Milestone Status Update
- Supported statuses: `todo`, `in_progress`, `done`, `blocked`
- Command:
  - `pnpm run agent:track:set-status -- --id AGT-04 --status in_progress --note "Started reliability hardening"`
- This updates tracker status, appends `statusHistory`, refreshes `updatedAt`, then runs sync automatically.
