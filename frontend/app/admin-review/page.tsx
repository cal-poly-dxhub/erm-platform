"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/lib/auth/useAuthUser";

/** Alias route: /admin-review */
export default function AdminReviewAliasPage() {
  const router = useRouter();
  const { loading, isAdmin } = useAuthUser();

  useEffect(() => {
    if (loading) return;
    router.replace(isAdmin ? "/dashboard/admin/review" : "/dashboard");
  }, [loading, isAdmin, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-600">
      Loading…
    </div>
  );
}
