import { NextResponse } from "next/server";
import { cancelStrategyLabRun, StrategyLabError } from "@/lib/strategy-lab/orchestrator";

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof StrategyLabError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status }
    );
  }
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to cancel run.",
      },
    },
    { status: 500 }
  );
}

export async function POST(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await params;
    const run = await cancelStrategyLabRun(runId);
    return NextResponse.json({
      ok: true,
      data: run,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
