import { NextRequest, NextResponse } from "next/server";
import { parseLambdaProxyResponse } from "@/lib/api/parseLambdaResponse";
import { readSession } from "@/lib/auth/session";

const RISK_APPROVAL_API_URL = process.env.RISK_APPROVAL_API_URL || "";

export async function POST(request: NextRequest) {
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const rejectionReason = body.rejection_reason ?? body.rejectionReason ?? "";
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

    const actionedBy = session.email ?? session.username ?? session.sub ?? "";

    if (!session.accessToken) {
      return NextResponse.json(
        { error: "Unauthorized. Missing access token in session." },
        { status: 401 },
      );
    }
    const authHeader =
      request.headers.get("Authorization") ??
      `Bearer ${session.accessToken}`;

    const response = await fetch(RISK_APPROVAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        action: "reject",
        id,
        actioned_by: actionedBy,
        ...(rejectionReason && { rejection_reason: rejectionReason }),
      }),
    });

    const responseBody = await response.text();
    const { status, body: result } = parseLambdaProxyResponse(
      response,
      responseBody,
    );

    if (status < 200 || status >= 300) {
      return NextResponse.json(
        {
          error:
            (typeof result.error === "string" && result.error) ||
            `Reject API failed: ${status}`,
          upstreamBody: responseBody || undefined,
        },
        { status: status >= 400 && status < 600 ? status : 502 },
      );
    }

    return NextResponse.json(result.success !== undefined ? result : { ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to reject risk",
      },
      { status: 500 },
    );
  }
}
