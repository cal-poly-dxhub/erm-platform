"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownUp,
  ClipboardCheck,
  RefreshCcw,
  ShieldCheck,
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

  const approvedRisks = useMemo(
    () => risks.filter((r) => r.approval_status === "approved"),
    [risks],
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
    const openCount = approvedRisks.filter((risk) => {
      const status = (risk.status || "").toLowerCase();
      return (
        status && !status.includes("closed") && !status.includes("resolved")
      );
    }).length;

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
      openCount,
      statusCounts,
      categoryCounts,
      unitCounts,
      bins,
      topRisks,
    };
  }, [approvedRisks]);

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
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 text-gray-800">
      <div className="container mx-auto px-4 py-8 md:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-widest text-calpoly-gold">
              ENTERPRISE RISK MANAGEMENT
            </p>
            <h1 className="text-4xl font-bold text-calpoly-green">
              ERM Results Dashboard
            </h1>
            <p className="mt-2 text-gray-600">
              Live view of residual risk exposure, ownership, and mitigation
              priorities.
            </p>
            {user && (
              <p className="mt-2 text-xs text-gray-500">
                Signed in as{" "}
                {user.name || user.email || user.username || user.sub}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {user?.groups?.includes("admin") && (
              <Link
                href="/dashboard/admin/review"
                className="inline-flex items-center rounded-lg border border-calpoly-gold bg-calpoly-gold/10 px-4 py-2 text-sm font-semibold text-calpoly-green shadow-sm transition hover:bg-calpoly-gold/20"
              >
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Admin Review
              </Link>
            )}
            <Link
              href="/api/auth/logout"
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              Sign Out
            </Link>
            <Link
              href="/"
              className="inline-flex items-center rounded-lg border border-calpoly-green/30 bg-white px-4 py-2 text-sm font-semibold text-calpoly-green shadow-sm transition hover:bg-gray-50"
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Back to Risk Tool
            </Link>
            <button
              onClick={() => fetchRisks()}
              className="inline-flex items-center rounded-lg bg-calpoly-green px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh Data
            </button>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-calpoly-green">
                Filters
              </h2>
              <p className="text-sm text-gray-500">
                Filters are exact match on department, category, status, owner,
                and unit.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <ArrowDownUp className="h-4 w-4" />
              Limit
              <input
                type="number"
                min={10}
                max={250}
                value={limit}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next)) {
                    setLimit(10);
                    return;
                  }
                  const clamped = Math.min(250, Math.max(10, next));
                  setLimit(clamped);
                }}
                className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-5">
            <select
              value={filters.department}
              onChange={(event) =>
                updateFilter("department", event.target.value)
              }
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
            >
              <option value="">All Departments</option>
              {filterOptions.department.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={filters.category}
              onChange={(event) => updateFilter("category", event.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
            >
              <option value="">All Categories</option>
              {filterOptions.category.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
            >
              <option value="">All Statuses</option>
              {filterOptions.status.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={filters.owner}
              onChange={(event) => updateFilter("owner", event.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
            >
              <option value="">All Owners</option>
              {filterOptions.owner.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={filters.unit}
              onChange={(event) => updateFilter("unit", event.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
            >
              <option value="">All Units</option>
              {filterOptions.unit.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <label className="text-sm font-semibold text-gray-600">
              Semantic Search
            </label>
            <input
              value={semanticQuery}
              onChange={(event) => setSemanticQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleApplyFilters();
                }
              }}
              placeholder="Search by risk description or analysis..."
              className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={handleApplyFilters}
              className="rounded-lg bg-calpoly-gold px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              Apply Filters
            </button>
            <button
              onClick={handleClearFilters}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">Total Risks</p>
            <p className="mt-3 text-3xl font-bold text-calpoly-green">
              {loading ? "--" : approvedRisks.length}
            </p>
            <p className="mt-2 text-xs text-gray-400">Records returned</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              High Residual Risks
            </p>
            <p className="mt-3 flex items-center text-3xl font-bold text-risk-high">
              <AlertTriangle className="mr-2 h-6 w-6" />
              {loading ? "--" : analytics.highResidualCount}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Residual rating {HIGH_RISK_THRESHOLD}+
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">
              Avg Residual Rating
            </p>
            <p className="mt-3 text-3xl font-bold text-calpoly-green">
              {loading ? "--" : analytics.avgResidual}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Max {loading ? "--" : analytics.maxResidual}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">Open Items</p>
            <p className="mt-3 text-3xl font-bold text-calpoly-green">
              {loading ? "--" : analytics.openCount}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Excludes Closed and Resolved
            </p>
          </div>
        </section>

        {!loading && error && (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Unable to load data from the dashboard API. {error}
          </section>
        )}
        {authLoading && (
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
            Checking authentication...
          </section>
        )}

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-calpoly-green">
              Status Mix
            </h3>
            <div className="mt-4 space-y-3">
              {analytics.statusCounts.map(([status, count]) => {
                const width = approvedRisks.length
                  ? Math.round((count / approvedRisks.length) * 100)
                  : 0;
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>{status}</span>
                      <span>{count}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-calpoly-green"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {!loading && analytics.statusCounts.length === 0 && (
                <p className="text-sm text-gray-500">No status data.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-calpoly-green">
              Category Concentration
            </h3>
            <div className="mt-4 space-y-3">
              {analytics.categoryCounts.map(([category, count], index) => (
                <div
                  key={`${category}-${index}`}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                >
                  <span className="text-sm font-medium text-gray-700">
                    {category}
                  </span>
                  <span className="text-sm font-semibold text-calpoly-green">
                    {count}
                  </span>
                </div>
              ))}
              {!loading && analytics.categoryCounts.length === 0 && (
                <p className="text-sm text-gray-500">No category data.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-calpoly-green">
              Residual Rating Spread
            </h3>
            <div className="mt-4 space-y-3">
              {analytics.bins.map((bin) => {
                const width = approvedRisks.length
                  ? Math.round((bin.count / approvedRisks.length) * 100)
                  : 0;
                return (
                  <div key={bin.label}>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>{bin.label}</span>
                      <span>{bin.count}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-calpoly-gold"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {!loading && analytics.bins.length === 0 && (
                <p className="text-sm text-gray-500">No rating data.</p>
              )}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-calpoly-green">
              Top Units
            </h3>
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
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-calpoly-green">
              Priority Residual Risks
            </h3>
            <div className="mt-4 space-y-3">
              {analytics.topRisks.map((risk, index) => (
                <div
                  key={risk.risk_id || `risk-${index}`}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-800">
                      {risk.risk_description || "Risk item"}
                    </p>
                    <span className="text-xs font-semibold text-calpoly-gold">
                      {risk.residual_risk_rating ?? "--"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {normalizeKey(risk.department, "Department N/A")} -{" "}
                    {normalizeKey(risk.owner, "Owner N/A")}
                  </p>
                </div>
              ))}
              {!loading && analytics.topRisks.length === 0 && (
                <p className="text-sm text-gray-500">No risk records.</p>
              )}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-calpoly-green">
              Risk Workflow Board
            </h3>
            {loading && (
              <span className="text-sm text-gray-500">Loading data...</span>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Click any risk card to open full narrative details.
          </p>
          <div className="mt-4 overflow-x-auto pb-2">
            <div className="grid min-w-[1120px] grid-cols-5 gap-4">
              {BOARD_LANES.map((lane) => (
                <div
                  key={lane.key}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-700">
                      {lane.label}
                    </h4>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-600">
                      {boardLanes[lane.key].length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {boardLanes[lane.key].slice(0, 8).map((risk) => {
                      const riskKey = getRiskKey(risk);
                      const residual = toNumber(risk.residual_risk_rating);
                      return (
                        <button
                          key={riskKey}
                          type="button"
                          onClick={() => setSelectedRiskKey(riskKey)}
                          className={`w-full rounded-lg border bg-white p-3 text-left shadow-sm transition hover:border-calpoly-gold hover:shadow ${
                            selectedRiskKey === riskKey
                              ? "border-calpoly-gold ring-2 ring-calpoly-gold/40"
                              : "border-gray-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-800">
                              {risk.risk_description || "Risk item"}
                            </p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getResidualTone(
                                residual,
                              )}`}
                            >
                              {residual ?? "--"}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-gray-500">
                            {normalizeKey(risk.owner, "Owner N/A")}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {normalizeKey(risk.unit, "Unit N/A")} |{" "}
                            {normalizeKey(risk.category, "No category")}
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

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-calpoly-green">
            Risk Detail
          </h3>
          {!selectedRisk && !loading && (
            <p className="mt-3 text-sm text-gray-500">
              No risk selected. Apply filters or select a risk from the board.
            </p>
          )}
          {selectedRisk && (
            <div className="mt-4 space-y-5">
              <div className="rounded-xl border border-gray-200 p-4">
                <h5 className="text-sm font-semibold text-gray-700">
                  Full Risk Record
                </h5>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {DETAIL_FIELDS.map((field) => {
                    const rawValue = selectedRisk[field];
                    let displayValue = formatCellValue(rawValue);
                    if (
                      DATE_DETAIL_FIELDS.has(field) &&
                      typeof rawValue === "string" &&
                      rawValue.trim()
                    ) {
                      const parsed = new Date(rawValue);
                      if (!Number.isNaN(parsed.getTime())) {
                        displayValue = parsed.toLocaleString();
                      }
                    }

                    return (
                      <div
                        key={field}
                        className={`rounded-lg bg-gray-50 p-3 ${
                          LONG_TEXT_DETAIL_FIELDS.has(field)
                            ? "sm:col-span-2 lg:col-span-4"
                            : ""
                        }`}
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
      </div>
    </div>
  );
}
