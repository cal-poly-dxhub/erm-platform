import { NextRequest, NextResponse } from "next/server";
import * as oidc from "openid-client";
import { getAppOrigin, getOidcConfiguration } from "@/lib/auth/cognito";
import { getProfileExists } from "@/lib/auth/checkUserProfile";
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
    const callbackUrl = new URL(authFlow.redirectUri);
    callbackUrl.search = request.nextUrl.search;
    const tokens = await oidc.authorizationCodeGrant(
      config,
      callbackUrl,
      {
        expectedState: authFlow.state,
        expectedNonce: authFlow.nonce,
        pkceCodeVerifier: authFlow.codeVerifier,
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
    const groupsFromAccess = parseGroups(
      accessTokenClaims?.["cognito:groups"],
    );

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
      groups: groupsFromAccess,
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
    };

    const returnTo = sanitizeReturnTo(authFlow.returnTo);
    let destination = returnTo;
    try {
      const profileExists = await getProfileExists(user);
      if (profileExists === false) {
        destination = "/onboarding";
      }
    } catch (error) {
      console.warn("Profile check on login failed:", error);
    }

    const response = NextResponse.redirect(
      new URL(destination, getAppOrigin(request))
    );
    clearAuthFlow(response);
    setSession(response, user);
    return response;
  } catch (error) {
    console.error("Cognito callback failed:", error);

    const errorWithFields = error as {
      code?: string;
      error?: string;
      error_description?: string;
      status?: number;
      cause?: { error?: string; error_description?: string };
    };

    const authError =
      errorWithFields.error ||
      errorWithFields.cause?.error ||
      errorWithFields.code ||
      "callback";
    const authErrorDescription =
      errorWithFields.error_description ||
      errorWithFields.cause?.error_description ||
      (typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "");

    const destination = new URL("/", getAppOrigin(request));
    destination.searchParams.set("auth_error", authError);
    if (authErrorDescription) {
      destination.searchParams.set("auth_error_description", authErrorDescription);
    }
    if (typeof errorWithFields.status === "number") {
      destination.searchParams.set("auth_status", String(errorWithFields.status));
    }

    const response = NextResponse.redirect(destination);
    clearAuthFlow(response);
    return response;
  }
}
