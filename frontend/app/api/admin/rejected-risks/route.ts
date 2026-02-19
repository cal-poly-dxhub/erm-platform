import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";

const DASHBOARD_API_URL =
  process.env.ERM_DASHBOARD_RESULTS_URL ||
  "https://0r2exr1sqj.execute-api.us-east-2.amazonaws.com/dev/erm-dashboard-results";

const ADMIN_GROUP = "admin";

export async function GET(request: NextRequest) {
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
  if (!session.accessToken) {
    return NextResponse.json(
      { error: "Unauthorized. Missing access token in session." },
      { status: 401 },
    );
  }

  try {
    const response = await fetch(DASHBOARD_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        filters: { approval_status: "rejected" },
        limit: 500,
      }),
    });

    const responseBody = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Upstream API failed: ${response.status}`,
          upstreamBody: responseBody || undefined,
        },
        { status: response.status },
      );
    }

    const data = responseBody ? JSON.parse(responseBody) : {};
    const raw = data?.body
      ? typeof data.body === "string"
        ? JSON.parse(data.body)
        : data.body
      : data;
    const list = Array.isArray(raw?.results)
      ? raw.results
      : Array.isArray(raw)
        ? raw
        : [];
    return NextResponse.json(list);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch rejected risks",
      },
      { status: 500 },
    );
  }
}
