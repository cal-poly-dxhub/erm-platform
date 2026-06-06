import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";

const API_URL = process.env.ERM_DASHBOARD_RESULTS_URL ?? "";

export async function POST(request: NextRequest) {
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body = await request.text();
  if (!session.accessToken) {
    return NextResponse.json(
      { error: "Unauthorized. Missing access token in session." },
      { status: 401 }
    );
  }

  // When client asks to limit by session email, inject session identity server-side
  try {
    const parsed = body ? JSON.parse(body) : {};
    if (parsed.limit_by_session_email) {
      const sessionEmail =
        session.email ?? session.name ?? session.username ?? "";
      const filters = typeof parsed.filters === "object" && parsed.filters != null ? { ...parsed.filters } : {};
      if (sessionEmail) {
        filters.owner = sessionEmail;
      }
      const { limit_by_session_email: _, ...rest } = parsed;
      body = JSON.stringify({ ...rest, filters });
    }
  } catch {
    // leave body unchanged if parse fails
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
