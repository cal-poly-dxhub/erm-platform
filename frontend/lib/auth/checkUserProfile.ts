import { parseLambdaResponseBody } from "@/lib/api/parseLambdaResponse";
import { extractUserProfile } from "@/lib/api/userProfile";
import type { SessionUser } from "@/lib/auth/session";

const profileLambdaUrl = () =>
  process.env.USER_PROFILE_LAMBDA_API_URL?.trim() ||
  process.env.USER_PROFILE_API_URL?.trim() ||
  "";

/** true = profile exists, false = needs onboarding, null = could not check */
export async function getProfileExists(
  user: SessionUser,
): Promise<boolean | null> {
  const url = profileLambdaUrl();
  if (!url) return null;

  const tokens = [user.accessToken, user.idToken].filter(
    (t): t is string => Boolean(t),
  );
  if (tokens.length === 0) return null;

  console.log("[profile] login callback check → Lambda action=get");

  for (const token of tokens) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "get" }),
    });

    if (res.ok) {
      const raw = await res.text();
      const data = parseLambdaResponseBody(raw);
      return extractUserProfile(data, {
        sub: user.sub,
        email: user.email,
        name: user.name,
      }) !== null;
    }

    if (res.status !== 401 && res.status !== 403) {
      return null;
    }
  }

  return null;
}
