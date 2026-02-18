"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownUp,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

type ApiRisk = {
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
  resources_needed: string | null;
  additional_comments: string | null;
  [key: string]: string | number | null | undefined;
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
    count: values.filter((value) => value >= bin.min && value <= bin.max).length,
  }));
};

const COLUMN_PRIORITY = [
  "id",
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
  "approved",
  "funding_required",
  "risk_tolerance",
  "risk_visibility",
  "internal_resources",
  "external_resources",
  "resources_needed",
  "additional_comments",
  "risk_creation_at",
];

const formatColumnLabel = (key: string) =>
  key
    .split("_")
    .map((part) =>
      part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part
    )
    .join(" ");

const formatCellValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return "--";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : "--";
  }
  return value;
};

export default function DashboardPage() {
  const [risks, setRisks] = useState<ApiRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [limit, setLimit] = useState(75);
  const [semanticQuery, setSemanticQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    department: "",
    category: "",
    status: "",
    owner: "",
    unit: "",
  });

  const fetchRisks = async (
    nextFilters = filters,
    nextLimit = limit,
    nextSemanticQuery = semanticQuery
  ) => {
    setLoading(true);
    setError(null);
    try {
      const payloadFilters = Object.fromEntries(
        Object.entries(nextFilters).filter(([, value]) => value.trim())
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
            : "Dashboard API returned 403 (forbidden)."
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
          : "Unable to load dashboard data."
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
            : "Unable to verify session."
        );
      } finally {
        setAuthLoading(false);
      }
    };

    initialize();
  }, []);

  const analytics = useMemo(() => {
    const residualValues = risks
      .map((risk) => toNumber(risk.residual_risk_rating))
      .filter((value): value is number => value !== null);
    const avgResidual =
      residualValues.length > 0
        ? (residualValues.reduce((sum, value) => sum + value, 0) /
            residualValues.length
          ).toFixed(1)
        : "0.0";
    const maxResidual = residualValues.length
      ? Math.max(...residualValues)
      : 0;
    const highResidualCount = residualValues.filter(
      (value) => value >= HIGH_RISK_THRESHOLD
    ).length;
    const openCount = risks.filter((risk) => {
      const status = (risk.status || "").toLowerCase();
      return status && !status.includes("closed") && !status.includes("resolved");
    }).length;

    const statusCounts = groupCounts(risks, (risk) =>
      normalizeKey(risk.status, "Unspecified")
    ).slice(0, 5);
    const categoryCounts = groupCounts(risks, (risk) =>
      normalizeKey(risk.category, "Uncategorized")
    ).slice(0, 6);
    const unitCounts = groupCounts(risks, (risk) =>
      normalizeKey(risk.unit, "Unassigned")
    ).slice(0, 5);

    const bins = buildBins(residualValues);

    const topRisks = [...risks]
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
  }, [risks]);

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const filterOptions = useMemo(() => {
    const getDistinctValues = (
      key: keyof Pick<ApiRisk, "department" | "category" | "status" | "owner" | "unit">
    ) => {
      const values = new Set<string>();
      risks.forEach((risk) => {
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
  }, [risks]);

  const tableColumns = useMemo(() => {
    if (risks.length === 0) {
      return COLUMN_PRIORITY;
    }

    const discovered = new Set<string>();
    risks.forEach((risk) => {
      Object.keys(risk).forEach((key) => discovered.add(key));
    });

    const priorityColumns = COLUMN_PRIORITY.filter((key) => discovered.has(key));
    const additionalColumns = Array.from(discovered)
      .filter((key) => !COLUMN_PRIORITY.includes(key))
      .sort((a, b) => a.localeCompare(b));

    return [...priorityColumns, ...additionalColumns];
  }, [risks]);

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
                Signed in as {user.name || user.email || user.username || user.sub}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
              onChange={(event) => updateFilter("department", event.target.value)}
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
              {loading ? "--" : risks.length}
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
                const width = risks.length
                  ? Math.round((count / risks.length) * 100)
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
                const width = risks.length
                  ? Math.round((bin.count / risks.length) * 100)
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
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-calpoly-green">
              Detailed Results
            </h3>
            {loading && (
              <span className="text-sm text-gray-500">Loading data...</span>
            )}
            {!loading && error && (
              <span className="text-sm text-red-500">{error}</span>
            )}
          </div>
          <div className="mt-4 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  {tableColumns.map((column) => (
                    <th key={column} className="px-3 py-2">
                      {formatColumnLabel(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {risks.slice(0, 10).map((risk, index) => (
                  <tr key={String(risk.risk_id || `row-${index}`)}>
                    {tableColumns.map((column, columnIndex) => (
                      <td
                        key={`${column}-${index}`}
                        className={`px-3 py-2 ${
                          columnIndex === 0
                            ? "font-medium text-gray-800"
                            : "text-gray-600"
                        }`}
                      >
                        {formatCellValue(risk[column])}
                      </td>
                    ))}
                  </tr>
                ))}
                {!loading && risks.length === 0 && (
                  <tr>
                    <td
                      colSpan={tableColumns.length || 1}
                      className="px-3 py-6 text-center text-gray-500"
                    >
                      No results returned for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
