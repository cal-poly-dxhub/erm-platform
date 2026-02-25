"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import RiskList from "@/components/RiskList";
import RiskModal from "@/components/RiskModal";
import HeatMap from "@/components/HeatMap";
import Analytics from "@/components/Analytics";
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
  const [currentView, setCurrentView] = useState<
    "list" | "map" | "analytics" | "gap"
  >("list");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
  const [deleteRiskId, setDeleteRiskId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  const updateViewButtons = (
    activeView: "list" | "map" | "analytics" | "gap",
  ) => {
    const views: Array<"list" | "map" | "analytics" | "gap"> = [
      "list",
      "map",
      "analytics",
      "gap",
    ];
    const buttonIds: Record<"list" | "map" | "analytics" | "gap", string> = {
      list: "btn-list-view",
      map: "btn-map-view",
      analytics: "btn-analytics-view",
      gap: "btn-gap-view",
    };

    views.forEach((view) => {
      const btn = document.getElementById(buttonIds[view]);
      if (btn) {
        const isActive = view === activeView;
        btn.classList.toggle("bg-white", isActive);
        btn.classList.toggle("shadow", isActive);
        btn.classList.toggle("text-gray-600", !isActive);
      }
    });
  };

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

    const handleViewChange = (event: Event) => {
      const e = event as CustomEvent<"list" | "map" | "analytics" | "gap">;
      setCurrentView(e.detail);
      setTimeout(() => updateViewButtons(e.detail), 0);
    };

    window.addEventListener("viewChange", handleViewChange as EventListener);
    setTimeout(() => updateViewButtons("list"), 0);

    return () => {
      window.removeEventListener("viewChange", handleViewChange as EventListener);
    };
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

  return (
    <div className="bg-gray-100 text-gray-800">
      <div className="container mx-auto p-4 md:p-8">
        <Header onAddNew={handleAddNew} onRefresh={() => void fetchRisks()} isRefreshing={loading} />

        {message && (
          <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {message}
          </section>
        )}
        {loading && (
          <section className="mb-6 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
            Loading risks...
          </section>
        )}

        {currentView === "list" && (
          <RiskList
            risks={risks}
            onEdit={handleEditRisk}
            onDelete={handleDeleteRisk}
          />
        )}

        {currentView === "map" && (
          <HeatMap risks={risks} onEdit={handleEditRisk} />
        )}

        {currentView === "analytics" && <Analytics risks={risks} />}
        {currentView === "gap" && (
          <GapAnalysis onOpenAddRisk={handleOpenAddRiskFromGap} />
        )}

        <RiskModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          risk={editingRisk}
          onSave={handleSaveRisk}
        />

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
    </div>
  );
}
