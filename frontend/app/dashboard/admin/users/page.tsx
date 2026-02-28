"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, UserPlus, UserMinus } from "lucide-react";

type AdminRow = {
  email: string;
  status?: string;
  enabled?: boolean;
};

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actingEmail, setActingEmail] = useState<string | null>(null);
  const [removeConfirmEmail, setRemoveConfirmEmail] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActionMessage(null);
    try {
      const res = await fetch("/api/admin/cognito-admin", { credentials: "include" });
      if (res.status === 401) {
        window.location.href = "/login?returnTo=/dashboard/admin/users";
        return;
      }
      if (res.status === 403) {
        setError("You do not have admin access.");
        setAdmins([]);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || `Failed to load admins (${res.status})`);
        setAdmins([]);
        return;
      }
      setAdmins(Array.isArray(data?.admins) ? data.admins : []);

      const meRes = await fetch("/api/auth/me", { credentials: "include" });
      if (meRes.ok) {
        const meData = await meRes.json().catch(() => ({}));
        const email = meData?.user?.email ?? meData?.user?.username ?? null;
        setCurrentUserEmail(email ? String(email).trim().toLowerCase() : null);
      } else {
        setCurrentUserEmail(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load admins");
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const inviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setInviteSubmitting(true);
    setActionMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/cognito-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "invite_user", email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setActionMessage("User already exists.");
        return;
      }
      if (!res.ok) {
        setActionMessage(data?.error || "Failed to invite user");
        return;
      }
      setActionMessage(`Invitation sent to ${email}.`);
      setInviteEmail("");
      await fetchAdmins();
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Request failed");
    } finally {
      setInviteSubmitting(false);
    }
  };

  const openRemoveConfirm = (email: string) => {
    setRemoveConfirmEmail(email);
    setActionMessage(null);
  };

  const removeAdmin = async (email: string) => {
    setRemoveConfirmEmail(null);
    setActingEmail(email);
    setActionMessage(null);
    try {
      const res = await fetch("/api/admin/cognito-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "remove_admin", email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionMessage(data?.error || "Failed to remove admin access");
        return;
      }
      setActionMessage(`Admin access removed for ${email}.`);
      await fetchAdmins();
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Request failed");
    } finally {
      setActingEmail(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 text-gray-800">
      <div className="container mx-auto px-4 py-8 md:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-widest text-calpoly-gold">
              ADMIN
            </p>
            <h1 className="text-4xl font-bold text-calpoly-green">
              User Management
            </h1>
            <p className="mt-2 text-gray-600">
              Invite admins and remove admin access.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/admin/review"
              className="inline-flex items-center rounded-lg border border-calpoly-green/30 bg-white px-4 py-2 text-sm font-semibold text-calpoly-green shadow-sm transition hover:bg-gray-50"
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Risk Review
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-lg border border-calpoly-green/30 bg-white px-4 py-2 text-sm font-semibold text-calpoly-green shadow-sm transition hover:bg-gray-50"
            >
              Back to Dashboard
            </Link>
            <button
              onClick={fetchAdmins}
              disabled={loading}
              className="inline-flex items-center rounded-lg bg-calpoly-green px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </section>
        )}
        {actionMessage && (
          <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {actionMessage}
          </section>
        )}

        {removeConfirmEmail && (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm">
            <p className="font-medium text-red-800">
              Remove admin access for <strong>{removeConfirmEmail}</strong>?
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setRemoveConfirmEmail(null)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => removeAdmin(removeConfirmEmail)}
                disabled={actingEmail !== null}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                Yes, remove admin
              </button>
            </div>
          </section>
        )}

        <section className="mt-8 rounded-2xl border border-calpoly-gold/30 bg-white/80 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-calpoly-green">
            Invite admin
          </h2>
          <form onSubmit={inviteUser} className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@example.edu"
                className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-calpoly-green focus:outline-none focus:ring-1 focus:ring-calpoly-green"
                required
                disabled={inviteSubmitting}
              />
            </div>
            <button
              type="submit"
              disabled={inviteSubmitting || !inviteEmail.trim()}
              className="inline-flex items-center rounded-lg bg-calpoly-green px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {inviteSubmitting ? "Sending…" : "Invite as admin"}
            </button>
          </form>
        </section>

        <section className="mt-8 rounded-2xl border border-calpoly-gold/30 bg-white/80 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-calpoly-green">
            Current admins
          </h2>
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : (() => {
            const otherAdmins = admins.filter(
              (a) => !currentUserEmail || a.email?.toLowerCase() !== currentUserEmail
            );
            return otherAdmins.length === 0 ? (
              <p className="text-gray-500">No other admins. (You are not shown in the list.)</p>
            ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-calpoly-green">
                      Email
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-calpoly-green">
                      Status
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-calpoly-green">
                      Enabled
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-calpoly-green">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {otherAdmins.map((a) => (
                    <tr key={a.email} className="hover:bg-gray-50/80">
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-800">
                        {a.email}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
                        {a.status ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm">
                        {a.enabled !== false ? (
                          <span className="text-calpoly-green">Yes</span>
                        ) : (
                          <span className="text-gray-500">No</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm">
                        <button
                          type="button"
                          onClick={() => openRemoveConfirm(a.email)}
                          disabled={actingEmail !== null}
                          className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          <UserMinus className="h-4 w-4" />
                          Remove admin
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            );
          })()}
        </section>
      </div>
    </div>
  );
}
