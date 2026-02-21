import { createStrategyLabFileStoreAdapter } from "@/lib/strategy-lab/file-store-adapter";
import { getStrategyLabStoreAdapterName, setStrategyLabStoreAdapter } from "@/lib/strategy-lab/store";

declare global {
  // eslint-disable-next-line no-var
  var __strategyLabPersistenceBootstrapped__: boolean | undefined;
}

export function bootstrapStrategyLabPersistenceFromEnv(): string | null {
  if (globalThis.__strategyLabPersistenceBootstrapped__) {
    return getStrategyLabStoreAdapterName();
  }

  globalThis.__strategyLabPersistenceBootstrapped__ = true;
  const snapshotPath = process.env.STRATEGY_LAB_STORE_FILE?.trim();
  if (!snapshotPath) {
    return null;
  }

  const adapter = createStrategyLabFileStoreAdapter(snapshotPath);
  setStrategyLabStoreAdapter(adapter);
  return adapter.name;
}
