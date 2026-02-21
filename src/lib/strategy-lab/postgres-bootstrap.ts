import type { StrategyLabPostgresClient } from "@/lib/strategy-lab/repository.postgres";

let bootstrapped = false;
let bootstrapping: Promise<void> | null = null;

type PgClientLike = {
  query: (queryText: string, values?: readonly unknown[]) => Promise<{ rows: unknown[]; rowCount?: number | null }>;
};

function toPostgresClient(client: PgClientLike): StrategyLabPostgresClient {
  return {
    query: async <T = unknown>(queryText: string, values?: readonly unknown[]) => {
      const result = await client.query(queryText, values);
      return {
        rows: result.rows as T[],
        rowCount: result.rowCount ?? null,
      };
    },
  };
}

export async function bootstrapStrategyLabPostgresClientFromEnv(): Promise<void> {
  if (bootstrapped) return;
  if (bootstrapping) {
    await bootstrapping;
    return;
  }

  bootstrapping = (async () => {
    const backend = String(process.env.STRATEGY_LAB_REPOSITORY_BACKEND ?? "memory").trim().toLowerCase();
    if (backend !== "postgres") {
      bootstrapped = true;
      return;
    }

    if (globalThis.__strategyLabPostgresClient__) {
      bootstrapped = true;
      return;
    }

    const connectionString = process.env.STRATEGY_LAB_DATABASE_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn("[strategy-lab/postgres-bootstrap] Missing STRATEGY_LAB_DATABASE_URL (or DATABASE_URL); fallback to memory.");
      bootstrapped = true;
      return;
    }

    try {
      const importDynamic = new Function("moduleName", "return import(moduleName);") as (moduleName: string) => Promise<unknown>;
      const pgModule = (await importDynamic("pg")) as {
        Client?: new (options: { connectionString: string }) => PgClientLike & { connect: () => Promise<void> };
      };
      if (!pgModule?.Client) {
        throw new Error('Module \"pg\" does not expose Client.');
      }
      const client = new pgModule.Client({ connectionString });
      await client.connect();
      globalThis.__strategyLabPostgresClient__ = toPostgresClient(client);
    } catch (error) {
      console.warn("[strategy-lab/postgres-bootstrap] Failed to initialize pg client; fallback to memory.", error);
    } finally {
      bootstrapped = true;
    }
  })();

  await bootstrapping;
}

export function __resetStrategyLabPostgresBootstrapForTests(): void {
  bootstrapped = false;
  bootstrapping = null;
}
