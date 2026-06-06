"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/lib/auth/useAuthUser";

/** Alias route: /user-management */
export default function UserManagementAliasPage() {
  const router = useRouter();
  const { loading, isSuperAdmin } = useAuthUser();

  useEffect(() => {
    if (loading) return;
    router.replace(
      isSuperAdmin ? "/dashboard/admin/users" : "/dashboard",
    );
  }, [loading, isSuperAdmin, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-600">
      Loading…
    </div>
  );
}
