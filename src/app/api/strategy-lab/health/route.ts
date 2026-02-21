import { NextResponse } from "next/server";
import { loadOHLCVForSymbol } from "@/lib/data";
import { getStrategyLabHealthSnapshot } from "@/lib/strategy-lab/orchestrator";

export async function GET() {
  const health = await getStrategyLabHealthSnapshot();
  let sampleRows = 0;
  let dataError: string | null = null;

  try {
    const series = await loadOHLCVForSymbol("VNM");
    sampleRows = series.length;
    if (sampleRows === 0) {
      dataError = "No OHLCV rows available for VNM.";
    }
  } catch (error) {
    dataError = error instanceof Error ? error.message : "Unknown data read error.";
  }

  const ok = dataError === null;
  return NextResponse.json(
    {
      ok,
      data: {
        timestamp: new Date().toISOString(),
        runtime: health,
        dataProbe: {
          symbol: "VNM",
          rows: sampleRows,
          error: dataError,
        },
      },
    },
    { status: ok ? 200 : 503 }
  );
}
