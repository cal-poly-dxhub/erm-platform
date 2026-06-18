"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/lib/auth/useAuthUser";

/** Redirect non-admins to /dashboard (AVP still enforces APIs). */
export function useAdminRouteGuard(loginReturnTo: string) {
  const router = useRouter();
  const { user, loading, isAdmin } = useAuthUser();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?returnTo=${encodeURIComponent(loginReturnTo)}`);
      return;
    }
    if (!isAdmin) {
      router.replace("/dashboard");
    }
  }, [user, loading, isAdmin, router, loginReturnTo]);

  return { user, loading, isAdmin, ready: !loading && !!user && isAdmin };
}

/** Redirect non–super-admins to /dashboard (AVP still enforces APIs). */
export function useSuperAdminRouteGuard(loginReturnTo: string) {
  const router = useRouter();
  const { user, loading, isSuperAdmin } = useAuthUser();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?returnTo=${encodeURIComponent(loginReturnTo)}`);
      return;
    }
    if (!isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [user, loading, isSuperAdmin, router, loginReturnTo]);

  return {
    user,
    loading,
    isSuperAdmin,
    ready: !loading && !!user && isSuperAdmin,
  };
}
