import type { NextRequest, NextResponse } from "next/server";
import { issueSignedToken, verifySignedToken } from "@/lib/auth/signedToken";

export type SessionUser = {
  sub: string;
  email?: string;
  name?: string;
  username?: string;
  groups: string[];
  accessToken?: string;
};

export type AuthFlowState = {
  state: string;
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
  returnTo: string;
};

const SESSION_COOKIE_NAME = "erm_session";
const FLOW_COOKIE_NAME = "erm_auth_flow";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const FLOW_TTL_SECONDS = 60 * 10;

const secureCookie = process.env.NODE_ENV === "production";

export const sanitizeReturnTo = (value: string | null | undefined) => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
};

export function readSession(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) {
    return null;
  }
  return verifySignedToken<SessionUser>(raw);
}

export function setSession(response: NextResponse, user: SessionUser) {
  const token = issueSignedToken(user, SESSION_TTL_SECONDS);
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSession(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function readAuthFlow(request: NextRequest) {
  const raw = request.cookies.get(FLOW_COOKIE_NAME)?.value;
  if (!raw) {
    return null;
  }
  return verifySignedToken<AuthFlowState>(raw);
}

export function setAuthFlow(response: NextResponse, flow: AuthFlowState) {
  const token = issueSignedToken(flow, FLOW_TTL_SECONDS);
  response.cookies.set({
    name: FLOW_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: FLOW_TTL_SECONDS,
  });
}

export function clearAuthFlow(response: NextResponse) {
  response.cookies.set({
    name: FLOW_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
