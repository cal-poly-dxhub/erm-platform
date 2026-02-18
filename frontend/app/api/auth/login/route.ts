import { NextRequest, NextResponse } from "next/server";
import * as oidc from "openid-client";
import {
  getOidcConfiguration,
  getRedirectUri,
  getScopes,
} from "@/lib/auth/cognito";
import {
  sanitizeReturnTo,
  setAuthFlow,
} from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const config = await getOidcConfiguration();
    const redirectUri = getRedirectUri(request);
    const returnTo = sanitizeReturnTo(
      request.nextUrl.searchParams.get("returnTo")
    );

    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

    const authorizationUrl = oidc.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      response_type: "code",
      scope: getScopes(),
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const response = NextResponse.redirect(authorizationUrl);
    setAuthFlow(response, {
      state,
      nonce,
      codeVerifier,
      redirectUri,
      returnTo,
    });
    return response;
  } catch (error) {
    console.error("Login initialization failed:", error);
    return NextResponse.json(
      { error: "Unable to initialize Cognito login flow." },
      { status: 500 }
    );
  }
}
