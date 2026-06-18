"use client";

import { useEffect, useState } from "react";
import { getRole } from "@/lib/auth/roles";
import { authFlagsFromGroups } from "@/lib/auth/groups";

export type AuthUser = {
  sub: string;
  email?: string;
  name?: string;
  username?: string;
  groups: string[];
  role?: string | null;
};

export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setUser(null);
          return;
        }
        const data = await res.json().catch(() => ({}));
        const u = data?.user;
        if (!cancelled) {
          setUser(
            u?.sub
              ? {
                  sub: u.sub,
                  email: u.email,
                  name: u.name,
                  username: u.username,
                  groups: Array.isArray(u.groups) ? u.groups : [],
                  role: u.role ?? getRole(u.groups ?? []) ?? null,
                }
              : null,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = user?.groups ?? [];
  const { isAdmin, isSuperAdmin } = authFlagsFromGroups(groups);

  useEffect(() => {
    if (loading || !user) return;
    console.log("current groups", groups);
    console.log("isSuperAdmin", isSuperAdmin);
  }, [loading, user, groups, isSuperAdmin]);

  return {
    user,
    loading,
    groups,
    isAdmin,
    isSuperAdmin,
  };
}
