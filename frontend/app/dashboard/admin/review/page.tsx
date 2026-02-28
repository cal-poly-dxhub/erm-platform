"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Clock, CheckCircle, XCircle } from "lucide-react";
import RiskModal from "@/components/RiskModal";
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
    fetchAll();
  }, [fetchAll]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 text-gray-800">
      <div className="container mx-auto px-4 py-8 md:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-widest text-calpoly-gold">
              ADMIN
            </p>
            <h1 className="text-4xl font-bold text-calpoly-green">
              Risk Review
            </h1>
            <p className="mt-2 text-gray-600">
              Review pending risks, view rejected with reasons, and manage
              approved risks.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={fetchAll}
              disabled={loading}
              className="inline-flex items-center rounded-lg bg-calpoly-green px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
            >
              Refresh data
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

        {!loading && (
          <section className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-calpoly-gold/40 bg-calpoly-gold/10 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-calpoly-gold" />
                <div>
                  <p className="text-sm font-semibold text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-calpoly-green">
                    {pendingRisks.length}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-calpoly-green/40 bg-calpoly-green/10 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-calpoly-green" />
                <div>
                  <p className="text-sm font-semibold text-gray-600">
                    Approved
                  </p>
                  <p className="text-2xl font-bold text-calpoly-green">
                    {approvedRisks.length}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50/80 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-sm font-semibold text-gray-600">
                    Rejected
                  </p>
                  <p className="text-2xl font-bold text-red-700">
                    {rejectedRisks.length}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 1. Pending — no rejection reason column */}
        <section className="mt-8 rounded-2xl border border-calpoly-gold/30 bg-white/80 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-calpoly-green mb-4">
            Pending
          </h2>
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : pendingRisks.length === 0 ? (
            <p className="text-gray-500">No pending risks.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-calpoly-green uppercase">
                      ID
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-calpoly-green uppercase">
                      Department
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-calpoly-green uppercase">
                      Category
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-calpoly-green uppercase">
                      Owner
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-calpoly-green uppercase">
                      Description
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-calpoly-green uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pendingRisks.map((r, idx) => {
                    const risk = apiRiskToRisk(r);
                    return (
                      <tr key={r.risk_id ?? r.id ?? idx} className="bg-white">
                        <td className="px-3 py-2 text-sm text-gray-800">
                          {r.risk_id ?? "--"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600">
                          {r.department ?? "--"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600">
                          {r.category ?? "--"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600">
                          {r.owner ?? "--"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600 max-w-xs truncate">
                          {r.risk_description ?? "--"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(r)}
                              className="rounded bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-300"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApprove(risk)}
                              className="rounded bg-calpoly-green px-2 py-1 text-xs font-semibold text-white hover:opacity-90"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => openRejectDialog(risk)}
                              disabled={rejectingId === risk.id}
                              className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteDialog(risk)}
                              disabled={deletingId === risk.id}
                              className="rounded border border-red-400 bg-white px-2 py-1 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 2. Rejected — with rejection reason */}
        <section className="mt-8 rounded-2xl border border-red-200 bg-red-50/30 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-calpoly-green mb-4">
            Rejected
          </h2>
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : rejectedRisks.length === 0 ? (
            <p className="text-gray-500">No rejected risks.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-calpoly-green uppercase">
                      ID
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-calpoly-green uppercase">
                      Department
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-calpoly-green uppercase">
                      Category
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-calpoly-green uppercase">
                      Owner
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-calpoly-green uppercase">
                      Description
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-calpoly-green uppercase">
                      Rejection reason
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-calpoly-green uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rejectedRisks.map((r, idx) => {
                    const risk = apiRiskToRisk(r);
                    return (
                      <tr key={r.risk_id ?? r.id ?? idx} className="bg-white">
                        <td className="px-3 py-2 text-sm text-gray-800">
                          {r.risk_id ?? "--"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600">
                          {r.department ?? "--"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600">
                          {r.category ?? "--"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600">
                          {r.owner ?? "--"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600 max-w-xs truncate">
                          {r.risk_description ?? "--"}
                        </td>
                        <td
                          className="px-3 py-2 text-sm text-red-700 max-w-xs whitespace-normal"
                          title={
                            getRejectionReason(r) !== "--"
                              ? getRejectionReason(r)
                              : undefined
                          }
                        >
                          {getRejectionReason(r)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(r)}
                              className="rounded bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-300"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApprove(risk)}
                              className="rounded bg-calpoly-green px-2 py-1 text-xs font-semibold text-white hover:opacity-90"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteDialog(risk)}
                              disabled={deletingId === risk.id}
                              className="rounded border border-red-400 bg-white px-2 py-1 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 3. Approved */}
        <section className="mt-8 rounded-2xl border border-calpoly-green/30 bg-white/80 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-calpoly-green mb-4">
            Approved
          </h2>
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : approvedRisks.length === 0 ? (
            <p className="text-gray-500">No approved risks yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-calpoly-green uppercase">
                      ID
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-calpoly-green uppercase">
                      Department
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-calpoly-green uppercase">
                      Category
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-calpoly-green uppercase">
                      Owner
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-calpoly-green uppercase">
                      Description
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-calpoly-green uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {approvedRisks.map((r, idx) => {
                    const risk = apiRiskToRisk(r);
                    return (
                    <tr key={r.risk_id ?? r.id ?? idx} className="bg-white">
                      <td className="px-3 py-2 text-sm text-gray-800">
                        {r.risk_id ?? "--"}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {r.department ?? "--"}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {r.category ?? "--"}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {r.owner ?? "--"}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600 max-w-xs truncate">
                        {r.risk_description ?? "--"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            className="rounded bg-calpoly-green/90 px-2 py-1 text-xs font-semibold text-white hover:opacity-90"
                          >
                            View / Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteDialog(risk)}
                            disabled={deletingId === risk.id}
                            className="rounded border border-red-400 bg-white px-2 py-1 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </section>
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
            <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold text-calpoly-green">
                Reject Risk
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Add an optional reason for rejecting this risk.
              </p>
              <textarea
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                rows={4}
                placeholder="Reason (optional)"
                className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectDialogRisk(null)}
                  disabled={Boolean(rejectingId)}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleReject(rejectDialogRisk, rejectReason)}
                  disabled={Boolean(rejectingId)}
                  className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {rejectingId ? "Rejecting..." : "Confirm Reject"}
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
            <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold text-red-700">Delete Risk</h3>
              <p className="mt-2 text-sm text-gray-600">
                Delete this risk permanently? This action cannot be undone.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteDialogRisk(null)}
                  disabled={Boolean(deletingId)}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(deleteDialogRisk)}
                  disabled={Boolean(deletingId)}
                  className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingId ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}