"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  LayoutGrid,
  BarChart3,
  ClipboardCheck,
  Users,
  User,
  LogOut,
  GitBranch,
  FilePlus2,
} from "lucide-react";

type AuthUser = {
  sub: string;
  email?: string;
  name?: string;
  username?: string;
  groups: string[];
};

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingAdminCount, setPendingAdminCount] = useState<number | null>(
    null,
  );
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (isLogin) return;
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .catch(() => setUser(null));
  }, [isLogin]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (isLogin) {
    return <div className="min-h-screen bg-[#f8f9fa]">{children}</div>;
  }

  const isAdmin = user?.groups?.includes("admin") ?? false;

  useEffect(() => {
    if (!isAdmin) {
      setPendingAdminCount(null);
      return;
    }
    fetch("/api/admin/pending-risks", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setPendingAdminCount(data.length);
        } else {
          setPendingAdminCount(null);
        }
      })
      .catch(() => setPendingAdminCount(null));
  }, [isAdmin]);

  const navLink =
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 hover:text-white";
  const navLinkActive = "bg-white/15 text-white";

  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-64 flex-col bg-calpoly-green text-white transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
          <span className="text-sm font-semibold tracking-wide text-white/90">
            Cal Poly ERM
          </span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-white/80 hover:bg-white/10 lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col p-3">
          <div className="flex flex-col gap-1">
            <Link
              href="/#register"
              className={
                navLink + (pathname === "/" ? " " + navLinkActive : "")
              }
            >
              <LayoutGrid className="h-5 w-5 shrink-0" />
              Risk Register
            </Link>
            <Link
              href="/#submit"
              className={navLink}
            >
              <FilePlus2 className="h-5 w-5 shrink-0" />
              Submit Risk
            </Link>
            <Link
              href="/#gap"
              className={navLink}
            >
              <GitBranch className="h-5 w-5 shrink-0" />
              Gap Analysis
            </Link>
          </div>

          <div className="my-3 border-t border-white/10" />

          <div className="flex flex-col gap-1">
            <Link
              href="/dashboard"
              className={
                navLink +
                (pathname?.startsWith("/dashboard") &&
                !pathname?.includes("/admin")
                  ? " " + navLinkActive
                  : "")
              }
            >
              <BarChart3 className="h-5 w-5 shrink-0" />
              Dashboard
            </Link>
            {isAdmin && (
              <>
                <Link
                  href="/dashboard/admin/review"
                  className={
                    navLink +
                    (pathname === "/dashboard/admin/review"
                      ? " " + navLinkActive
                      : "")
                  }
                >
                  <ClipboardCheck className="h-5 w-5 shrink-0" />
                  <span>Admin Review</span>
                  {pendingAdminCount && pendingAdminCount > 0 && (
                    <span className="ml-auto inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-calpoly-gold px-1.5 py-0.5 text-xs font-semibold text-calpoly-green">
                      {pendingAdminCount}
                    </span>
                  )}
                </Link>
                <Link
                  href="/dashboard/admin/users"
                  className={
                    navLink +
                    (pathname === "/dashboard/admin/users"
                      ? " " + navLinkActive
                      : "")
                  }
                >
                  <Users className="h-5 w-5 shrink-0" />
                  User Management
                </Link>
              </>
            )}
          </div>

          <div className="mt-auto border-t border-white/10 pt-3">
            <div className="flex flex-col gap-1">
              <Link
                href="/profile"
                className={
                  navLink +
                  (pathname === "/profile" ? " " + navLinkActive : "")
                }
              >
                <User className="h-5 w-5 shrink-0" />
                My Profile
              </Link>
              <Link href="/api/auth/logout" className={navLink}>
                <LogOut className="h-5 w-5 shrink-0" />
                Sign Out
              </Link>
            </div>
          </div>
        </nav>
      </aside>

      {/* Mobile menu button */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-lg bg-calpoly-green text-white shadow lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Main content (scrolls independently beside fixed sidebar) */}
      <main className="min-w-0 flex-1 pl-0 lg:pl-64">
        <div className="mx-auto max-w-[1200px] px-4 py-6 pt-14 lg:px-8 lg:py-8 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
