"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  User,
  ArrowRight,
  Clock,
  CheckCircle,
  ClipboardCheck,
  Eye,
  Shield,
  XCircle,
} from "lucide-react";
import RiskModal from "@/components/RiskModal";
import { Risk } from "@/types";

type ApiRisk = {
  id?: string | number | null;
  risk_id: string | null;
  unit?: string | null;
  college_unit?: string | null;
  department: string | null;
  owner: string | null;
  risk_description: string | null;
  risk_analysis?: string | null;
  category: string | null;
  status: string | null;
  residual_risk_rating?: string | number | null;
  approval_status?: "pending" | "approved" | "rejected" | null;
  actioned_by?: string | null;
  baseline_likelihood?: string | number | null;
  baseline_impact?: string | number | null;
  current_controls?: string | null;
  mitigation_strategies?: string | null;
  updated_likelihood?: string | number | null;
  updated_impact?: string | number | null;
  status_poc?: string | null;
  resources_needed?: string | null;
  leadership_comments?: string | null;
  erm_comments?: string | null;
  rejection_reason?: string | null;
  risk_creation_at?: string | null;
  actioned_at?: string | null;
  [key: string]: string | number | boolean | null | undefined;
};

type AuthUser = {
  sub: string;
  email?: string;
  name?: string;
  username?: string;
  groups: string[];
};

const API_URL = "/api/erm-dashboard-results";

function normalizeForMatch(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isActionedByUser(risk: ApiRisk, user: AuthUser): boolean {
  const ab = normalizeForMatch(risk.actioned_by);
  if (!ab) return false;
  const candidates = [
    user.name,
    user.email,
    user.username,
    user.sub,
  ].filter(Boolean) as string[];
  return candidates.some((c) => normalizeForMatch(c) === ab);
}

function isRiskOwnedByUser(risk: ApiRisk, user: AuthUser): boolean {
  const owner = normalizeForMatch(risk.owner);
  if (!owner) return false;
  const candidates = [
    user.name,
    user.email,
    user.username,
    user.sub,
  ].filter(Boolean) as string[];
  return candidates.some((c) => normalizeForMatch(c) === owner);
}

/** Extract risks array from dashboard API response (handles body string or direct results). */
function extractRisksFromResponse(data: unknown): ApiRisk[] {
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  let payload = obj;
  if (typeof obj.body === "string") {
    try {
      payload = JSON.parse(obj.body) as Record<string, unknown>;
    } catch {
      return [];
    }
  }
  const results = payload.results ?? payload.data ?? payload.items;
  return Array.isArray(results) ? (results as ApiRisk[]) : [];
}

function formatDate(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

// Must match RiskModal college/unit option values so View shows the correct selection
const COLLEGE_VALUES = new Set(["cafes", "caed", "ocob", "ceng", "cla", "bcsm", "cpace"]);
const UNIT_VALUES = new Set([
  "academic_affairs", "admin_finance", "student_affairs", "diversity", "research",
  "its", "facilities", "public_safety", "partners", "advancement", "marketing",
]);

function mapApiRiskToRisk(api: ApiRisk): Risk {
  const id = api.id != null ? String(api.id) : String(api.risk_id ?? "");
  const rawUnit = (api.unit ?? api.college_unit ?? "").toString().trim();
  const normalized = rawUnit ? rawUnit.toLowerCase() : "";
  const isCollege = normalized && COLLEGE_VALUES.has(normalized);
  const isUnit = normalized && UNIT_VALUES.has(normalized);
  const orgType: "college" | "unit" = isUnit ? "unit" : "college";
  const valueForSelect = normalized || undefined;
  return {
    id,
    riskIdNo: api.risk_id ?? undefined,
    orgType,
    college: orgType === "college" ? valueForSelect : undefined,
    unit: orgType === "unit" ? valueForSelect : undefined,
    collegeUnit: valueForSelect ?? (rawUnit || undefined),
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
}

function RiskRow({
  risk,
  onView,
  dateLabel,
  dateValue,
}: {
  risk: ApiRisk;
  onView: () => void;
  dateLabel?: string;
  dateValue?: string;
}) {
  const residual = Number(risk.residual_risk_rating ?? 0);
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900">
          {risk.risk_description || "Untitled risk"}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          {risk.unit ?? "—"} · {risk.department ?? "—"} · {risk.category ?? "—"}{" "}
          · {risk.status ?? "—"}
        </p>
        {dateLabel && dateValue && (
          <p className="mt-1 text-xs text-gray-500">
            {dateLabel}: {dateValue}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
          Residual {residual}
        </span>
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <Eye className="h-4 w-4" />
          View
        </button>
      </div>
    </li>
  );
}

function RejectedRow({ risk, onView }: { risk: ApiRisk; onView: () => void }) {
  const rejectedDate = formatDate(risk.actioned_at);
  const reason = (risk.rejection_reason ?? "").trim() || "No reason provided.";
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900">
          {risk.risk_description || "Untitled risk"}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          {risk.unit ?? "—"} · {risk.department ?? "—"} · {risk.category ?? "—"}
        </p>
        {rejectedDate && (
          <p className="mt-1 text-xs text-gray-500">
            Rejected: {rejectedDate}
          </p>
        )}
        <div className="mt-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <span className="font-medium text-gray-600">Reason: </span>
          {reason}
        </div>
      </div>
      <div className="flex shrink-0">
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <Eye className="h-4 w-4" />
          View
        </button>
      </div>
    </li>
  );
}

function EmptySection({
  message,
  subMessage,
  actionLabel,
  actionHref,
}: {
  message: string;
  subMessage: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-600">
      <p className="font-medium">{message}</p>
      <p className="mt-1 text-sm">{subMessage}</p>
      <Link
        href={actionHref}
        className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-calpoly-green hover:underline"
      >
        {actionLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

type TabId = "entered" | "approved" | "rejected";

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [risks, setRisks] = useState<ApiRisk[]>([]);
  const [approvedRisksAdmin, setApprovedRisksAdmin] = useState<ApiRisk[]>([]);
  const [rejectedRisksAdmin, setRejectedRisksAdmin] = useState<ApiRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewRisk, setViewRisk] = useState<Risk | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("entered");

  const myEnteredPending = useMemo(
    () =>
      risks
        .filter((r) => r.approval_status === "pending")
        .sort((a, b) => {
          const aScore = Number(a.residual_risk_rating ?? -1);
          const bScore = Number(b.residual_risk_rating ?? -1);
          return bScore - aScore;
        }),
    [risks],
  );

  const myEnteredApproved = useMemo(
    () =>
      risks
        .filter((r) => r.approval_status === "approved")
        .sort((a, b) => {
          const aScore = Number(a.residual_risk_rating ?? -1);
          const bScore = Number(b.residual_risk_rating ?? -1);
          return bScore - aScore;
        }),
    [risks],
  );

  const myEnteredRejected = useMemo(
    () =>
      risks
        .filter((r) => r.approval_status === "rejected")
        .sort((a, b) => {
          const aDate = a.actioned_at ? new Date(String(a.actioned_at)).getTime() : 0;
          const bDate = b.actioned_at ? new Date(String(b.actioned_at)).getTime() : 0;
          return bDate - aDate;
        }),
    [risks],
  );

  const risksIApproved = useMemo(() => {
    if (!user?.groups?.includes("admin")) return [];
    return approvedRisksAdmin.filter((r) => isActionedByUser(r, user));
  }, [user, approvedRisksAdmin]);

  const risksIRejected = useMemo(() => {
    if (!user?.groups?.includes("admin")) return [];
    return rejectedRisksAdmin.filter((r) => isActionedByUser(r, user));
  }, [user, rejectedRisksAdmin]);

  const refetchRisks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const risksRes = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ limit: 500 }),
      });
      if (!risksRes.ok) return;
      const riskData = await risksRes.json().catch(() => null);
      const rawList = extractRisksFromResponse(riskData);
      const list = rawList.filter((r) => isRiskOwnedByUser(r, user));
      setRisks(list);

      if (user.groups?.includes("admin")) {
        const [approvedRes, rejectedRes] = await Promise.all([
          fetch("/api/admin/approved-risks", { credentials: "include" }),
          fetch("/api/admin/rejected-risks", { credentials: "include" }),
        ]);
        if (approvedRes.ok) {
          const arr = await approvedRes.json();
          setApprovedRisksAdmin(Array.isArray(arr) ? arr : []);
        }
        if (rejectedRes.ok) {
          const arr = await rejectedRes.json();
          setRejectedRisksAdmin(Array.isArray(arr) ? arr : []);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        const meRes = await fetch("/api/auth/me", { cache: "no-store" });
        if (meRes.status === 401) {
          window.location.href = "/login?returnTo=/profile";
          return;
        }
        if (!meRes.ok) {
          setError("Could not load your profile.");
          return;
        }
        const meData = await meRes.json();
        const u = meData?.user;
        if (!u || !u.sub) {
          setError("Invalid session.");
          return;
        }
        if (!cancelled) setUser(u);

        const risksRes = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ limit: 500 }),
        });
        if (risksRes.status === 401) {
          window.location.href = "/login?returnTo=/profile";
          return;
        }
        if (!risksRes.ok) {
          const errData = await risksRes.json().catch(() => ({}));
          if (!cancelled) setError((errData?.error as string) || `Request failed (${risksRes.status})`);
          return;
        }
        if (cancelled) return;
        const riskData = await risksRes.json().catch(() => null);
        const rawList = extractRisksFromResponse(riskData);
        const list = u
          ? rawList.filter((r) => isRiskOwnedByUser(r, u))
          : rawList;
        if (!cancelled) setRisks(list);

        if (u.groups?.includes("admin")) {
          const [approvedRes, rejectedRes] = await Promise.all([
            fetch("/api/admin/approved-risks", { credentials: "include" }),
            fetch("/api/admin/rejected-risks", { credentials: "include" }),
          ]);
          if (approvedRes.ok && !cancelled) {
            const arr = await approvedRes.json();
            setApprovedRisksAdmin(Array.isArray(arr) ? arr : []);
          }
          if (rejectedRes.ok && !cancelled) {
            const arr = await rejectedRes.json();
            setRejectedRisksAdmin(Array.isArray(arr) ? arr : []);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Something went wrong.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading your profile...</p>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="rounded-lg border border-gray-300 bg-white p-6 text-center max-w-md shadow-sm">
          <p className="text-gray-800 font-medium">{error}</p>
          <Link
            href="/login?returnTo=/profile"
            className="mt-4 inline-block text-sm font-medium text-calpoly-green hover:underline"
          >
            Sign in again
          </Link>
        </div>
      </div>
    );
  }

  const displayName =
    user?.name || user?.email || user?.username || user?.sub || "User";
  const isAdmin = user?.groups?.includes("admin");

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "entered", label: "Risks I entered", count: risks.length },
  ];
  if (isAdmin) {
    tabs.push({ id: "approved", label: "Risks I approved", count: risksIApproved.length });
    tabs.push({ id: "rejected", label: "Risks I rejected", count: risksIRejected.length });
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <div className="container mx-auto px-4 py-8 md:px-8">
        <header className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-600">
                <User className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">
                    My Profile
                  </h1>
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 rounded border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      <Shield className="h-3 w-3" />
                      Admin
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-600">{displayName}</p>
                {user?.email && user.email !== displayName && (
                  <p className="text-xs text-gray-500">{user.email}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/"
                className="inline-flex items-center rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Risk Tool
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded bg-calpoly-green px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
              >
                Dashboard
              </Link>
              <Link
                href="/api/auth/logout"
                className="inline-flex items-center rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Sign Out
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-6 border-b border-gray-200 bg-white shadow-sm">
          <nav className="flex gap-0" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`border-b-2 px-6 py-4 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "border-calpoly-green text-calpoly-green"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                {tab.label}
                {tab.count != null && tab.count > 0 && (
                  <span className="ml-2 rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-0 rounded-b-lg border border-t-0 border-gray-200 bg-white p-6 shadow-sm">
          {activeTab === "entered" && (
            <div className="space-y-8">
              {/* Pending */}
              <section className="rounded-lg border border-gray-200 border-l-4 border-l-gray-400 bg-gray-50/50 p-4">
                <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                  <Clock className="h-4 w-4 text-gray-500" />
                  Pending approval
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Waiting for admin review.
                </p>
                {loading ? (
                  <p className="mt-4 text-sm text-gray-500">Loading...</p>
                ) : myEnteredPending.length === 0 ? (
                  <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
                    No pending risks.
                  </div>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {myEnteredPending.map((risk) => (
                      <RiskRow
                        key={String(risk.id ?? risk.risk_id ?? Math.random())}
                        risk={risk}
                        onView={() => setViewRisk(mapApiRiskToRisk(risk))}
                        dateLabel="Entered"
                        dateValue={formatDate(risk.risk_creation_at) || undefined}
                      />
                    ))}
                  </ul>
                )}
              </section>

              {/* Approved */}
              <section className="rounded-lg border border-gray-200 border-l-4 border-l-gray-600 bg-gray-50/50 p-4">
                <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                  <CheckCircle className="h-4 w-4 text-gray-500" />
                  Approved
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Approved and visible on the dashboard.
                </p>
                {loading ? (
                  <p className="mt-4 text-sm text-gray-500">Loading...</p>
                ) : myEnteredApproved.length === 0 ? (
                  <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
                    No approved risks yet.
                  </div>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {myEnteredApproved.map((risk) => (
                      <RiskRow
                        key={String(risk.id ?? risk.risk_id ?? Math.random())}
                        risk={risk}
                        onView={() => setViewRisk(mapApiRiskToRisk(risk))}
                        dateLabel="Approved"
                        dateValue={formatDate(risk.actioned_at) || undefined}
                      />
                    ))}
                  </ul>
                )}
              </section>

              {/* Rejected */}
              <section className="rounded-lg border border-gray-200 border-l-4 border-l-gray-500 bg-gray-50/50 p-4">
                <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                  <XCircle className="h-4 w-4 text-gray-500" />
                  Rejected
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Rejected with reason; view full details below.
                </p>
                {loading ? (
                  <p className="mt-4 text-sm text-gray-500">Loading...</p>
                ) : myEnteredRejected.length === 0 ? (
                  <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
                    No rejected risks.
                  </div>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {myEnteredRejected.map((risk) => (
                      <RejectedRow
                        key={String(risk.id ?? risk.risk_id ?? Math.random())}
                        risk={risk}
                        onView={() => setViewRisk(mapApiRiskToRisk(risk))}
                      />
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          {activeTab === "approved" && isAdmin && (
            <div>
              <p className="text-sm text-gray-500">
                Risks you have approved as an admin.
              </p>
              {loading ? (
                <p className="mt-4 text-sm text-gray-500">Loading...</p>
              ) : risksIApproved.length === 0 ? (
                <EmptySection
                  message="No risks approved by you yet"
                  subMessage="When you approve risks in Admin Review, they will appear here."
                  actionLabel="Go to Admin Review"
                  actionHref="/dashboard/admin/review"
                />
              ) : (
                <ul className="mt-4 space-y-3">
                  {risksIApproved.map((risk) => (
                    <RiskRow
                      key={String(risk.id ?? risk.risk_id ?? Math.random())}
                      risk={risk}
                      onView={() => setViewRisk(mapApiRiskToRisk(risk))}
                      dateLabel="Approved"
                      dateValue={formatDate(risk.actioned_at) || undefined}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === "rejected" && isAdmin && (
            <div>
              <p className="text-sm text-gray-500">
                Risks you have rejected as an admin.
              </p>
              {loading ? (
                <p className="mt-4 text-sm text-gray-500">Loading...</p>
              ) : risksIRejected.length === 0 ? (
                <EmptySection
                  message="No risks rejected by you yet"
                  subMessage="When you reject risks in Admin Review, they will appear here."
                  actionLabel="Go to Admin Review"
                  actionHref="/dashboard/admin/review"
                />
              ) : (
                <ul className="mt-4 space-y-3">
                  {risksIRejected.map((risk) => (
                    <RejectedRow
                      key={String(risk.id ?? risk.risk_id ?? Math.random())}
                      risk={risk}
                      onView={() => setViewRisk(mapApiRiskToRisk(risk))}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <RiskModal
        isOpen={!!viewRisk}
        onClose={() => setViewRisk(null)}
        risk={viewRisk}
        onSave={() => {
          refetchRisks();
          setViewRisk(null);
        }}
        readOnly={!isAdmin}
      />
    </div>
  );
}
