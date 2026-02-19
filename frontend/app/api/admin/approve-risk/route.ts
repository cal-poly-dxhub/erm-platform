import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";

const RISK_APPROVAL_API_URL = process.env.RISK_APPROVAL_API_URL || "";
const ADMIN_GROUP = "admin";

export async function POST(request: NextRequest) {
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.groups.includes(ADMIN_GROUP)) {
    return NextResponse.json(
      { error: "Forbidden. Admin access required." },
      { status: 403 },
    );
  }
  if (!RISK_APPROVAL_API_URL) {
    return NextResponse.json(
      { error: "Risk approval API URL not configured" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const rawId = body.id ?? body.risk_id;
    if (rawId === undefined || rawId === null) {
      return NextResponse.json(
        { error: "Missing id in body" },
        { status: 400 },
      );
    }
    const id = typeof rawId === "number" ? rawId : parseInt(String(rawId), 10);
    if (Number.isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid id: must be a number" },
        { status: 400 },
      );
    }

    const actionedBy = session.email ?? session.username ?? session.sub ??  "";

    console.log("RISK_APPROVAL_API_URL:", RISK_APPROVAL_API_URL);
    console.log("body being sent:", JSON.stringify({ action: "approve", id, actioned_by: actionedBy }, null, 2));

    const authHeader =
      request.headers.get("Authorization") ??
      (session.accessToken ? `Bearer ${session.accessToken}` : null);
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await fetch(RISK_APPROVAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        action: "approve",
        id,
        actioned_by: actionedBy,
      }),
    });

    const responseBody = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Approve API failed: ${response.status}`,
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
      {
        error:
          error instanceof Error ? error.message : "Failed to approve risk",
      },
      { status: 500 },
    );
  }
}
