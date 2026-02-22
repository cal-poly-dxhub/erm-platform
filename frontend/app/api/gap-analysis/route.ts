import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";

const GAP_ANALYSIS_API_URL = process.env.GAP_ANALYSIS_API_URL || "";

export async function POST(request: NextRequest) {
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!GAP_ANALYSIS_API_URL) {
    return NextResponse.json(
      { error: "GAP_ANALYSIS_API_URL is not configured" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const unit =
      typeof body?.unit === "string" ? body.unit.trim() : "";
    const department =
      typeof body?.department === "string" ? body.department.trim() : "";
    const orgType = body?.orgType === "unit" ? "unit" : "college";

    if (!unit) {
      return NextResponse.json(
        { error: "Please select a college or unit." },
        { status: 400 },
      );
    }

    const authHeader =
      request.headers.get("Authorization") ??
      (session.accessToken ? `Bearer ${session.accessToken}` : null);

    const payload: Record<string, string> = { unit, orgType };
    if (department) payload.department = department;

    const response = await fetch(GAP_ANALYSIS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Gap analysis API failed: ${response.status}`,
          upstreamBody: responseBody || undefined,
        },
        { status: response.status },
      );
    }

    const data = responseBody ? JSON.parse(responseBody) : {};
    const result = data?.body
      ? typeof data.body === "string"
        ? JSON.parse(data.body)
        : data.body
      : data;
    return NextResponse.json(result ?? {});
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to run gap analysis",
      },
      { status: 500 },
    );
  }
}
