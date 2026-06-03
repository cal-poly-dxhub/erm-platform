import { NextRequest, NextResponse } from "next/server";
import { hasMinRole } from "@/lib/auth/roles";
import { readSession } from "@/lib/auth/session";

const STORE_RISK_LAMBDA_API_URL = process.env.STORE_RISK_LAMBDA_API_URL || "";

export async function POST(request: NextRequest) {
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasMinRole(session.groups, "admin")) {
    return NextResponse.json(
      { error: "Forbidden. Admin access required." },
      { status: 403 },
    );
  }
  if (!STORE_RISK_LAMBDA_API_URL) {
    return NextResponse.json(
      { error: "Store risk API URL not configured" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const rawId = body.id ?? body.risk_id;
    if (rawId === undefined || rawId === null) {
      return NextResponse.json({ error: "Missing id in body" }, { status: 400 });
    }
    const id = typeof rawId === "number" ? rawId : parseInt(String(rawId), 10);
    if (Number.isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid id: must be a number" },
        { status: 400 },
      );
    }

    const authHeader =
      request.headers.get("Authorization") ??
      (session.accessToken
        ? `Bearer ${session.accessToken}`
        : session.idToken
          ? `Bearer ${session.idToken}`
          : null);
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await fetch(STORE_RISK_LAMBDA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        action: "delete",
        id,
      }),
    });

    const responseBody = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Delete API failed: ${response.status}`,
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
    return NextResponse.json(result ?? { ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete risk" },
      { status: 500 },
    );
  }
}
