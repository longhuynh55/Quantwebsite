import { NextResponse } from "next/server";
import { listEvaluatedMockAlerts, listMockAlerts } from "@/lib/alerts/store";
import type { AlertsFeedResponse } from "@/lib/alerts/types";

export async function GET(): Promise<NextResponse<AlertsFeedResponse>> {
  const mockAlerts = listMockAlerts();
  const evaluatedAlerts = listEvaluatedMockAlerts();

  return NextResponse.json({
    alerts: [...mockAlerts, ...evaluatedAlerts],
    polledAt: new Date().toISOString(),
  });
}
