import type { NextRequest } from "next/server";
import * as oidc from "openid-client";

let cachedConfig: Promise<oidc.Configuration> | null = null;

const requiredEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
};

const getClientId = () => requiredEnv("COGNITO_CLIENT_ID");
const getClientSecret = () => requiredEnv("COGNITO_CLIENT_SECRET");
const getRegion = () => requiredEnv("COGNITO_REGION");
const getUserPoolId = () => requiredEnv("COGNITO_USER_POOL_ID");

export const getAppOrigin = (request: NextRequest) => {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  const protoHeader = request.headers.get("x-forwarded-proto");
  const proto = protoHeader?.split(",")[0]?.trim() || "https";

  if (host) {
    return `${proto}://${host}`;
  }

  return request.nextUrl.origin;
};

export const getRedirectUri = (request: NextRequest) => {
  const explicit = process.env.COGNITO_REDIRECT_URI?.trim();
  if (explicit) {
    return explicit;
  }
  return `${getAppOrigin(request)}/api/auth/callback`;
};

const getLogoutRedirectUri = (request: NextRequest) => {
  const explicit = process.env.COGNITO_LOGOUT_REDIRECT_URI?.trim();
  if (explicit) {
    return explicit;
  }
  return `${getAppOrigin(request)}/`;
};

const getCognitoDomainBase = () => {
  const domain = process.env.COGNITO_DOMAIN?.trim();
  if (!domain) {
    return null;
  }
  return domain.startsWith("http") ? domain : `https://${domain}`;
};

export const buildCognitoLogoutUrl = (request: NextRequest) => {
  const domainBase = getCognitoDomainBase();
  if (!domainBase) {
    return null;
  }

  const logoutUrl = new URL("/logout", domainBase);
  logoutUrl.searchParams.set("client_id", getClientId());
  logoutUrl.searchParams.set("logout_uri", getLogoutRedirectUri(request));
  return logoutUrl.toString();
};

export const getScopes = () =>
  process.env.COGNITO_SCOPES?.trim() || "openid profile email";

export const getOidcConfiguration = async () => {
  if (!cachedConfig) {
    const issuer = new URL(
      `https://cognito-idp.${getRegion()}.amazonaws.com/${getUserPoolId()}`
    );
    cachedConfig = oidc.discovery(
      issuer,
      getClientId(),
      undefined,
      oidc.ClientSecretBasic(getClientSecret())
    );
  }
  return cachedConfig;
};
