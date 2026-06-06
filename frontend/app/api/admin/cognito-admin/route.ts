import { NextRequest, NextResponse } from "next/server";
import { logAvpRequestDebug } from "@/lib/auth/avpRequestDebug";
import { groupsFromAccessToken } from "@/lib/auth/groups";
import { readSession } from "@/lib/auth/session";

const ERM_COGNITO_ADMIN_AVP_ACTION = "post /erm-cognito-admin";

/** Full API Gateway URL for POST /erm-cognito-admin (AVP action: post /erm-cognito-admin). */
const ERM_COGNITO_ADMIN_URL =
  process.env.COGNITO_ADMIN_API_URL?.trim() ||
  process.env.ERM_COGNITO_ADMIN_URL?.trim() ||
  "";

function parseLambdaResponse(res: Response, raw: string) {
  const data = raw ? JSON.parse(raw) : {};
  const body = typeof data?.body === "string" ? JSON.parse(data.body) : data?.body ?? data;
  const status = typeof data?.statusCode === "number" ? data.statusCode : res.status;
  return { body, status };
}

async function proxyToErmCognitoAdmin(
  accessToken: string,
  payload: Record<string, unknown>,
) {
  const res = await fetch(ERM_COGNITO_ADMIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  const raw = await res.text();
  const parsed = parseLambdaResponse(res, raw);
  const status = !res.ok ? res.status : parsed.status;
  return { ...parsed, status, raw };
}

export async function POST(request: NextRequest) {
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ERM_COGNITO_ADMIN_URL) {
    return NextResponse.json(
      { error: "COGNITO_ADMIN_API_URL (POST /erm-cognito-admin) is not configured" },
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
  if (
    action !== "list_admins" &&
    action !== "invite_user" &&
    action !== "remove_admin"
  ) {
    return NextResponse.json(
      {
        error:
          "Missing or invalid action (list_admins | invite_user | remove_admin)",
      },
      { status: 400 },
    );
  }

  if (!session.accessToken) {
    return NextResponse.json(
      { error: "Unauthorized. Missing access token in session." },
      { status: 401 },
    );
  }

  try {
    logAvpRequestDebug(session.accessToken, ERM_COGNITO_ADMIN_AVP_ACTION);
    const { body: responseBody, status, raw } = await proxyToErmCognitoAdmin(
      session.accessToken,
      body,
    );
    if (status === 403) {
      const groups = groupsFromAccessToken(session.accessToken);
      console.error("[erm-cognito-admin] API Gateway 403", {
        action: body.action,
        groups,
        upstream: raw.slice(0, 300),
      });
    }
    return NextResponse.json(responseBody, {
      status: status >= 200 && status < 600 ? status : 500,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
