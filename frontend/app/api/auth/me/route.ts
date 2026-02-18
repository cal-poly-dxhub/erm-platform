import { NextRequest, NextResponse } from "next/server";
import { getRequiredRiskViewerGroup } from "@/lib/auth/cognito";
import { readSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requiredGroup = getRequiredRiskViewerGroup();
  if (requiredGroup && !session.groups.includes(requiredGroup)) {
    return NextResponse.json(
      {
        error: `Forbidden. Missing required group: ${requiredGroup}`,
        debug: {
          requiredGroup,
          sessionGroups: session.groups,
        },
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
      groups: session.groups,
    },
  });
}
