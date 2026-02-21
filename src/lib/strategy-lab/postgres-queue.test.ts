import {
  heartbeatStrategyLabJobLease,
  leaseNextStrategyLabJob,
  recoverExpiredStrategyLabLeases,
} from "@/lib/strategy-lab/postgres-queue";
import type { StrategyLabPostgresClient } from "@/lib/strategy-lab/repository.postgres";

function createMockClient(rows: unknown[] = [], rowCount: number | null = null): {
  client: StrategyLabPostgresClient;
  query: jest.Mock;
} {
  const query = jest.fn(async (_queryText: string, _values?: readonly unknown[]) => ({
    rows,
    rowCount,
  }));
  return {
    client: {
      query: async <T = unknown>(queryText: string, values?: readonly unknown[]) => {
        const result = await query(queryText, values);
        return {
          rows: result.rows as T[],
          rowCount: result.rowCount as number | null,
        };
      },
    },
    query,
  };
}

describe("strategy-lab postgres queue", () => {
  it("leases next queued job with expected SQL params", async () => {
    const { client, query } = createMockClient([
      {
        id: "job_1",
        run_id: "run_1",
        queue_name: "strategy_lab_default",
        attempt: 1,
        max_attempts: 3,
        priority: 5,
        lease_expires_at: "2026-02-21T10:00:00.000Z",
      },
    ]);

    const leased = await leaseNextStrategyLabJob(client, {
      workerId: "worker-a",
      leaseMs: 15_000,
    });

    expect(leased).toEqual({
      jobId: "job_1",
      runId: "run_1",
      queueName: "strategy_lab_default",
      attempt: 1,
      maxAttempts: 3,
      priority: 5,
      leaseExpiresAt: "2026-02-21T10:00:00.000Z",
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[1]).toEqual(["strategy_lab_default", "worker-a", 15_000]);
  });

  it("heartbeats owned lease only", async () => {
    const first = createMockClient([], 1);
    const second = createMockClient([], 0);

    const ok = await heartbeatStrategyLabJobLease(first.client, {
      jobId: "job_1",
      workerId: "worker-a",
      leaseMs: 5000,
    });
    expect(ok).toBe(true);
    expect(first.query.mock.calls[0]?.[1]).toEqual(["job_1", "worker-a", 5000]);

    const failed = await heartbeatStrategyLabJobLease(second.client, {
      jobId: "job_1",
      workerId: "worker-b",
      leaseMs: 5000,
    });
    expect(failed).toBe(false);
  });

  it("recovers expired leases with bounded limit", async () => {
    const { client, query } = createMockClient(
      [{ id: "job_1" }, { id: "job_2" }],
      2
    );

    const recovered = await recoverExpiredStrategyLabLeases(client, {
      queueName: "strategy_lab_default",
      limit: 5000,
    });

    expect(recovered).toBe(2);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[1]).toEqual(["strategy_lab_default", 1000]);
  });
});
