import { NextRequest, NextResponse } from "next/server";
import { getRequiredRiskViewerGroup } from "@/lib/auth/cognito";
import { readSession } from "@/lib/auth/session";

const API_URL =
  "https://0r2exr1sqj.execute-api.us-east-2.amazonaws.com/dev/erm-dashboard-results";

export async function POST(request: NextRequest) {
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requiredGroup = getRequiredRiskViewerGroup();
  if (requiredGroup && !session.groups.includes(requiredGroup)) {
    return NextResponse.json(
      { error: `Forbidden. Missing required group: ${requiredGroup}` },
      { status: 403 }
    );
  }

  const body = await request.text();
  if (!session.accessToken) {
    return NextResponse.json(
      { error: "Unauthorized. Missing access token in session." },
      { status: 401 }
    );
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body,
  });

  const responseBody = await response.text();
  if (!response.ok) {
    const errorType =
      response.headers.get("x-amzn-errortype") ||
      response.headers.get("www-authenticate") ||
      undefined;
    const detailParts = [
      `status=${response.status}`,
      response.statusText ? `statusText=${response.statusText}` : null,
      errorType ? `errorType=${errorType}` : null,
      responseBody ? `body=${responseBody}` : null,
    ].filter(Boolean);

    return NextResponse.json(
      {
        error: `Upstream dashboard API request failed (${detailParts.join(", ")})`,
        upstreamStatus: response.status,
        upstreamStatusText: response.statusText,
        upstreamErrorType: errorType,
        upstreamBody: responseBody || undefined,
      },
      { status: response.status }
    );
  }

  return new NextResponse(responseBody, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
