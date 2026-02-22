import { NextRequest, NextResponse } from "next/server";
import * as oidc from "openid-client";
import { getAppOrigin, getOidcConfiguration } from "@/lib/auth/cognito";
import {
  clearAuthFlow,
  setSession,
  readAuthFlow,
  sanitizeReturnTo,
  SessionUser,
} from "@/lib/auth/session";

const parseGroups = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
};

const decodeJwtPayload = (token: string | undefined) => {
  if (!token) return null;
  const [, payload] = token.split(".");
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (normalized.length % 4)) % 4;
    const decoded = Buffer.from(
      normalized + "=".repeat(padding),
      "base64"
    ).toString("utf-8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export async function GET(request: NextRequest) {
  const authFlow = readAuthFlow(request);
  if (!authFlow) {
    return NextResponse.redirect(
      new URL("/login?returnTo=/dashboard", getAppOrigin(request))
    );
  }

  try {
    const config = await getOidcConfiguration();
    const tokens = await oidc.authorizationCodeGrant(
      config,
      new URL(request.url),
      {
        expectedState: authFlow.state,
        expectedNonce: authFlow.nonce,
        pkceCodeVerifier: authFlow.codeVerifier,
      },
      {
        redirect_uri: authFlow.redirectUri,
      }
    );

    const claims = tokens.claims();
    if (!claims?.sub) {
      throw new Error("ID token claims missing subject");
    }

    let userInfo: Record<string, unknown> = {};
    if (tokens.access_token) {
      try {
        userInfo = (await oidc.fetchUserInfo(
          config,
          tokens.access_token,
          claims.sub
        )) as Record<string, unknown>;
      } catch (error) {
        console.warn("UserInfo request failed:", error);
      }
    }

    const accessTokenClaims = decodeJwtPayload(tokens.access_token);
    const groups = parseGroups(claims["cognito:groups"]);
    const fallbackGroups = parseGroups(accessTokenClaims?.["cognito:groups"]);

    const user: SessionUser = {
      sub: claims.sub,
      email:
        (userInfo.email as string | undefined) ||
        (claims.email as string | undefined),
      name:
        (userInfo.name as string | undefined) ||
        (claims.name as string | undefined),
      username:
        (userInfo.preferred_username as string | undefined) ||
        (claims["cognito:username"] as string | undefined),
      groups: groups.length > 0 ? groups : fallbackGroups,
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
    };

    const returnTo = sanitizeReturnTo(authFlow.returnTo);
    const response = NextResponse.redirect(
      new URL(returnTo, getAppOrigin(request))
    );
    clearAuthFlow(response);
    setSession(response, user);
    return response;
  } catch (error) {
    console.error("Cognito callback failed:", error);
    const response = NextResponse.redirect(
      new URL("/?auth_error=callback", getAppOrigin(request))
    );
    clearAuthFlow(response);
    return response;
  }
}
