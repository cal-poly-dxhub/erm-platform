import { parseLambdaResponseBody } from "@/lib/api/parseLambdaResponse";

export type UserProfile = {
  cognito_sub: string;
  email: string;
  name: string;
  college?: string | null;
  unit?: string | null;
  department?: string | null;
  expertise: unknown;
  created_at?: string | null;
};

function isTruthyExists(value: unknown): boolean {
  return value === true || value === "true";
}

/** Parse GET profile response from /api/users/profile or raw Lambda JSON. */
export function extractUserProfile(
  data: unknown,
  session?: { name?: string; email?: string; sub?: string },
): UserProfile | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (obj.error) return null;

  const exists = isTruthyExists(obj.exists);
  const rawUser =
    obj.user && typeof obj.user === "object"
      ? (obj.user as Record<string, unknown>)
      : obj.cognito_sub || obj.email
        ? obj
        : null;

  if (!exists && !rawUser) return null;
  if (!rawUser) return null;

  const cognito_sub = String(rawUser.cognito_sub ?? session?.sub ?? "");
  const email = String(rawUser.email ?? session?.email ?? "").trim();
  const name = String(rawUser.name ?? session?.name ?? "").trim();

  if (!exists && !cognito_sub && !email) return null;

  return {
    cognito_sub,
    email: email || session?.email || "",
    name: name || session?.name || email || "User",
    college: (rawUser.college as string | null) ?? null,
    unit: (rawUser.unit as string | null) ?? null,
    department: (rawUser.department as string | null) ?? null,
    expertise: rawUser.expertise ?? [],
    created_at: (rawUser.created_at as string | null) ?? null,
  };
}

export function parseProfileLambdaText(raw: string): UserProfile | null {
  try {
    const parsed = parseLambdaResponseBody(raw);
    return extractUserProfile(parsed);
  } catch {
    return null;
  }
}
