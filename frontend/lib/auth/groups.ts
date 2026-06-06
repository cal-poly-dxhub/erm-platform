/** Cognito group names — must match User Pool and AVP UserGroup entities. */
export const COGNITO_GROUP_USER = "user";
export const COGNITO_GROUP_ADMIN = "admin";
export const COGNITO_GROUP_SUPER_ADMIN = "super_admin";

export function parseCognitoGroups(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((g): g is string => typeof g === "string" && g.trim() !== "");
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
  }
  return [];
}

/** Groups from a decoded Cognito JWT payload (`cognito:groups`). */
export function groupsFromTokenPayload(
  tokenPayload: Record<string, unknown>,
): string[] {
  return parseCognitoGroups(tokenPayload["cognito:groups"] ?? []);
}

/** Role flags from access-token groups only (not cached session fallbacks). */
export function authFlagsFromGroups(groups: string[]) {
  return {
    groups,
    isAdmin:
      groups.includes(COGNITO_GROUP_ADMIN) ||
      groups.includes(COGNITO_GROUP_SUPER_ADMIN),
    isSuperAdmin: groups.includes(COGNITO_GROUP_SUPER_ADMIN),
  };
}

export function decodeAccessTokenPayload(
  accessToken: string | undefined,
): Record<string, unknown> | null {
  if (!accessToken) return null;
  const parts = accessToken.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (payload.length % 4)) % 4;
    const json = Buffer.from(payload + "=".repeat(padding), "base64").toString(
      "utf-8",
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Read `cognito:groups` from a Cognito access token JWT payload. */
export function groupsFromAccessToken(accessToken: string | undefined): string[] {
  const claims = decodeAccessTokenPayload(accessToken);
  return claims ? groupsFromTokenPayload(claims) : [];
}

export function isAdmin(groups: string[]): boolean {
  return authFlagsFromGroups(groups).isAdmin;
}

export function isSuperAdmin(groups: string[]): boolean {
  return authFlagsFromGroups(groups).isSuperAdmin;
}

export function normalizeIdentity(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function isRiskOwner(
  risk: { owner?: string | null },
  user: {
    email?: string;
    name?: string;
    username?: string;
    sub?: string;
  },
): boolean {
  const owner = normalizeIdentity(risk.owner);
  if (!owner) return false;
  const keys = [user.email, user.name, user.username, user.sub]
    .filter(Boolean)
    .map((v) => normalizeIdentity(String(v)));
  return keys.some((k) => k === owner);
}

export function canEditRiskInRegister(
  risk: { owner?: string | null },
  user: {
    email?: string;
    name?: string;
    username?: string;
    sub?: string;
  },
  groups: string[],
): boolean {
  if (isAdmin(groups)) return true;
  return isRiskOwner(risk, user);
}
