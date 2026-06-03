import { NextRequest, NextResponse } from "next/server";
import { getRole, hasAppAccess } from "@/lib/auth/roles";
import { readSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasAppAccess(session.groups)) {
    return NextResponse.json(
      {
        error:
          "Forbidden. You must be assigned a role (user, admin, or superadmin).",
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    user: {
      sub: session.sub,
      email: session.email,
      name: session.name,
      username: session.username,
      role: getRole(session.groups),
      groups: session.groups,
    },
  });
}
