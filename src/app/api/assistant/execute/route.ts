import { NextResponse } from "next/server";
import type { FinanceAnalysisType } from "@/lib/finance";

const VALID_SYMBOL_REGEX = /^[A-Z0-9]{1,10}$/;
const TYPE_SET = new Set<FinanceAnalysisType>([
  "fundamental",
  "health",
  "valuation",
  "peer",
  "sensitivity",
]);

interface ExecuteBody {
  symbol?: string;
  task?: FinanceAnalysisType;
  approvalToken?: string;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  let body: ExecuteBody;
  try {
    body = (await request.json()) as ExecuteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const symbol = String(body.symbol ?? "").trim().toUpperCase();
  const task = String(body.task ?? "").trim().toLowerCase() as FinanceAnalysisType;
  const approvalToken = String(body.approvalToken ?? "").trim();

  if (!VALID_SYMBOL_REGEX.test(symbol)) {
    return NextResponse.json({ error: "Invalid or missing symbol." }, { status: 400 });
  }
  if (!TYPE_SET.has(task)) {
    return NextResponse.json({ error: "Invalid task. Use fundamental|health|valuation|peer|sensitivity." }, { status: 400 });
  }
  if (approvalToken.length < 4) {
    return NextResponse.json(
      { error: "approvalToken is required for human-in-loop execution." },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const endpoint = `${url.origin}/api/finance-analysis?symbol=${encodeURIComponent(symbol)}&type=${encodeURIComponent(task)}`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: { "content-type": "application/json" },
    cache: "no-store",
  });

  const payload = await response.json();
  if (!response.ok) {
    return NextResponse.json(payload, { status: response.status });
  }

  return NextResponse.json({
    success: true,
    execution: {
      symbol,
      task,
      approved: true,
      executedAt: new Date().toISOString(),
    },
    result: payload,
  });
}
