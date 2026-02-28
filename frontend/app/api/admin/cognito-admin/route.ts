import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";

const ADMIN_GROUP = "admin";
const COGNITO_ADMIN_API_URL = process.env.COGNITO_ADMIN_API_URL?.trim();

function parseLambdaResponse(res: Response, raw: string) {
  const data = raw ? JSON.parse(raw) : {};
  const body = typeof data?.body === "string" ? JSON.parse(data.body) : data?.body ?? data;
  const status = typeof data?.statusCode === "number" ? data.statusCode : res.status;
  return { body, status };
}

export async function GET(request: NextRequest) {
  const session = readSession(request);

  console.log("session:", session ? "found" : "null");
  console.log("COGNITO_ADMIN_API_URL:", COGNITO_ADMIN_API_URL);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.groups.includes(ADMIN_GROUP)) {
    return NextResponse.json(
      { error: "Forbidden. Admin access required." },
      { status: 403 },
    );
  }
  if (!COGNITO_ADMIN_API_URL) {
    return NextResponse.json(
      { error: "COGNITO_ADMIN_API_URL is not configured" },
      { status: 500 },
    );
  }

  const authHeader = session.accessToken
    ? `Bearer ${session.accessToken}`
    : session.idToken
      ? `Bearer ${session.idToken}`
      : null;
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(COGNITO_ADMIN_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({ action: "list_admins" }),
    });
    const raw = await res.text();
    const { body, status } = parseLambdaResponse(res, raw);
    return NextResponse.json(body, { status: status >= 200 && status < 600 ? status : 500 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list admins";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
  if (!COGNITO_ADMIN_API_URL) {
    return NextResponse.json(
      { error: "COGNITO_ADMIN_API_URL is not configured" },
      { status: 500 },
    );
  }

  let body: { action?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const action = body?.action;
  console.log("action:", action);
  if (action !== "invite_user" && action !== "remove_admin") {
    return NextResponse.json(
      { error: "Missing or invalid action (invite_user | remove_admin)" },
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

  try {
    const res = await fetch(COGNITO_ADMIN_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    });

    const raw = await res.text();
    const { body: responseBody, status } = parseLambdaResponse(res, raw);
    return NextResponse.json(responseBody, {
      status: status >= 200 && status < 600 ? status : 500,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
