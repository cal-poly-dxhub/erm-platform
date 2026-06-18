import { NextRequest, NextResponse } from "next/server";
import { parseLambdaResponseBody } from "@/lib/api/parseLambdaResponse";
import { extractUserProfile } from "@/lib/api/userProfile";
import { readSession } from "@/lib/auth/session";

const USER_PROFILE_LAMBDA_API_URL =
  process.env.USER_PROFILE_LAMBDA_API_URL?.trim() ||
  process.env.USER_PROFILE_API_URL?.trim() ||
  "";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cognito `username` is often the same as `sub` — not a display name. */
function isLikelySubOrUsername(value: string, sub: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (v === sub) return true;
  return UUID_RE.test(v);
}

async function invokeProfileLambda(
  session: NonNullable<ReturnType<typeof readSession>>,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; status: number; body: string }> {
  const tokens = [session.accessToken, session.idToken].filter(
    (t): t is string => Boolean(t),
  );
  if (tokens.length === 0) {
    return { ok: false, status: 401, body: "Missing access token" };
  }

  let lastStatus = 500;
  let lastBody = "";

  for (const token of tokens) {
    const response = await fetch(USER_PROFILE_LAMBDA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    lastStatus = response.status;
    lastBody = await response.text();

    if (response.ok) {
      return { ok: true, data: parseLambdaResponseBody(lastBody) };
    }

    if (response.status !== 401 && response.status !== 403) {
      break;
    }
  }

  return { ok: false, status: lastStatus, body: lastBody };
}

async function callProfileLambda(
  session: NonNullable<ReturnType<typeof readSession>>,
  body: Record<string, unknown>,
) {
  const result = await invokeProfileLambda(session, body);

  if (!result.ok) {
    return NextResponse.json(
      {
        error: `Profile API failed: ${result.status}`,
        upstreamBody: result.body || undefined,
      },
      { status: result.status },
    );
  }

  if (body.action === "get") {
    const profile = extractUserProfile(result.data, {
      sub: session.sub,
      email: session.email,
      name: session.name,
    });
    if (profile) {
      return NextResponse.json({ exists: true, user: profile });
    }
    return NextResponse.json({ exists: false });
  }

  return NextResponse.json(result.data ?? { ok: true });
}

export async function GET(request: NextRequest) {
  console.log("[profile] browser GET /api/users/profile → Lambda action=get");
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!USER_PROFILE_LAMBDA_API_URL) {
    return NextResponse.json(
      { error: "USER_PROFILE_LAMBDA_API_URL is not configured" },
      { status: 500 },
    );
  }

  try {
    return await callProfileLambda(session, { action: "get" });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load profile",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  console.log("[profile] browser POST /api/users/profile → Lambda action=upsert");
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!USER_PROFILE_LAMBDA_API_URL) {
    return NextResponse.json(
      { error: "USER_PROFILE_LAMBDA_API_URL is not configured" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();

    let email = (session.email ?? "").trim();
    let name = (session.name ?? "").trim();

    const existingResult = await invokeProfileLambda(session, { action: "get" });
    const existing =
      existingResult.ok
        ? extractUserProfile(existingResult.data, {
            sub: session.sub,
            email: session.email,
            name: session.name,
          })
        : null;

    if (existing) {
      if (!email) email = existing.email;
      if (!name || isLikelySubOrUsername(name, session.sub)) {
        name = existing.name;
      }
    } else if (!name || isLikelySubOrUsername(name, session.sub)) {
      name = email || "User";
    }

    if (!email) {
      return NextResponse.json(
        {
          error:
            "Your account is missing an email in Cognito. Contact an admin.",
        },
        { status: 400 },
      );
    }

    return await callProfileLambda(session, {
      action: "upsert",
      email,
      name,
      college: body.college ?? null,
      unit: body.unit ?? null,
      department:
        typeof body.department === "string" && body.department.trim()
          ? body.department.trim()
          : null,
      expertise: Array.isArray(body.expertise) ? body.expertise : [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save profile",
      },
      { status: 500 },
    );
  }
}
