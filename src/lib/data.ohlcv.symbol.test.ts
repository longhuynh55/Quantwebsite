import fsPromises from "fs/promises";
import os from "os";
import path from "path";
import { clearCache, getDatasetLoadStatus, loadOHLCVForSymbol } from "./data";

const ENV_KEYS = ["DATA_BACKEND", "DATA_DIR", "DATA_BACKEND_STRICT"] as const;

describe("loadOHLCVForSymbol (csv symbol stream)", () => {
  let tempDir: string | null = null;
  const originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  beforeAll(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
    }
  });

  beforeEach(async () => {
    tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "quant-ohlcv-"));
    process.env.DATA_BACKEND = "csv";
    process.env.DATA_BACKEND_STRICT = "false";
    process.env.DATA_DIR = tempDir;
    clearCache();
  });

  afterEach(async () => {
    clearCache();
    if (tempDir) {
      await fsPromises.rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("loads and sorts OHLCV rows for one symbol from CSV", async () => {
    const filePath = path.join(tempDir as string, "ohlcv_2018_2025.csv");
    await fsPromises.writeFile(
      filePath,
      [
        "symbol,date,open,high,low,close,volume",
        "AAA,2018-01-03,18.32,18.4,18.04,18.29,1443310",
        "BBB,2018-01-02,12.1,12.3,11.9,12.0,1000",
        "AAA,2018-01-02,18.38,18.4,17.93,18.24,1563900",
      ].join("\n"),
      "utf-8"
    );

    const rows = await loadOHLCVForSymbol("aaa");
    expect(rows).toHaveLength(2);
    expect(rows[0].date.getTime()).toBeLessThan(rows[1].date.getTime());
    expect(rows.every((row) => row.symbol === "AAA")).toBe(true);
  });

  it("reuses in-memory symbol cache for repeated queries", async () => {
    const filePath = path.join(tempDir as string, "ohlcv_2018_2025.csv");
    await fsPromises.writeFile(
      filePath,
      [
        "symbol,date,open,high,low,close,volume",
        "VNM,2024-01-02,10,11,9.5,10.5,1000",
      ].join("\n"),
      "utf-8"
    );

    const first = await loadOHLCVForSymbol("VNM");
    expect(first).toHaveLength(1);

    await fsPromises.rm(filePath, { force: true });
    const second = await loadOHLCVForSymbol("VNM");
    expect(second).toHaveLength(1);
    expect(second[0].symbol).toBe("VNM");
  });

  it("returns unknown status (not hard error) for missing symbol", async () => {
    const filePath = path.join(tempDir as string, "ohlcv_2018_2025.csv");
    await fsPromises.writeFile(
      filePath,
      [
        "symbol,date,open,high,low,close,volume",
        "AAA,2018-01-02,18.38,18.4,17.93,18.24,1563900",
      ].join("\n"),
      "utf-8"
    );

    const rows = await loadOHLCVForSymbol("ZZZ");
    expect(rows).toHaveLength(0);
    const status = getDatasetLoadStatus("ohlcv");
    expect(status.status).toBe("unknown");
    expect(status.backend).toBe("csv");
  });
});
