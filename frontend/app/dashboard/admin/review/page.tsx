"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Clock, CheckCircle, XCircle, MoreHorizontal, RefreshCw } from "lucide-react";
import RiskModal from "@/components/RiskModal";
import { useAdminRouteGuard } from "@/lib/auth/useRouteGuard";
import { Risk } from "@/types";

type ApiRisk = {
  id?: number | string | null;
  risk_id: string | null;
  unit: string | null;
  department: string | null;
  owner: string | null;
  risk_description: string | null;
  risk_analysis: string | null;
  category: string | null;
  current_controls: string | null;
  baseline_likelihood: string | number | null;
  baseline_impact: string | number | null;
  mitigation_strategies: string | null;
  updated_likelihood: string | number | null;
  updated_impact: string | number | null;
  status: string | null;
  resources_needed: string | null;
  additional_comments: string | null;
  approval_status?: "pending" | "approved" | "rejected" | null;
  rejection_reason?: string | null;
  rejectionReason?: string | null;
  [key: string]: string | number | boolean | null | undefined;
};

function getRejectionReason(r: ApiRisk): string {
  const raw = r.rejection_reason ?? r.rejectionReason;
  if (raw == null || raw === "") return "--";
  return String(raw).trim() || "--";
}

const COLLEGE_VALUES = new Set(["cafes", "caed", "ocob", "ceng", "cla", "bcsm", "cpace"]);
const UNIT_VALUES = new Set([
  "academic_affairs", "admin_finance", "student_affairs", "diversity", "research",
  "its", "facilities", "public_safety", "partners", "advancement", "marketing",
]);

function apiRiskToRisk(api: ApiRisk): Risk {
  const numericFallbackFromRiskId =
    typeof api.risk_id === "string" && /^\d+$/.test(api.risk_id.trim())
      ? api.risk_id.trim()
      : "";
  const id =
    api.id != null
      ? String(api.id)
      : numericFallbackFromRiskId;
  const rawUnit = (api.unit ?? "").toString().trim();
  const normalized = rawUnit ? rawUnit.toLowerCase() : "";
  const isUnit = normalized && UNIT_VALUES.has(normalized);
  const orgType: "college" | "unit" = isUnit ? "unit" : "college";
  const valueForSelect = normalized || undefined;
  return {
    id,
    riskIdNo: api.risk_id ?? undefined,
    orgType,
    college: orgType === "college" ? valueForSelect : undefined,
    unit: orgType === "unit" ? valueForSelect : undefined,
    collegeUnit: valueForSelect ?? rawUnit ?? undefined,
    department: api.department ?? undefined,
    owner: api.owner ?? undefined,
    risk: api.risk_description ?? undefined,
    riskAnalysis: api.risk_analysis ?? undefined,
    currentControls: api.current_controls ?? undefined,
    likelihood:
      api.baseline_likelihood != null
        ? String(api.baseline_likelihood)
        : undefined,
    impact:
      api.baseline_impact != null ? String(api.baseline_impact) : undefined,
    additionalControls: api.mitigation_strategies ?? undefined,
    updatedLikelihood:
      api.updated_likelihood != null
        ? String(api.updated_likelihood)
        : undefined,
    updatedImpact:
      api.updated_impact != null ? String(api.updated_impact) : undefined,
    status: api.status ?? undefined,
    riskCategory: api.category ?? undefined,
    resourcesNeeded: api.resources_needed ?? undefined,
    ermComments: api.additional_comments ?? undefined,
    approvalStatus:
      api.approval_status === "approved" ||
      api.approval_status === "pending" ||
      api.approval_status === "rejected"
        ? api.approval_status
        : undefined,
    rejectionReason: api.rejection_reason ?? api.rejectionReason ?? undefined,
  };
}

function parseNumericId(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default function AdminReviewPage() {
  const { ready } = useAdminRouteGuard("/dashboard/admin/review");
  const [allRisks, setAllRisks] = useState<ApiRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalRisk, setModalRisk] = useState<Risk | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rejectDialogRisk, setRejectDialogRisk] = useState<Risk | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deleteDialogRisk, setDeleteDialogRisk] = useState<Risk | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "rejected" | "approved">("pending");
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);

  const pendingRisks = useMemo(
    () => allRisks.filter((r) => r.approval_status === "pending"),
    [allRisks],
  );
  const rejectedRisks = useMemo(
    () => allRisks.filter((r) => r.approval_status === "rejected"),
    [allRisks],
  );
  const approvedRisks = useMemo(
    () => allRisks.filter((r) => r.approval_status === "approved"),
    [allRisks],
  );

  const togglePendingSelected = (id: string) => {
    setSelectedPendingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const clearPendingSelection = () => {
    setSelectedPendingIds([]);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActionMessage(null);
    try {
      const [pendingRes, rejectedRes, approvedRes] = await Promise.all([
        fetch("/api/admin/pending-risks", { credentials: "include" }),
        fetch("/api/admin/rejected-risks", { credentials: "include" }),
        fetch("/api/admin/approved-risks", { credentials: "include" }),
      ]);
      if (
        pendingRes.status === 401 ||
        rejectedRes.status === 401 ||
        approvedRes.status === 401
      ) {
        window.location.href = "/login?returnTo=/dashboard/admin/review";
        return;
      }
      if (
        pendingRes.status === 403 ||
        rejectedRes.status === 403 ||
        approvedRes.status === 403
      ) {
        setError("You do not have admin access.");
        setAllRisks([]);
        return;
      }
      const pendingData = pendingRes.ok ? await pendingRes.json() : [];
      const rejectedData = rejectedRes.ok ? await rejectedRes.json() : [];
      const approvedData = approvedRes.ok ? await approvedRes.json() : [];
      const pendingList = Array.isArray(pendingData) ? pendingData : [];
      const rejectedList = Array.isArray(rejectedData) ? rejectedData : [];
      const approvedList = Array.isArray(approvedData) ? approvedData : [];
      if (!pendingRes.ok) {
        const err = await pendingRes.json().catch(() => ({}));
        setError(err?.error || `Failed to load pending: ${pendingRes.status}`);
      } else if (!rejectedRes.ok) {
        const err = await rejectedRes.json().catch(() => ({}));
        setError(
          err?.error || `Failed to load rejected: ${rejectedRes.status}`,
        );
      } else if (!approvedRes.ok) {
        const err = await approvedRes.json().catch(() => ({}));
        setError(
          err?.error || `Failed to load approved: ${approvedRes.status}`,
        );
      }
      setAllRisks([...pendingList, ...rejectedList, ...approvedList]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load risks");
      setAllRisks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready) fetchAll();
  }, [fetchAll, ready]);

  const handleApprove = async (risk: Risk) => {
    const numericId = parseNumericId(risk.id);
    if (!numericId) {
      setActionMessage("This record is missing a valid database ID and cannot be approved.");
      return;
    }
    try {
      const res = await fetch("/api/admin/approve-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: numericId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const detail =
          typeof data?.upstreamBody === "string" && data.upstreamBody.trim()
            ? ` ${data.upstreamBody}`
            : "";
        setActionMessage((data?.error || "Failed to approve") + detail);
        return;
      }
      setModalOpen(false);
      setModalRisk(null);
      await fetchAll();
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Failed to approve");
    }
  };

  const handleBulkApprovePending = async () => {
    if (!selectedPendingIds.length) return;
    setBulkApproving(true);
    setActionMessage(null);
    try {
      for (const id of selectedPendingIds) {
        const numericId = parseNumericId(id);
        if (!numericId) {
          continue;
        }
        const res = await fetch("/api/admin/approve-risk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: numericId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const detail =
            typeof data?.upstreamBody === "string" && data.upstreamBody.trim()
              ? ` ${data.upstreamBody}`
              : "";
          setActionMessage(
            (data?.error || "Failed to approve one or more risks") + detail,
          );
          break;
        }
      }
      clearPendingSelection();
      await fetchAll();
    } catch (e) {
      setActionMessage(
        e instanceof Error ? e.message : "Failed to approve selected risks",
      );
    } finally {
      setBulkApproving(false);
    }
  };

  const handleReject = async (risk: Risk, reason: string) => {
    const numericId = parseNumericId(risk.id);
    if (!numericId) {
      setActionMessage("This record is missing a valid database ID and cannot be rejected.");
      return;
    }
    const riskId = String(numericId);
    setRejectingId(riskId);
    try {
      const res = await fetch("/api/admin/reject-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: numericId, rejection_reason: reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const detail =
          typeof data?.upstreamBody === "string" && data.upstreamBody.trim()
            ? ` ${data.upstreamBody}`
            : "";
        setActionMessage((data?.error || "Failed to reject") + detail);
        return;
      }
      setRejectingId(null);
      setRejectReason("");
      setRejectDialogRisk(null);
      setModalOpen(false);
      setModalRisk(null);
      await fetchAll();
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Failed to reject");
    } finally {
      setRejectingId(null);
    }
  };

  const handleDelete = async (risk: Risk) => {
    const numericId = parseNumericId(risk.id);
    if (!numericId) {
      setActionMessage("This record is missing a valid database ID and cannot be deleted.");
      return;
    }
    const riskId = String(numericId);
    setDeletingId(riskId);
    try {
      const res = await fetch("/api/admin/delete-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: numericId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const detail =
          typeof data?.upstreamBody === "string" && data.upstreamBody.trim()
            ? ` ${data.upstreamBody}`
            : "";
        setActionMessage((data?.error || "Failed to delete") + detail);
        return;
      }
      if (modalRisk?.id === riskId) {
        setModalOpen(false);
        setModalRisk(null);
      }
      setDeleteDialogRisk(null);
      await fetchAll();
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  // Note: intentionally no "move to pending" helper; moving between approval states
  // should use the existing approve / reject flows or a dedicated backend action.

  const openEdit = (apiRisk: ApiRisk) => {
    setModalRisk(apiRiskToRisk(apiRisk));
    setModalOpen(true);
  };

  const openRejectDialog = (risk: Risk) => {
    setRejectDialogRisk(risk);
    setRejectReason("");
  };

  const openDeleteDialog = (risk: Risk) => {
    setDeleteDialogRisk(risk);
  };

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-600">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-calpoly-gold">
            Admin
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-calpoly-green">
            Risk Review
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Review pending risks, view rejected with reasons, and manage approved risks.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchAll}
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

      {!loading && (
        <div className="grid gap-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-calpoly-gold/50 hover:bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-calpoly-gold/10">
                <Clock className="h-5 w-5 text-calpoly-gold" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pending</p>
                <p className="mt-1 text-2xl font-bold text-calpoly-green">{pendingRisks.length}</p>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("approved")}
            className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-calpoly-green/50 hover:bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-calpoly-green/30"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-calpoly-green/10">
                <CheckCircle className="h-5 w-5 text-calpoly-green" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Approved</p>
                <p className="mt-1 text-2xl font-bold text-calpoly-green">{approvedRisks.length}</p>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rejected")}
            className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-red-200 hover:bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-red-200"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rejected</p>
                <p className="mt-1 text-2xl font-bold text-red-700">{rejectedRisks.length}</p>
              </div>
            </div>
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <nav className="inline-flex rounded-lg bg-gray-100 p-1" aria-label="Tabs">
          {[
            { id: "pending" as const, label: "Pending", count: pendingRisks.length },
            { id: "approved" as const, label: "Approved", count: approvedRisks.length },
            { id: "rejected" as const, label: "Rejected", count: rejectedRisks.length },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-white text-calpoly-green shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {activeTab === "pending" && (
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-calpoly-green">Pending</h2>
              {pendingRisks.length > 0 && (
                <button
                  type="button"
                  onClick={handleBulkApprovePending}
                  disabled={bulkApproving || selectedPendingIds.length === 0}
                  className="inline-flex items-center rounded-lg bg-calpoly-green px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                >
                  {bulkApproving ? "Approving…" : "Approve selected"}
                </button>
              )}
            </div>
            {loading ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">Loading…</div>
            ) : pendingRisks.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">No pending risks.</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-left text-sm text-gray-700">
                  <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label="Select all pending risks"
                          checked={pendingRisks.length > 0 && selectedPendingIds.length === pendingRisks.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPendingIds(
                                pendingRisks.map((r) => apiRiskToRisk(r).id ?? String(r.risk_id ?? r.id ?? "")),
                              );
                            } else {
                              clearPendingSelection();
                            }
                          }}
                        />
                      </th>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Owner</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {pendingRisks.map((r, idx) => {
                      const risk = apiRiskToRisk(r);
                      const rowKey = risk.id || String(r.riskIdNo ?? idx);
                      return (
                        <tr key={r.risk_id ?? r.id ?? idx} className="transition hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              aria-label="Select risk"
                              checked={selectedPendingIds.includes(rowKey)}
                              onChange={() => togglePendingSelected(rowKey)}
                            />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{r.risk_id ?? "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-600">{r.department ?? "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-600">{r.category ?? "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-600">{r.owner ?? "—"}</td>
                          <td className="max-w-xs truncate px-4 py-3 text-gray-600" title={r.risk_description ?? "—"}>
                            {r.risk_description ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEdit(r)}
                                className="rounded-lg border border-calpoly-green bg-white px-3 py-2 text-sm font-medium text-calpoly-green transition hover:bg-calpoly-green/5"
                              >
                                View / Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApprove(risk)}
                                className="rounded-lg bg-calpoly-green px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                              >
                                Approve
                              </button>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setOpenMenuFor(rowKey === openMenuFor ? null : rowKey)}
                                  className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-2 text-gray-600 transition hover:bg-gray-50"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                                {openMenuFor === rowKey && (
                                  <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                                    <button
                                      type="button"
                                      onClick={() => { openRejectDialog(risk); setOpenMenuFor(null); }}
                                      disabled={rejectingId === risk.id}
                                      className="flex w-full items-center px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                                    >
                                      Reject
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { openDeleteDialog(risk); setOpenMenuFor(null); }}
                                      disabled={deletingId === risk.id}
                                      className="flex w-full items-center px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "rejected" && (
          <div className="mt-6">
            <h2 className="mb-4 text-lg font-semibold text-calpoly-green">Rejected</h2>
            {loading ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">Loading…</div>
            ) : rejectedRisks.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">No rejected risks.</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-left text-sm text-gray-700">
                  <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Owner</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Rejection reason</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {rejectedRisks.map((r, idx) => {
                      const risk = apiRiskToRisk(r);
                      const rowKey = risk.id || String(r.riskIdNo ?? idx);
                      return (
                        <tr key={r.risk_id ?? r.id ?? idx} className="transition hover:bg-gray-50">
                          <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{r.risk_id ?? "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-600">{r.department ?? "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-600">{r.category ?? "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-600">{r.owner ?? "—"}</td>
                          <td className="max-w-xs truncate px-4 py-3 text-gray-600" title={r.risk_description ?? "—"}>
                            {r.risk_description ?? "—"}
                          </td>
                          <td className="max-w-xs px-4 py-3 text-sm text-red-700 whitespace-normal" title={getRejectionReason(r) !== "—" ? getRejectionReason(r) : undefined}>
                            {getRejectionReason(r)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEdit(r)}
                                className="rounded-lg border border-calpoly-green bg-white px-3 py-2 text-sm font-medium text-calpoly-green transition hover:bg-calpoly-green/5"
                              >
                                View / Edit
                              </button>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setOpenMenuFor(rowKey === openMenuFor ? null : rowKey)}
                                  className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-2 text-gray-600 transition hover:bg-gray-50"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                                {openMenuFor === rowKey && (
                                  <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                                    <button
                                      type="button"
                                      onClick={() => { handleApprove(risk); setOpenMenuFor(null); }}
                                      className="flex w-full items-center px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { openDeleteDialog(risk); setOpenMenuFor(null); }}
                                      disabled={deletingId === risk.id}
                                      className="flex w-full items-center px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "approved" && (
          <div className="mt-6">
            <h2 className="mb-4 text-lg font-semibold text-calpoly-green">Approved</h2>
            {loading ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">Loading…</div>
            ) : approvedRisks.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">No approved risks yet.</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-left text-sm text-gray-700">
                  <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Owner</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {approvedRisks.map((r, idx) => {
                      const risk = apiRiskToRisk(r);
                      const rowKey = risk.id || String(r.riskIdNo ?? idx);
                      return (
                        <tr key={r.risk_id ?? r.id ?? idx} className="transition hover:bg-gray-50">
                          <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{r.risk_id ?? "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-600">{r.department ?? "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-600">{r.category ?? "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-600">{r.owner ?? "—"}</td>
                          <td className="max-w-xs truncate px-4 py-3 text-gray-600" title={r.risk_description ?? "—"}>
                            {r.risk_description ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEdit(r)}
                                className="rounded-lg border border-calpoly-green bg-white px-3 py-2 text-sm font-medium text-calpoly-green transition hover:bg-calpoly-green/5"
                              >
                                View / Edit
                              </button>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setOpenMenuFor(rowKey === openMenuFor ? null : rowKey)}
                                  className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-2 text-gray-600 transition hover:bg-gray-50"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                                {openMenuFor === rowKey && (
                                  <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                                    <button
                                      type="button"
                                      onClick={() => { openRejectDialog(risk); setOpenMenuFor(null); }}
                                      className="flex w-full items-center px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                                    >
                                      Reject
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { openDeleteDialog(risk); setOpenMenuFor(null); }}
                                      disabled={deletingId === risk.id}
                                      className="flex w-full items-center px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <RiskModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalRisk(null);
        }}
        risk={modalRisk}
        onSave={(saved) => {
          setModalRisk(saved);
          fetchAll();
        }}
        isAdminReview
        onApprove={modalRisk ? () => handleApprove(modalRisk) : undefined}
        onReject={
          modalRisk ? (reason) => handleReject(modalRisk, reason) : undefined
        }
      />

      {rejectDialogRisk && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => {
              if (rejectingId) return;
              setRejectDialogRisk(null);
            }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-calpoly-green">Reject risk</h3>
              <p className="mt-2 text-sm text-gray-600">
                Add an optional reason for rejecting this risk.
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                placeholder="Reason (optional)"
                className="mt-3 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectDialogRisk(null)}
                  disabled={Boolean(rejectingId)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleReject(rejectDialogRisk, rejectReason)}
                  disabled={Boolean(rejectingId)}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
                >
                  {rejectingId ? "Rejecting…" : "Confirm reject"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {deleteDialogRisk && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => {
              if (deletingId) return;
              setDeleteDialogRisk(null);
            }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-red-700">Delete risk</h3>
              <p className="mt-2 text-sm text-gray-600">
                Delete this risk permanently? This action cannot be undone.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteDialogRisk(null)}
                  disabled={Boolean(deletingId)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(deleteDialogRisk)}
                  disabled={Boolean(deletingId)}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingId ? "Deleting…" : "Confirm delete"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}