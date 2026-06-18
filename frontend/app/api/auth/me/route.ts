import { NextRequest, NextResponse } from "next/server";
import { groupsFromAccessToken } from "@/lib/auth/groups";
import { getRole } from "@/lib/auth/roles";
import { readSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groups = groupsFromAccessToken(session.accessToken);

  return NextResponse.json(
    {
      user: {
        sub: session.sub,
        email: session.email,
        name: session.name,
        username: session.username,
        role: getRole(groups),
        groups,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
