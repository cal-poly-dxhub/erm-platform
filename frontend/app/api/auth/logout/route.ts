import { NextRequest, NextResponse } from "next/server";
import {
  buildCognitoLogoutUrl,
  getAppOrigin,
} from "@/lib/auth/cognito";
import { clearAuthFlow, clearSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const cognitoLogoutUrl = buildCognitoLogoutUrl(request);
  const destination = cognitoLogoutUrl || new URL("/", getAppOrigin(request)).toString();
  const response = NextResponse.redirect(destination);

  clearSession(response);
  clearAuthFlow(response);
  return response;
}
