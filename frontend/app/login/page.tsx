import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, getSessionFromCookieValue } from "@/lib/auth/session";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const normalizeReturnTo = (value: string | string[] | undefined) => {
  const firstValue = Array.isArray(value) ? value[0] : value;
  if (!firstValue || !firstValue.startsWith("/") || firstValue.startsWith("//")) {
    return "/dashboard";
  }
  return firstValue;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const returnTo = normalizeReturnTo(params.returnTo);

  const cookieStore = await cookies();
  const session = getSessionFromCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (session) {
    redirect(returnTo);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold tracking-widest text-calpoly-gold">
          ENTERPRISE RISK MANAGEMENT
        </p>
        <h1 className="mt-2 text-3xl font-bold text-calpoly-green">Sign In</h1>
        <p className="mt-3 text-sm text-gray-600">
          You must sign in before using the risk tool.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`}
            className="inline-flex items-center justify-center rounded-lg bg-calpoly-green px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            Sign in with Cognito
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            Back
          </Link>
        </div>
      </div>
    </main>
  );
}
