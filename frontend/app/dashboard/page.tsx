"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Risk } from "@/types";
import HeatMap from "@/components/HeatMap";
import {
  AlertTriangle,
  ArrowDownUp,
  ClipboardCheck,
  Download,
  RefreshCw,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";

type ApiRisk = {
  id?: string | number | null;
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
  baseline_risk_rating: string | number | null;
  mitigation_strategies: string | null;
  updated_likelihood: string | number | null;
  updated_impact: string | number | null;
  residual_risk_rating: string | number | null;
  status: string | null;
  internal_resources?: string | number | null;
  external_resources?: string | null;
  funding_required?: string | number | null;
  risk_tolerance?: string | null;
  risk_visibility?: string | null;
  risk_creation_at?: string | null;
  actioned_by?: string | null;
  actioned_at?: string | null;
  is_college_wide?: boolean | string | null;
  status_poc?: string | null;
  is_private?: boolean | string | null;
  is_attorney_client_privilege?: boolean | string | null;
  erm_comments?: string | null;
  ehs_comments?: string | null;
  leadership_comments?: string | null;
  status_tolerance?: string | null;
  resources_needed: string | null;
  additional_comments: string | null;
  approval_status?: "pending" | "approved" | "rejected" | null;
  rejection_reason?: string | null;
  [key: string]: string | number | boolean | null | undefined;
};

type FilterState = {
  department: string;
  category: string;
  status: string;
  owner: string;
  unit: string;
};

type AuthUser = {
  sub: string;
  email?: string;
  name?: string;
  username?: string;
  groups: string[];
};

const API_URL = "/api/erm-dashboard-results";

const HIGH_RISK_THRESHOLD = 15;

const toNumber = (value: string | number | null) => {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeKey = (value: string | null | undefined, fallback: string) =>
  value && value.trim() ? value.trim() : fallback;

const normalizeStatusLabel = (value: string | null | undefined) => {
  const raw = value ?? "";
  const compact = raw
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (!compact) {
    return "Unspecified";
  }

  const lower = compact.toLowerCase();
  return lower.replace(/\b\w/g, (ch) => ch.toUpperCase());
};

const groupCounts = (items: ApiRisk[], keyFn: (risk: ApiRisk) => string) => {
  const counts = new Map<string, number>();
  items.forEach((risk) => {
    const key = keyFn(risk);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
};

const buildBins = (values: number[]) => {
  const bins = [
    { label: "0-5", min: 0, max: 5 },
    { label: "6-10", min: 6, max: 10 },
    { label: "11-15", min: 11, max: 15 },
    { label: "16-20", min: 16, max: 20 },
    { label: "21+", min: 21, max: Infinity },
  ];
  return bins.map((bin) => ({
    label: bin.label,
    count: values.filter((value) => value >= bin.min && value <= bin.max)
      .length,
  }));
};

const BOARD_LANES = [
  { key: "identified", label: "Identified" },
  { key: "assessing", label: "Assessing" },
  { key: "mitigating", label: "Mitigating" },
  { key: "monitoring", label: "Monitoring" },
  { key: "closed", label: "Closed/Resolved" },
] as const;

type BoardLaneKey = (typeof BOARD_LANES)[number]["key"];

const mapStatusToLane = (status: string | null): BoardLaneKey => {
  const normalized = (status || "").trim().toLowerCase();
  if (!normalized) return "identified";
  if (normalized.includes("closed") || normalized.includes("resolved")) {
    return "closed";
  }
  if (
    normalized.includes("monitor") ||
    normalized.includes("accept") ||
    normalized.includes("watch")
  ) {
    return "monitoring";
  }
  if (
    normalized.includes("mitig") ||
    normalized.includes("control") ||
    normalized.includes("treat")
  ) {
    return "mitigating";
  }
  if (
    normalized.includes("assess") ||
    normalized.includes("analysis") ||
    normalized.includes("review")
  ) {
    return "assessing";
  }
  if (normalized.includes("ident") || normalized.includes("new")) {
    return "identified";
  }
  return "assessing";
};

const getRiskKey = (risk: ApiRisk) => {
  const numericId = risk.id;
  return String(
    risk.risk_id ||
      numericId ||
      `${risk.unit || "unit"}:${risk.owner || "owner"}:${risk.risk_description || "risk"}:${risk.residual_risk_rating ?? "na"}`,
  );
};

const getResidualTone = (score: number | null) => {
  if (score === null) return "bg-gray-100 text-gray-700";
  if (score >= HIGH_RISK_THRESHOLD) return "bg-red-100 text-red-700";
  if (score >= 11) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
};

const formatCellValue = (
  value: string | number | boolean | null | undefined,
) => {
  if (value === null || value === undefined) return "--";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : "--";
  }
  return value;
};

const formatFieldLabel = (key: string) =>
  key
    .split("_")
    .map((part) =>
      part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part,
    )
    .join(" ");

const DETAIL_FIELDS = [
  "risk_id",
  "unit",
  "department",
  "owner",
  "risk_description",
  "risk_analysis",
  "category",
  "current_controls",
  "baseline_likelihood",
  "baseline_impact",
  "baseline_risk_rating",
  "mitigation_strategies",
  "updated_likelihood",
  "updated_impact",
  "residual_risk_rating",
  "status",
  "internal_resources",
  "external_resources",
  "funding_required",
  "risk_tolerance",
  "risk_visibility",
  "risk_creation_at",
  "approval_status",
  "actioned_by",
  "actioned_at",
  "rejection_reason",
  "is_college_wide",
  "status_poc",
  "is_private",
  "is_attorney_client_privilege",
  "erm_comments",
  "ehs_comments",
  "leadership_comments",
  "status_tolerance",
] as const;

const LONG_TEXT_DETAIL_FIELDS = new Set<string>([
  "risk_description",
  "risk_analysis",
  "current_controls",
  "mitigation_strategies",
  "erm_comments",
  "ehs_comments",
  "leadership_comments",
  "rejection_reason",
]);

const DATE_DETAIL_FIELDS = new Set<string>(["risk_creation_at", "actioned_at"]);

const mapApiToRiskForMatrix = (risk: ApiRisk): Risk => ({
  id: String(risk.id ?? risk.risk_id ?? ""),
  riskIdNo: risk.risk_id ?? undefined,
  collegeUnit: risk.unit ?? undefined,
  department: risk.department ?? undefined,
  owner: risk.owner ?? undefined,
  risk: risk.risk_description ?? undefined,
  riskAnalysis: risk.risk_analysis ?? undefined,
  likelihood:
    risk.baseline_likelihood != null
      ? String(risk.baseline_likelihood)
      : undefined,
  impact:
    risk.baseline_impact != null ? String(risk.baseline_impact) : undefined,
  updatedLikelihood:
    risk.updated_likelihood != null
      ? String(risk.updated_likelihood)
      : undefined,
  updatedImpact:
    risk.updated_impact != null ? String(risk.updated_impact) : undefined,
  approvalStatus: risk.approval_status ?? undefined,
});

const DONUT_COLORS = [
  "#154734",
  "#8B7355",
  "#C69214",
  "#0D9488",
  "#059669",
  "#475569",
  "#6366f1",
  "#b45309",
  "#0e7490",
  "#4f46e5",
];

function CategoryDonutChart({
  categoryCounts,
  selectedCategory,
  onSelectCategory,
}: {
  categoryCounts: [string, number][];
  selectedCategory: string | null;
  onSelectCategory: (category: string) => void;
}) {
  const total = categoryCounts.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) return null;
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 72;
  const rInner = 40;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  let startAngle = 0;
  return (
    <div className="aspect-square h-56 shrink-0 sm:h-64" style={{ maxWidth: "min(100%, 16rem)" }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        aria-label="Risk category distribution"
      >
        {categoryCounts.map(([category, count], i) => {
          const span = Math.min((count / total) * 360, 359.99);
          const endAngle = startAngle + span;
          const x1o = cx + rOuter * Math.cos(toRad(startAngle));
          const y1o = cy - rOuter * Math.sin(toRad(startAngle));
          const x2o = cx + rOuter * Math.cos(toRad(endAngle));
          const y2o = cy - rOuter * Math.sin(toRad(endAngle));
          const x1i = cx + rInner * Math.cos(toRad(startAngle));
          const y1i = cy - rInner * Math.sin(toRad(startAngle));
          const x2i = cx + rInner * Math.cos(toRad(endAngle));
          const y2i = cy - rInner * Math.sin(toRad(endAngle));
          const largeArc = span > 180 ? 1 : 0;
          const pathD = `M ${x1o} ${y1o} A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${x2o} ${y2o} L ${x2i} ${y2i} A ${rInner} ${rInner} 0 ${largeArc} 1 ${x1i} ${y1i} Z`;
          const color = DONUT_COLORS[i % DONUT_COLORS.length];
          const isSelected = selectedCategory === category;
          startAngle = endAngle;
          return (
            <path
              key={category}
              d={pathD}
              fill={color}
              stroke="white"
              strokeWidth={2}
              className="cursor-pointer transition hover:opacity-90"
              style={{
                opacity: isSelected ? 1 : 0.92,
                filter: isSelected ? "drop-shadow(0 1px 2px rgba(0,0,0,0.1))" : undefined,
              }}
              onClick={() => onSelectCategory(category)}
              onKeyDown={(e) => e.key === "Enter" && onSelectCategory(category)}
              role="button"
              tabIndex={0}
              aria-label={`${category}: ${count} risks`}
            />
          );
        })}
      </svg>
    </div>
  );
}

function CategoryLegend({
  categoryCounts,
  selectedCategory,
  onSelectCategory,
}: {
  categoryCounts: [string, number][];
  selectedCategory: string | null;
  onSelectCategory: (category: string) => void;
}) {
  return (
    <ul className="space-y-2.5" role="list">
      {categoryCounts.map(([category, count], i) => {
        const color = DONUT_COLORS[i % DONUT_COLORS.length];
        const isSelected = selectedCategory === category;
        return (
          <li key={category}>
            <button
              type="button"
              onClick={() => onSelectCategory(category)}
              className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                isSelected ? "bg-gray-100" : "hover:bg-gray-50"
              }`}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="flex-1 font-medium text-gray-800">{category}</span>
              <span className="shrink-0 text-gray-500">({count})</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function DashboardPage() {
  const [risks, setRisks] = useState<ApiRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [limit, setLimit] = useState(75);
  const [semanticQuery, setSemanticQuery] = useState("");
  const [selectedRiskKey, setSelectedRiskKey] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    department: "",
    category: "",
    status: "",
    owner: "",
    unit: "",
  });
  type DashboardTabId = "overview" | "workflow" | "analysis" | "unit" | "category" | "matrix";
  const [activeTab, setActiveTab] = useState<DashboardTabId>("overview");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const approvedRisks = useMemo(
    () => risks.filter((r) => r.approval_status === "approved"),
    [risks],
  );

  const matrixRisks = useMemo(
    () => approvedRisks.map(mapApiToRiskForMatrix),
    [approvedRisks],
  );

  const fetchRisks = async (
    nextFilters = filters,
    nextLimit = limit,
    nextSemanticQuery = semanticQuery,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const payloadFilters = Object.fromEntries(
        Object.entries(nextFilters).filter(([, value]) => value.trim()),
      );
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semantic_query: nextSemanticQuery.trim() || undefined,
          filters: payloadFilters,
          limit: nextLimit,
        }),
      });
      if (response.status === 401) {
        window.location.href = "/login?returnTo=/dashboard";
        return;
      }
      if (response.status === 403) {
        let detail = "";
        try {
          const text = await response.text();
          if (text) {
            try {
              const parsed = JSON.parse(text);
              detail =
                parsed?.error ||
                parsed?.message ||
                parsed?.error_description ||
                "";
            } catch {
              detail = text;
            }
          }
        } catch {
          // ignore parse errors and fall back to generic detail
        }
        throw new Error(
          detail
            ? `Dashboard API returned 403: ${detail}`
            : "Dashboard API returned 403 (forbidden).",
        );
      }
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      const data = await response.json();
      const normalized =
        data && typeof data.body === "string" ? JSON.parse(data.body) : data;
      setRisks(Array.isArray(normalized?.results) ? normalized.results : []);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load dashboard data.",
      );
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = async () => {
    const payloadFilters = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value.trim()),
    );
    const exportFilters = { ...payloadFilters, approval_status: "approved" };
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          export_format: "csv",
          filters: exportFilters,
          limit: 1000,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || `Export failed: ${response.status}`);
      }
      const raw = await response.text();
      let csvText = raw;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.body === "string") csvText = parsed.body;
      } catch {
        // use raw as CSV
      }
      const blob = new Blob([csvText], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "erm-risks.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (response.status === 401) {
          window.location.href = "/login?returnTo=/dashboard";
          return;
        }
        if (response.status === 403) {
          setError("Signed in, but you do not have dashboard access.");
          setLoading(false);
          return;
        }
        if (!response.ok) {
          throw new Error(`Auth error: ${response.status}`);
        }

        const data = await response.json();
        setUser((data?.user as AuthUser | undefined) || null);
        await fetchRisks();
      } catch (authError) {
        setLoading(false);
        setError(
          authError instanceof Error
            ? authError.message
            : "Unable to verify session.",
        );
      } finally {
        setAuthLoading(false);
      }
    };

    initialize();
  }, []);

  const analytics = useMemo(() => {
    const residualValues = approvedRisks
      .map((risk) => toNumber(risk.residual_risk_rating))
      .filter((value): value is number => value !== null);
    const avgResidual =
      residualValues.length > 0
        ? (
            residualValues.reduce((sum, value) => sum + value, 0) /
            residualValues.length
          ).toFixed(1)
        : "0.0";
    const maxResidual = residualValues.length ? Math.max(...residualValues) : 0;
    const highResidualCount = residualValues.filter(
      (value) => value >= HIGH_RISK_THRESHOLD,
    ).length;
    const mediumResidualCount = residualValues.filter(
      (value) => value >= 6 && value < HIGH_RISK_THRESHOLD,
    ).length;

    const statusCounts = groupCounts(approvedRisks, (risk) =>
      normalizeStatusLabel(risk.status),
    ).slice(0, 5);
    const categoryCounts = groupCounts(approvedRisks, (risk) =>
      normalizeKey(risk.category, "Uncategorized"),
    ).slice(0, 6);
    const unitCounts = groupCounts(approvedRisks, (risk) =>
      normalizeKey(risk.unit, "Unassigned"),
    ).slice(0, 5);

    const bins = buildBins(residualValues);

    const topRisks = [...approvedRisks]
      .sort((a, b) => {
        const aScore = toNumber(a.residual_risk_rating) ?? -1;
        const bScore = toNumber(b.residual_risk_rating) ?? -1;
        return bScore - aScore;
      })
      .slice(0, 6);

    return {
      residualValues,
      avgResidual,
      maxResidual,
      highResidualCount,
      mediumResidualCount,
      statusCounts,
      categoryCounts,
      unitCounts,
      bins,
      topRisks,
    };
  }, [approvedRisks]);

  const categoryCountsForPie = useMemo(
    () =>
      groupCounts(approvedRisks, (risk) =>
        normalizeKey(risk.category, "Uncategorized"),
      ),
    [approvedRisks],
  );

  const risksInSelectedCategory = useMemo(() => {
    if (!selectedCategory) return [];
    return approvedRisks.filter(
      (risk) =>
        normalizeKey(risk.category, "Uncategorized") === selectedCategory,
    );
  }, [approvedRisks, selectedCategory]);

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const filterOptions = useMemo(() => {
    const getDistinctValues = (
      key: keyof Pick<
        ApiRisk,
        "department" | "category" | "status" | "owner" | "unit"
      >,
    ) => {
      const values = new Set<string>();
      approvedRisks.forEach((risk) => {
        const raw = risk[key];
        if (raw && raw.trim()) {
          values.add(raw.trim());
        }
      });
      return Array.from(values).sort((a, b) => a.localeCompare(b));
    };

    return {
      department: getDistinctValues("department"),
      category: getDistinctValues("category"),
      status: getDistinctValues("status"),
      owner: getDistinctValues("owner"),
      unit: getDistinctValues("unit"),
    };
  }, [approvedRisks]);

  const boardLanes = useMemo(() => {
    const initial = BOARD_LANES.reduce(
      (acc, lane) => ({ ...acc, [lane.key]: [] as ApiRisk[] }),
      {} as Record<BoardLaneKey, ApiRisk[]>,
    );

    approvedRisks.forEach((risk) => {
      initial[mapStatusToLane(risk.status)].push(risk);
    });

    BOARD_LANES.forEach((lane) => {
      initial[lane.key].sort((a, b) => {
        const aScore = toNumber(a.residual_risk_rating) ?? -1;
        const bScore = toNumber(b.residual_risk_rating) ?? -1;
        return bScore - aScore;
      });
    });

    return initial;
  }, [approvedRisks]);

  const selectedRisk = useMemo(() => {
    if (!selectedRiskKey) return null;
    return approvedRisks.find((risk) => getRiskKey(risk) === selectedRiskKey);
  }, [approvedRisks, selectedRiskKey]);

  const DASHBOARD_TABS: { id: DashboardTabId; label: string; description: string }[] = [
    { id: "overview", label: "Overview", description: "Key metrics and priority risks at a glance." },
    { id: "workflow", label: "Workflow Board", description: "Risks by stage: Identified → Assessing → Mitigating → Monitoring → Closed." },
    { id: "analysis", label: "Analysis", description: "Status mix, categories, residual spread, and unit distribution." },
    { id: "unit", label: "By Unit", description: "Counts of approved risks grouped by unit." },
    { id: "category", label: "By Category", description: "Counts of approved risks grouped by risk category." },
    { id: "matrix", label: "Risk Matrix", description: "Baseline likelihood and impact heatmap for approved risks." },
  ];

  useEffect(() => {
    if (approvedRisks.length === 0) {
      setSelectedRiskKey(null);
      return;
    }

    if (!selectedRiskKey) {
      setSelectedRiskKey(getRiskKey(approvedRisks[0]));
      return;
    }

    const exists = approvedRisks.some(
      (risk) => getRiskKey(risk) === selectedRiskKey,
    );
    if (!exists) {
      setSelectedRiskKey(getRiskKey(approvedRisks[0]));
    }
  }, [approvedRisks, selectedRiskKey]);

  const handleApplyFilters = () => {
    fetchRisks(filters, limit, semanticQuery);
  };

  const handleClearFilters = () => {
    const cleared = {
      department: "",
      category: "",
      status: "",
      owner: "",
      unit: "",
    };
    setFilters(cleared);
    setSemanticQuery("");
    fetchRisks(cleared, limit, "");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-calpoly-gold">
            Enterprise Risk Management
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-calpoly-green">
            ERM Results Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Residual risk exposure, ownership, and mitigation priorities.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fetchRisks()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-calpoly-green">Filters</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Filter results by unit, department, category, status, or owner. Applies to all tabs.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <ArrowDownUp className="h-3.5 w-3.5 shrink-0" />
            <span>Limit</span>
            <input
              id="filter-limit"
              type="number"
              min={10}
              max={250}
              value={limit}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next)) setLimit(10);
                else setLimit(Math.min(250, Math.max(10, next)));
              }}
              className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label htmlFor="filter-unit" className="block text-sm font-medium text-gray-700">
                Unit
              </label>
              <select
                id="filter-unit"
                value={filters.unit}
                onChange={(e) => updateFilter("unit", e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
              >
                <option value="">All units</option>
                {filterOptions.unit.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-department" className="block text-sm font-medium text-gray-700">
                Department
              </label>
              <select
                id="filter-department"
                value={filters.department}
                onChange={(e) => updateFilter("department", e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
              >
                <option value="">All departments</option>
                {filterOptions.department.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-category" className="block text-sm font-medium text-gray-700">
                Category
              </label>
              <select
                id="filter-category"
                value={filters.category}
                onChange={(e) => updateFilter("category", e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
              >
                <option value="">All categories</option>
                {filterOptions.category.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-status" className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                id="filter-status"
                value={filters.status}
                onChange={(e) => updateFilter("status", e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
              >
                <option value="">All statuses</option>
                {filterOptions.status.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-owner" className="block text-sm font-medium text-gray-700">
                Owner
              </label>
              <select
                id="filter-owner"
                value={filters.owner}
                onChange={(e) => updateFilter("owner", e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
              >
                <option value="">All owners</option>
                {filterOptions.owner.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="filter-search" className="block text-sm font-medium text-gray-700">
              Search
            </label>
            <input
              id="filter-search"
              type="text"
              value={semanticQuery}
              onChange={(e) => setSemanticQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
              placeholder="Search by risk description or analysis…"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
            />
          </div>

          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={handleApplyFilters}
              className="rounded-lg bg-calpoly-gold px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-calpoly-green bg-white px-4 py-2 text-sm font-medium text-calpoly-green shadow-sm transition hover:bg-calpoly-green/5"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex flex-wrap gap-4 text-sm">
          {DASHBOARD_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-1 pb-2 text-sm font-medium ${
                activeTab === tab.id
                  ? "border-calpoly-gold text-calpoly-green"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Active tab helper text */}
      {(() => {
        const current = DASHBOARD_TABS.find((tab) => tab.id === activeTab);
        return current ? (
          <p className="mt-2 text-xs text-gray-500">
            {current.description}
          </p>
        ) : null;
      })()}

      {/* Shared status/error messaging */}
      {!loading && error && (
        <section className="mt-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Unable to load data from the dashboard API. {error}
        </section>
      )}
      {authLoading && (
        <section className="mt-2 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
          Checking authentication...
        </section>
      )}

      {/* Overview tab — compact summary */}
      {activeTab === "overview" && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-gray-500">Total Risks</p>
              <p className="mt-2 text-3xl font-bold text-calpoly-green">
                {loading ? "--" : approvedRisks.length}
              </p>
              <p className="mt-1 text-xs text-gray-400">Approved records</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-gray-500">High Priority</p>
              <p className="mt-2 flex items-center text-3xl font-bold text-risk-high">
                <AlertTriangle className="mr-2 h-5 w-5" />
                {loading ? "--" : analytics.highResidualCount}
              </p>
              <p className="mt-1 text-xs text-gray-400">Rating {HIGH_RISK_THRESHOLD}+</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-gray-500">Medium Priority</p>
              <p className="mt-2 text-3xl font-bold text-amber-600">
                {loading ? "--" : analytics.mediumResidualCount}
              </p>
              <p className="mt-1 text-xs text-gray-400">Rating 6–14</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-gray-500">Avg Residual Score</p>
              <p className="mt-2 text-3xl font-bold text-calpoly-green">
                {loading ? "--" : analytics.avgResidual}
              </p>
              <p className="mt-1 text-xs text-gray-400">Max {loading ? "--" : analytics.maxResidual}</p>
            </div>
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-calpoly-green">Status Mix</h3>
              <div className="mt-3 space-y-2">
                {analytics.statusCounts.slice(0, 5).map(([status, count]) => {
                  const width = approvedRisks.length
                    ? Math.round((count / approvedRisks.length) * 100)
                    : 0;
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-sm text-gray-600">{status}</span>
                      <div className="min-w-0 flex-1">
                        <div className="h-2 rounded-full bg-gray-200">
                          <div
                            className="h-2 rounded-full bg-calpoly-green"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-8 text-right text-sm font-medium text-gray-700">{count}</span>
                    </div>
                  );
                })}
                {!loading && analytics.statusCounts.length === 0 && (
                  <p className="text-sm text-gray-500">No status data.</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-calpoly-green">Residual Spread</h3>
              <div className="mt-3 space-y-2">
                {analytics.bins.map((bin) => {
                  const width = approvedRisks.length
                    ? Math.round((bin.count / approvedRisks.length) * 100)
                    : 0;
                  return (
                    <div key={bin.label} className="flex items-center gap-3">
                      <span className="w-12 shrink-0 text-sm text-gray-600">{bin.label}</span>
                      <div className="min-w-0 flex-1">
                        <div className="h-2 rounded-full bg-gray-200">
                          <div
                            className="h-2 rounded-full bg-calpoly-gold"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-8 text-right text-sm font-medium text-gray-700">{bin.count}</span>
                    </div>
                  );
                })}
                {!loading && analytics.bins.length === 0 && (
                  <p className="text-sm text-gray-500">No rating data.</p>
                )}
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-calpoly-green">Priority Risks</h3>
              <button
                type="button"
                onClick={() => setActiveTab("workflow")}
                className="text-sm font-medium text-calpoly-gold hover:underline"
              >
                View Workflow Board →
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {analytics.topRisks.slice(0, 4).map((risk, index) => (
                <div
                  key={risk.risk_id || `risk-${index}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2"
                >
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                    {risk.risk_description || "Risk item"}
                  </p>
                  <span className="shrink-0 rounded-full bg-calpoly-gold/10 px-2 py-0.5 text-xs font-semibold text-calpoly-green">
                    {risk.residual_risk_rating ?? "--"}
                  </span>
                </div>
              ))}
              {!loading && analytics.topRisks.length === 0 && (
                <p className="text-sm text-gray-500">No risk records. Apply filters or refresh.</p>
              )}
            </div>
          </section>
        </>
      )}

      {/* Workflow Board tab */}
      {activeTab === "workflow" && (
        <>
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-calpoly-green">Risk Workflow Board</h3>
              {loading && (
                <span className="text-sm text-gray-500">Loading...</span>
              )}
            </div>
            <div className="mt-4 overflow-x-auto pb-2">
              <div className="grid min-w-[1120px] grid-cols-5 gap-4">
                {BOARD_LANES.map((lane) => (
                  <div
                    key={lane.key}
                    className="flex max-h-[65vh] min-h-[180px] flex-col rounded-xl border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="mb-3 flex shrink-0 items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-700">{lane.label}</h4>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-600">
                        {boardLanes[lane.key].length}
                      </span>
                    </div>
                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                      {boardLanes[lane.key].map((risk) => {
                        const riskKey = getRiskKey(risk);
                        const residual = toNumber(risk.residual_risk_rating);
                        return (
                          <button
                            key={riskKey}
                            type="button"
                            onClick={() => setSelectedRiskKey(riskKey)}
                            className={`w-full rounded-lg border bg-white p-2.5 text-left text-sm shadow-sm transition hover:border-calpoly-gold hover:shadow ${
                              selectedRiskKey === riskKey
                                ? "border-calpoly-gold ring-2 ring-calpoly-gold/30"
                                : "border-gray-200"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 flex-1 text-sm font-medium text-gray-800 line-clamp-2">
                                {risk.risk_description || "Risk item"}
                              </p>
                              <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${getResidualTone(residual)}`}>
                                {residual ?? "--"}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                              {normalizeKey(risk.owner, "—")} · {normalizeKey(risk.unit, "—")}
                            </p>
                          </button>
                        );
                      })}
                      {boardLanes[lane.key].length === 0 && (
                        <p className="rounded-lg border border-dashed border-gray-300 bg-white px-3 py-4 text-center text-xs text-gray-400">
                          No risks
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-calpoly-green">Risk Detail</h3>
            {!selectedRisk && !loading && (
              <p className="mt-3 text-sm text-gray-500">
                Select a risk from the board above to view details.
              </p>
            )}
            {selectedRisk && (
              <div className="mt-4">
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {DETAIL_FIELDS.map((field) => {
                      const rawValue = selectedRisk[field];
                      let displayValue = formatCellValue(rawValue);
                      if (DATE_DETAIL_FIELDS.has(field) && typeof rawValue === "string" && rawValue.trim()) {
                        const parsed = new Date(rawValue);
                        if (!Number.isNaN(parsed.getTime())) displayValue = parsed.toLocaleString();
                      }
                      return (
                        <div
                          key={field}
                          className={`rounded-lg bg-gray-50 p-3 ${LONG_TEXT_DETAIL_FIELDS.has(field) ? "sm:col-span-2 lg:col-span-4" : ""}`}
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            {formatFieldLabel(field)}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">
                            {displayValue}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* Analysis tab */}
      {activeTab === "analysis" && (
        <section className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-calpoly-green">Status Mix</h3>
              <p className="mt-1 text-xs text-gray-500">Distribution by status</p>
              <div className="mt-4 space-y-3">
                {analytics.statusCounts.map(([status, count]) => {
                  const width = approvedRisks.length
                    ? Math.round((count / approvedRisks.length) * 100)
                    : 0;
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>{status}</span>
                        <span>{count} ({width}%)</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-gray-200">
                        <div className="h-2 rounded-full bg-calpoly-green" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
                {!loading && analytics.statusCounts.length === 0 && (
                  <p className="text-sm text-gray-500">No status data.</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-calpoly-green">Residual Rating Spread</h3>
              <p className="mt-1 text-xs text-gray-500">Score distribution (0–5 to 21+)</p>
              <div className="mt-4 space-y-3">
                {analytics.bins.map((bin) => {
                  const width = approvedRisks.length
                    ? Math.round((bin.count / approvedRisks.length) * 100)
                    : 0;
                  return (
                    <div key={bin.label}>
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>{bin.label}</span>
                        <span>{bin.count} ({width}%)</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-gray-200">
                        <div className="h-2 rounded-full bg-calpoly-gold" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
                {!loading && analytics.bins.length === 0 && (
                  <p className="text-sm text-gray-500">No rating data.</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-calpoly-green">Category Concentration</h3>
              <p className="mt-1 text-xs text-gray-500">Top categories</p>
              <div className="mt-4 space-y-2">
                {analytics.categoryCounts.map(([category, count], index) => (
                  <div
                    key={`${category}-${index}`}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-gray-700">{category}</span>
                    <span className="text-sm font-semibold text-calpoly-green">{count}</span>
                  </div>
                ))}
                {!loading && analytics.categoryCounts.length === 0 && (
                  <p className="text-sm text-gray-500">No category data.</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-calpoly-green">Top Units</h3>
              <p className="mt-1 text-xs text-gray-500">Risk count by unit</p>
              <div className="mt-4 space-y-2">
                {analytics.unitCounts.map(([unit, count]) => (
                  <div
                    key={unit}
                    className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
                  >
                    <span className="text-sm text-gray-700">{unit}</span>
                    <span className="text-sm font-semibold text-calpoly-green">{count} risks</span>
                  </div>
                ))}
                {!loading && analytics.unitCounts.length === 0 && (
                  <p className="text-sm text-gray-500">No unit data.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* By Unit tab */}
      {activeTab === "unit" && (
        <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-calpoly-green">
            Risks by Unit
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Distribution of approved risks across units.
          </p>
          <div className="mt-4 space-y-3">
            {analytics.unitCounts.map(([unit, count]) => (
              <div
                key={unit}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
              >
                <span className="text-sm text-gray-700">{unit}</span>
                <span className="text-sm font-semibold text-calpoly-green">
                  {count} risks
                </span>
              </div>
            ))}
            {!loading && analytics.unitCounts.length === 0 && (
              <p className="text-sm text-gray-500">No unit data.</p>
            )}
          </div>
        </section>
      )}

      {/* By Category tab */}
      {activeTab === "category" && (
        <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">
            Risk Category Distribution
          </h3>
          <p className="mt-0.5 text-sm text-gray-500">
            Click a segment or legend item to see risks in that category.
          </p>

          {!loading && categoryCountsForPie.length === 0 && (
            <p className="mt-4 text-sm text-gray-500">No category data.</p>
          )}

          {categoryCountsForPie.length > 0 && (
            <>
              <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
                <div className="flex justify-center sm:justify-start">
                  <CategoryDonutChart
                    categoryCounts={categoryCountsForPie}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                  />
                </div>
                <div className="min-w-0 flex-1 sm:max-w-xs">
                  <CategoryLegend
                    categoryCounts={categoryCountsForPie}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                  />
                </div>
              </div>

              {selectedCategory && (
                <div className="mt-8 border-t border-gray-200 pt-6">
                  <h4 className="text-sm font-semibold text-calpoly-green">
                    Risks in “{selectedCategory}” ({risksInSelectedCategory.length})
                  </h4>
                  <div className="mt-3 space-y-2">
                    {risksInSelectedCategory.map((risk, index) => (
                      <div
                        key={risk.risk_id || `cat-risk-${index}`}
                        className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <p className="min-w-0 flex-1 text-sm font-medium text-gray-800">
                          {risk.risk_description || "Untitled risk"}
                        </p>
                        <div className="flex shrink-0 items-center gap-3 text-xs text-gray-600">
                          <span>{normalizeKey(risk.owner, "—")}</span>
                          <span className="rounded bg-white px-2 py-0.5 font-medium text-gray-700">
                            {risk.residual_risk_rating ?? "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Risk Matrix tab */}
      {activeTab === "matrix" && (
        <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-calpoly-green">
            Risk Matrix (Baseline)
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Heatmap of baseline likelihood and impact for approved risks.
          </p>
          <div className="mt-6">
            <HeatMap risks={matrixRisks} onEdit={() => {}} />
          </div>
        </section>
      )}
    </div>
  );
}
