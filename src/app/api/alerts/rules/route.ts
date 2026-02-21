import { NextResponse } from "next/server";
import { createAlertRule, listAlertRules } from "@/lib/alerts/store";
import type {
  AlertRulesListResponse,
  CreateAlertRuleResponse,
} from "@/lib/alerts/types";

interface CreateRulePayload {
  name?: unknown;
  condition?: unknown;
  symbol?: unknown;
  enabled?: unknown;
}

export async function GET(): Promise<NextResponse<AlertRulesListResponse>> {
  const rules = listAlertRules();
  return NextResponse.json({
    rules,
    total: rules.length,
  });
}

export async function POST(request: Request): Promise<NextResponse<CreateAlertRuleResponse | { error: string }>> {
  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 }
    );
  }

  let body: CreateRulePayload;
  try {
    body = (await request.json()) as CreateRulePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = normalizeRequiredText(body.name, 80);
  const condition = normalizeRequiredText(body.condition, 160);
  const symbol = normalizeOptionalSymbol(body.symbol);
  const enabled = typeof body.enabled === "boolean" ? body.enabled : true;

  if (!name || !condition) {
    return NextResponse.json(
      { error: "Both name and condition are required." },
      { status: 400 }
    );
  }

  const rule = createAlertRule({
    name,
    condition,
    symbol,
    enabled,
  });

  return NextResponse.json({ rule }, { status: 201 });
}

function normalizeRequiredText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalSymbol(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase().slice(0, 12);
  return normalized.length > 0 ? normalized : undefined;
}
