import { NextResponse } from "next/server";
import { listStrategyLabStrategies } from "@/lib/strategy-lab/orchestrator";

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      exchange: "HOSE",
      strategies: listStrategyLabStrategies(),
    },
  });
}
