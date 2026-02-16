interface DuckDbDatabase {
  all(
    sql: string,
    params: unknown[] | ((error: Error | null, rows: Record<string, unknown>[]) => void),
    callback?: (error: Error | null, rows: Record<string, unknown>[]) => void
  ): void;
  close(callback: (error: Error | null) => void): void;
}

interface DuckDbModule {
  Database: new (filePath: string, ...args: unknown[]) => DuckDbDatabase;
  OPEN_READONLY?: number;
}

let duckDbModulePromise: Promise<DuckDbModule | null> | null = null;
const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;

async function loadDuckDbModule(): Promise<DuckDbModule | null> {
  if (!duckDbModulePromise) {
    duckDbModulePromise = (async () => {
      try {
        const imported = await dynamicImport("duckdb");
        const candidate = ((imported as { default?: unknown }).default ?? imported) as Partial<DuckDbModule>;
        if (!candidate || typeof candidate.Database !== "function") return null;
        return candidate as DuckDbModule;
      } catch {
        return null;
      }
    })();
  }
  return duckDbModulePromise;
}

export async function hasDuckDbNodeBinding(): Promise<boolean> {
  const duckdbModule = await loadDuckDbModule();
  return duckdbModule !== null;
}

export async function queryDuckDbRows(
  dbPath: string,
  sql: string,
  params: unknown[] = []
): Promise<Record<string, unknown>[]> {
  const duckdbModule = await loadDuckDbModule();
  if (!duckdbModule) {
    throw new Error("DuckDB node binding is unavailable. Install optional dependency 'duckdb'.");
  }

  return await new Promise<Record<string, unknown>[]>((resolve, reject) => {
    const onOpen = (openError: Error | null) => {
      if (openError) {
        reject(openError);
        return;
      }

      const handleQueryResult = (queryError: Error | null, rows: Record<string, unknown>[]) => {
        db.close((closeError) => {
          if (queryError) {
            reject(queryError);
            return;
          }
          if (closeError) {
            reject(closeError);
            return;
          }
          resolve(Array.isArray(rows) ? rows : []);
        });
      };

      if (params.length > 0) {
        db.all(sql, params, handleQueryResult);
        return;
      }
      db.all(sql, handleQueryResult);
    };

    const openReadOnlyFlag =
      typeof duckdbModule.OPEN_READONLY === "number" ? duckdbModule.OPEN_READONLY : undefined;
    const db =
      openReadOnlyFlag === undefined
        ? new duckdbModule.Database(dbPath, onOpen)
        : new duckdbModule.Database(dbPath, openReadOnlyFlag, onOpen);
  });
}

export function clearDuckDbModuleCache(): void {
  duckDbModulePromise = null;
}
