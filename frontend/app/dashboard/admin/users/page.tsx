"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, UserPlus, UserMinus, RefreshCw } from "lucide-react";

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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-calpoly-gold">
            Admin
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-calpoly-green">
            User Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Invite admins and remove admin access for the ERM platform.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchAdmins}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {actionMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {actionMessage}
        </div>
      )}

      {removeConfirmEmail && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-calpoly-green">Remove admin access</h2>
          <p className="mt-2 text-sm text-gray-600">
            Remove admin access for <strong className="text-gray-900">{removeConfirmEmail}</strong>? They will no longer be able to approve or reject risks.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRemoveConfirmEmail(null)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => removeAdmin(removeConfirmEmail)}
              disabled={actingEmail !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
            >
              <UserMinus className="h-4 w-4" />
              Yes, remove admin
            </button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-calpoly-green">Invite admin</h2>
        <p className="mt-1 text-sm text-gray-500">
          Send an invitation to add a new admin. They must accept the invite to gain access.
        </p>
        <form onSubmit={inviteUser} className="mt-4 flex flex-wrap items-end gap-4">
          <div className="min-w-[200px]">
            <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@calpoly.edu"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
              required
              disabled={inviteSubmitting}
            />
          </div>
          <button
            type="submit"
            disabled={inviteSubmitting || !inviteEmail.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-calpoly-green px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            {inviteSubmitting ? "Sending…" : "Invite as admin"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-calpoly-green">Current admins</h2>
        <p className="mt-1 text-sm text-gray-500">
          Admins with access to Risk Review and User Management. You are not shown in this list.
        </p>
        {loading ? (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Loading…
          </div>
        ) : (() => {
          const otherAdmins = admins.filter(
            (a) => !currentUserEmail || a.email?.toLowerCase() !== currentUserEmail
          );
          return otherAdmins.length === 0 ? (
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
              No other admins.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-left text-sm text-gray-700">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Enabled</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {otherAdmins.map((a) => (
                    <tr key={a.email} className="transition hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                        {a.email}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                        {a.status ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {a.enabled !== false ? (
                          <span className="font-medium text-calpoly-green">Yes</span>
                        ) : (
                          <span className="text-gray-500">No</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openRemoveConfirm(a.email)}
                          disabled={actingEmail !== null}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
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
  );
}
