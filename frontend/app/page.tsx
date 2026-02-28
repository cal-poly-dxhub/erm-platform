"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { LayoutGrid, RefreshCw, PlusCircle } from "lucide-react";
import RiskList from "@/components/RiskList";
import RiskModal from "@/components/RiskModal";
import GapAnalysis from "@/components/GapAnalysis";
import type { GapRiskPrefill } from "@/components/GapAnalysis";
import { Risk } from "@/types";

type ApiRisk = {
  id?: number | string | null;
  risk_id?: string | null;
  unit?: string | null;
  college_unit?: string | null;
  department?: string | null;
  owner?: string | null;
  risk_description?: string | null;
  risk_analysis?: string | null;
  current_controls?: string | null;
  baseline_likelihood?: string | number | null;
  baseline_impact?: string | number | null;
  mitigation_strategies?: string | null;
  updated_likelihood?: string | number | null;
  updated_impact?: string | number | null;
  status?: string | null;
  status_poc?: string | null;
  category?: string | null;
  resources_needed?: string | null;
  leadership_comments?: string | null;
  erm_comments?: string | null;
  approval_status?: "pending" | "approved" | "rejected" | null;
  rejection_reason?: string | null;
  risk_creation_at?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  updated_at?: string | null;
  actioned_at?: string | null;
};

const API_URL = "/api/erm-dashboard-results";

const COLLEGE_VALUES = new Set(["cafes", "caed", "ocob", "ceng", "cla", "bcsm", "cpace"]);
const UNIT_VALUES = new Set([
  "academic_affairs", "admin_finance", "student_affairs", "diversity", "research",
  "its", "facilities", "public_safety", "partners", "advancement", "marketing",
]);

const toEpoch = (value: unknown): number => {
  if (typeof value !== "string" || !value.trim()) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
};

const toNumericId = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : Number.NEGATIVE_INFINITY;
};

const newestFirst = (a: ApiRisk, b: ApiRisk): number => {
  const dateA = Math.max(
    toEpoch(a.risk_creation_at),
    toEpoch(a.created_at),
    toEpoch(a.createdAt),
    toEpoch(a.updated_at),
    toEpoch(a.actioned_at)
  );
  const dateB = Math.max(
    toEpoch(b.risk_creation_at),
    toEpoch(b.created_at),
    toEpoch(b.createdAt),
    toEpoch(b.updated_at),
    toEpoch(b.actioned_at)
  );
  if (dateA !== dateB) return dateB - dateA;

  const idA = toNumericId(a.id ?? a.risk_id);
  const idB = toNumericId(b.id ?? b.risk_id);
  return idB - idA;
};

const mapApiRiskToRisk = (api: ApiRisk): Risk => {
  const id = api.id != null ? String(api.id) : String(api.risk_id ?? "");
  const rawUnit = (api.unit ?? api.college_unit ?? "").toString().trim();
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
    statusPoc: api.status_poc ?? undefined,
    riskCategory: api.category ?? undefined,
    resourcesNeeded: api.resources_needed ?? undefined,
    leadershipComments: api.leadership_comments ?? undefined,
    ermComments: api.erm_comments ?? undefined,
    approvalStatus:
      api.approval_status === "approved" ||
      api.approval_status === "pending" ||
      api.approval_status === "rejected"
        ? api.approval_status
        : undefined,
    rejectionReason: api.rejection_reason ?? undefined,
  };
};

export default function Home() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [currentView, setCurrentView] = useState<"register" | "gap">(
    "register",
  );
  const [registerMode, setRegisterMode] = useState<"cards" | "table">("cards");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
  const [deleteRiskId, setDeleteRiskId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const openedFromQueryRef = useRef(false);

  const fetchRisks = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ limit: 500 }),
      });

      if (response.status === 401) {
        window.location.href = "/login?returnTo=/";
        return;
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data?.error || `Failed to load risks (${response.status})`);
        setRisks([]);
        return;
      }

      const normalized =
        data && typeof data.body === "string" ? JSON.parse(data.body) : data;
      const results = Array.isArray(normalized?.results)
        ? normalized.results
        : Array.isArray(normalized)
          ? normalized
          : [];
      const sortedResults = [...results].sort((a: ApiRisk, b: ApiRisk) => newestFirst(a, b));
      setRisks(sortedResults.map((risk: ApiRisk) => mapApiRiskToRisk(risk)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load risks");
      setRisks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRisks();
  }, []);

  // Sync view with URL hash (#register | #gap) on load/hash change
  useEffect(() => {
    if (typeof window === "undefined") return;

    const applyFromHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "gap") {
        setCurrentView("gap");
      } else {
        setCurrentView("register");
      }
      if (hash === "submit") {
        setEditingRisk({ id: "new" } as Risk);
        setIsModalOpen(true);
      }
    };

    applyFromHash();
    window.addEventListener("hashchange", applyFromHash);
    return () => window.removeEventListener("hashchange", applyFromHash);
  }, []);

  // Always open "Submit Risk" modal when sidebar dispatches an event
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      setCurrentView("register");
      setEditingRisk({ id: "new" } as Risk);
      setIsModalOpen(true);
    };
    window.addEventListener("openSubmitRisk", handler as EventListener);
    return () =>
      window.removeEventListener("openSubmitRisk", handler as EventListener);
  }, []);

  // Switch to Gap Analysis when sidebar link is clicked (same-page)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setCurrentView("gap");
    window.addEventListener("openGapAnalysis", handler as EventListener);
    return () =>
      window.removeEventListener("openGapAnalysis", handler as EventListener);
  }, []);

  const handleSaveRisk = (_riskData: Risk) => {
    setEditingRisk(null);
    void fetchRisks();
  };

  const handleEditRisk = (id: string) => {
    const risk = risks.find((r) => r.id === id);
    setEditingRisk(risk ?? null);
    setIsModalOpen(true);
  };

  const handleDeleteRisk = (id: string) => {
    setDeleteRiskId(id);
  };

  const confirmDeleteRisk = () => {
    if (!deleteRiskId) return;
    const numericId = Number(deleteRiskId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      setMessage("This risk is missing a valid database ID and cannot be deleted.");
      setDeleteRiskId(null);
      return;
    }
    void (async () => {
      try {
        const response = await fetch("/api/admin/delete-risk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: numericId }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const detail =
            typeof data?.upstreamBody === "string" && data.upstreamBody.trim()
              ? ` ${data.upstreamBody}`
              : "";
          setMessage((data?.error || `Delete failed (${response.status})`) + detail);
          return;
        }
        setDeleteRiskId(null);
        await fetchRisks();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to delete risk");
      }
    })();
  };

  const handleAddNew = () => {
    setEditingRisk(null);
    setIsModalOpen(true);
  };

  const handleOpenAddRiskFromGap = (prefill: GapRiskPrefill) => {
    const risk: Risk = {
      id: "new",
      orgType: prefill.orgType,
      college: prefill.college,
      unit: prefill.unit,
      collegeUnit: prefill.collegeUnit,
      department: prefill.department,
      risk: prefill.risk,
      riskAnalysis: prefill.riskAnalysis,
    };
    setEditingRisk(risk);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRisk(null);
  };

  const uniqueStatuses = useMemo(
    () =>
      Array.from(
        new Set(
          risks
            .map((r) => r.status)
            .filter((s): s is string => Boolean(s && s.trim())),
        ),
      ).sort(),
    [risks],
  );

  const uniqueUnits = useMemo(
    () =>
      Array.from(
        new Set(
          risks
            .map((r) => r.collegeUnit)
            .filter((u): u is string => Boolean(u && u.trim())),
        ),
      ).sort(),
    [risks],
  );

  const filteredRisks = useMemo(() => {
    return risks.filter((risk) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const haystack = [
          risk.riskIdNo,
          risk.risk,
          risk.riskAnalysis,
          risk.owner,
          risk.department,
          risk.collegeUnit,
          risk.riskCategory,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter && (risk.status || "").trim() !== statusFilter) {
        return false;
      }
      if (unitFilter && (risk.collegeUnit || "").trim() !== unitFilter) {
        return false;
      }
      return true;
    });
  }, [risks, searchQuery, statusFilter, unitFilter]);

  const handleModeChange = (mode: "cards" | "table") => {
    setRegisterMode(mode);
  };

  const handleRefresh = () => {
    void fetchRisks();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-calpoly-green">
            Risk Register
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            View, filter, and manage enterprise risks.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {currentView === "register" && (
            <div className="inline-flex rounded-lg bg-gray-100 p-1">
              {[
                { id: "cards", label: "Cards" },
                { id: "table", label: "Table" },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleModeChange(id as "cards" | "table")}
                  className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    registerMode === id
                      ? "bg-white text-calpoly-green shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {message}
        </div>
      )}
      {loading && (
        <div className="rounded-lg bg-white px-4 py-3 text-sm text-gray-600">
          Loading risks...
        </div>
      )}

      {currentView === "register" && (
        <>
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by ID, description, owner, department..."
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
              </div>
              <div className="flex flex-wrap gap-2 md:ml-4">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                >
                  <option value="">All Statuses</option>
                  {uniqueStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <select
                  value={unitFilter}
                  onChange={(e) => setUnitFilter(e.target.value)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                >
                  <option value="">All Units</option>
                  {uniqueUnits.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {registerMode === "cards" ? (
            <RiskList
              risks={filteredRisks}
              onEdit={handleEditRisk}
              onDelete={handleDeleteRisk}
            />
          ) : (
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-gray-700">
                  <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">Unit</th>
                      <th className="px-3 py-2">Owner</th>
                      <th className="px-3 py-2">Risk</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Approval</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRisks.map((risk) => (
                      <tr key={risk.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {risk.riskIdNo || "—"}
                        </td>
                        <td className="px-3 py-2">
                          {risk.collegeUnit || "—"}
                        </td>
                        <td className="px-3 py-2">{risk.owner || "—"}</td>
                        <td className="px-3 py-2 max-w-xs truncate">
                          {risk.risk || "Untitled Risk"}
                        </td>
                        <td className="px-3 py-2">{risk.status || "Not Set"}</td>
                        <td className="px-3 py-2">
                          {(risk.approvalStatus || "pending")
                            .charAt(0)
                            .toUpperCase() +
                            (risk.approvalStatus || "pending").slice(1)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs">
                          <button
                            type="button"
                            onClick={() => handleEditRisk(risk.id)}
                            className="rounded border border-gray-300 px-2 py-1 text-xs font-semibold text-calpoly-green hover:bg-gray-50"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredRisks.length === 0 && !loading && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-3 py-4 text-center text-sm text-gray-500"
                        >
                          No risks match your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {currentView === "gap" && (
        <GapAnalysis onOpenAddRisk={handleOpenAddRiskFromGap} />
      )}

      <RiskModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        risk={editingRisk}
        onSave={handleSaveRisk}
      />

      <button
        type="button"
        onClick={handleAddNew}
        className="fixed bottom-8 right-8 z-30 flex items-center gap-2 rounded-full bg-calpoly-gold px-5 py-3 text-sm font-semibold text-calpoly-green shadow-lg transition hover:opacity-95"
        aria-label="Add new risk"
      >
        <PlusCircle className="h-5 w-5" />
        Add New Risk
      </button>

      {deleteRiskId && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40"
              onClick={() => setDeleteRiskId(null)}
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
                    onClick={() => setDeleteRiskId(null)}
                    className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteRisk}
                    className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </div>
          </>
      )}
    </div>
  );
}
