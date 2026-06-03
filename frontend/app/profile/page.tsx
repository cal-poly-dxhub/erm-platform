"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
  RefreshCw,
  Bell,
  Pencil,
} from "lucide-react";
import RiskModal from "@/components/RiskModal";
import { Risk } from "@/types";
import { hasMinRole } from "@/lib/auth/roles";
import { organizationScopeLabel } from "@/utils/orgLabels";
import { extractUserProfile, type UserProfile } from "@/lib/api/userProfile";
import { formatExpertiseForDisplay } from "@/utils/expertise";

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

type UserProfile = {
  cognito_sub: string;
  email: string;
  name: string;
  college?: string | null;
  unit?: string | null;
  department?: string | null;
  expertise: string[];
  created_at?: string | null;
};

function ProfileInfoRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-gray-900">{value}</dd>
    </div>
  );
}

type NotificationPreferences = {
  notifyNewRiskSubmitted: boolean;
  remindPendingApproval: boolean;
  weeklyDigestNoProgress: boolean;
  notifyRiskDecision: boolean;
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
        <span className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
          Residual {residual}
        </span>
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-1.5 rounded-lg border border-calpoly-green bg-white px-3 py-2 text-sm font-medium text-calpoly-green transition hover:bg-calpoly-green/5"
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
          className="inline-flex items-center gap-1.5 rounded-lg border border-calpoly-green bg-white px-3 py-2 text-sm font-medium text-calpoly-green transition hover:bg-calpoly-green/5"
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
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
      <p className="font-medium text-gray-800">{message}</p>
      <p className="mt-1 text-sm text-gray-600">{subMessage}</p>
      <Link
        href={actionHref}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-calpoly-green px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
      >
        {actionLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

type TabId = "entered" | "approved" | "rejected";
type ProfileSection = "activity" | "settings";

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [risks, setRisks] = useState<ApiRisk[]>([]);
  const [approvedRisksAdmin, setApprovedRisksAdmin] = useState<ApiRisk[]>([]);
  const [rejectedRisksAdmin, setRejectedRisksAdmin] = useState<ApiRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewRisk, setViewRisk] = useState<Risk | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("entered");
  const [profileSection, setProfileSection] =
    useState<ProfileSection>("activity");
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    notifyNewRiskSubmitted: false,
    remindPendingApproval: false,
    weeklyDigestNoProgress: false,
    notifyRiskDecision: false,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsMessage, setPrefsMessage] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);

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
    if (!user || !hasMinRole(user.groups, "admin")) return [];
    return approvedRisksAdmin.filter((r) => isActionedByUser(r, user));
  }, [user, approvedRisksAdmin]);

  const risksIRejected = useMemo(() => {
    if (!user || !hasMinRole(user.groups, "admin")) return [];
    return rejectedRisksAdmin.filter((r) => isActionedByUser(r, user));
  }, [user, rejectedRisksAdmin]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadNotificationPrefs = async () => {
      try {
        const res = await fetch("/api/profile/notification-preferences", {
          method: "GET",
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const data = await res.json().catch(() => null);
        if (!data || cancelled) return;
        setNotificationPrefs((prev) => ({
          notifyNewRiskSubmitted:
            "notifyNewRiskSubmitted" in data
              ? Boolean(data.notifyNewRiskSubmitted)
              : prev.notifyNewRiskSubmitted,
          remindPendingApproval:
            "remindPendingApproval" in data
              ? Boolean(data.remindPendingApproval)
              : prev.remindPendingApproval,
          weeklyDigestNoProgress:
            "weeklyDigestNoProgress" in data
              ? Boolean(data.weeklyDigestNoProgress)
              : prev.weeklyDigestNoProgress,
          notifyRiskDecision:
            "notifyRiskDecision" in data
              ? Boolean(data.notifyRiskDecision)
              : prev.notifyRiskDecision,
        }));
      } catch {
        // Swallow errors; this section is best-effort until API is implemented.
      }
    };

    void loadNotificationPrefs();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSaveNotificationPrefs = useCallback(async () => {
    setSavingPrefs(true);
    setPrefsMessage(null);
    try {
      const res = await fetch("/api/profile/notification-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(notificationPrefs),
      });
      if (!res.ok) {
        setPrefsMessage("Could not save preferences. Please try again.");
        return;
      }
      setPrefsMessage("Notification preferences saved.");
    } catch {
      setPrefsMessage("Could not save preferences. Please try again.");
    } finally {
      setSavingPrefs(false);
    }
  }, [notificationPrefs]);

  const loadUserProfile = useCallback(async (sessionUser?: AuthUser | null) => {
    setProfileLoadError(null);
    try {
      const res = await fetch("/api/users/profile", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUserProfile(null);
        setProfileLoadError(
          (data?.error as string) || `Could not load profile (${res.status})`,
        );
        return;
      }
      const profile = extractUserProfile(data, sessionUser ?? undefined);
      setUserProfile(profile);
      if (!profile && !data?.error) {
        setProfileLoadError(null);
      }
    } catch {
      setUserProfile(null);
      setProfileLoadError("Could not load profile.");
    } finally {
      setProfileLoaded(true);
    }
  }, []);

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

      if (user.groups && hasMinRole(user.groups, "admin")) {
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

        const profileRes = await fetch("/api/users/profile", {
          credentials: "include",
        });
        const profileData = await profileRes.json().catch(() => ({}));
        if (!cancelled) {
          if (!profileRes.ok) {
            setProfileLoadError(
              (profileData?.error as string) ||
                `Could not load profile (${profileRes.status})`,
            );
            setUserProfile(null);
          } else {
            setUserProfile(extractUserProfile(profileData, u));
            setProfileLoadError(null);
          }
          setProfileLoaded(true);
        }

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

        if (u.groups && hasMinRole(u.groups, "admin")) {
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
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-4 text-sm text-gray-600 shadow-sm">
          Loading your profile…
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm max-w-md">
          <p className="font-medium text-gray-800">{error}</p>
          <Link
            href="/login?returnTo=/profile"
            className="mt-4 inline-flex items-center rounded-lg bg-calpoly-green px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
          >
            Sign in again
          </Link>
        </div>
      </div>
    );
  }

  const displayName =
    userProfile?.name ||
    user?.name ||
    user?.email ||
    user?.username ||
    user?.sub ||
    "User";
  const displayEmail = userProfile?.email || user?.email || "";
  const orgLabel = userProfile
    ? organizationScopeLabel(userProfile.college, userProfile.unit)
    : null;
  const expertiseList = userProfile
    ? formatExpertiseForDisplay(userProfile.expertise)
    : [];
  const memberSince = userProfile?.created_at
    ? formatDate(userProfile.created_at)
    : "";
  const isAdmin = user ? hasMinRole(user.groups, "admin") : false;

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "entered", label: "Risks I entered", count: risks.length },
  ];
  if (isAdmin) {
    tabs.push({ id: "approved", label: "Risks I approved", count: risksIApproved.length });
    tabs.push({ id: "rejected", label: "Risks I rejected", count: risksIRejected.length });
  }

  return (
    <div className="space-y-6">
      {/* Page header: eyebrow + title + subtitle + refresh */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-calpoly-gold">
            Account
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-calpoly-green">
            Profile
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Your risks and activity. {isAdmin ? "Admin actions appear in separate tabs." : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void loadUserProfile(user);
              void refetchRisks();
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Profile information */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-calpoly-green/10 text-calpoly-green">
              <User className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">{displayName}</h2>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-calpoly-gold/50 bg-calpoly-gold/10 px-2.5 py-0.5 text-xs font-medium text-calpoly-green">
                    <Shield className="h-3 w-3" />
                    Admin
                  </span>
                )}
              </div>
              {displayEmail && (
                <p className="mt-0.5 text-sm text-gray-600">{displayEmail}</p>
              )}
            </div>
          </div>
          {profileLoaded && (
            <Link
              href={userProfile ? "/onboarding?edit=1" : "/onboarding"}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-calpoly-green shadow-sm transition hover:bg-gray-50"
            >
              <Pencil className="h-4 w-4" />
              {userProfile ? "Edit" : "Complete profile"}
            </Link>
          )}
        </div>

        {profileLoadError && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {profileLoadError}
          </p>
        )}

        {!profileLoaded ? (
          <p className="pt-4 text-sm text-gray-500">Loading profile…</p>
        ) : !userProfile ? (
          <div className="pt-4 text-center">
            <p className="text-sm text-gray-600">
              {profileLoadError
                ? "Fix the error above, then refresh."
                : "Add organization and expertise to help match you with relevant risks."}
            </p>
            {!profileLoadError && (
              <Link
                href="/onboarding"
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-calpoly-green hover:underline"
              >
                Complete profile
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        ) : (
          <dl className="grid gap-5 pt-5 sm:grid-cols-2">
            <ProfileInfoRow
              label="Organization"
              value={orgLabel ?? <span className="text-gray-500">—</span>}
            />
            <ProfileInfoRow
              label="Department"
              value={
                userProfile.department?.trim() ? (
                  userProfile.department
                ) : (
                  <span className="text-gray-500">—</span>
                )
              }
            />
            {memberSince && (
              <ProfileInfoRow label="Member since" value={memberSince} />
            )}
            <div className="sm:col-span-2">
              <ProfileInfoRow
                label="Expertise"
                value={
                  expertiseList.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {expertiseList.map((item) => (
                        <span
                          key={item}
                          className="inline-flex rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )
                }
              />
            </div>
          </dl>
        )}
      </section>

      {/* Profile-level tabs: Activity vs Settings (same pattern as Dashboard tabs) */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex flex-wrap gap-4 text-sm" aria-label="Profile tabs">
          {[
            { id: "activity", label: "Activity" },
            { id: "settings", label: "Settings" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setProfileSection(tab.id as ProfileSection)}
              className={`border-b-2 px-1 pb-2 text-sm font-medium ${
                profileSection === tab.id
                  ? "border-calpoly-gold text-calpoly-green"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Settings: Notification preferences and other user config */}
      {profileSection === "settings" && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-calpoly-green">
                <Bell className="h-4 w-4 text-calpoly-gold" />
                Notification Preferences
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {isAdmin
                  ? "Control notifications about new and pending risks."
                  : "Control notifications about decisions on your submitted risks."}
              </p>
            </div>
            {prefsMessage && (
              <p className="text-xs font-medium text-calpoly-green">
                {prefsMessage}
              </p>
            )}
          </div>

          <div className="mt-4 space-y-4">
            {isAdmin ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Notify me when a new risk is submitted
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Receive a notification whenever someone submits a new risk for review.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setNotificationPrefs((prev) => ({
                        ...prev,
                        notifyNewRiskSubmitted: !prev.notifyNewRiskSubmitted,
                      }))
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      notificationPrefs.notifyNewRiskSubmitted
                        ? "bg-calpoly-green"
                        : "bg-gray-300"
                    }`}
                    role="switch"
                    aria-checked={notificationPrefs.notifyNewRiskSubmitted}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                        notificationPrefs.notifyNewRiskSubmitted
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Remind me of risks pending approval for 3+ days
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Get reminders when risks assigned to you have been waiting for approval.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setNotificationPrefs((prev) => ({
                        ...prev,
                        remindPendingApproval: !prev.remindPendingApproval,
                      }))
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      notificationPrefs.remindPendingApproval
                        ? "bg-calpoly-green"
                        : "bg-gray-300"
                    }`}
                    role="switch"
                    aria-checked={notificationPrefs.remindPendingApproval}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                        notificationPrefs.remindPendingApproval
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Weekly digest of risks with no progress
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Receive a weekly summary of risks that have not moved forward recently.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setNotificationPrefs((prev) => ({
                        ...prev,
                        weeklyDigestNoProgress: !prev.weeklyDigestNoProgress,
                      }))
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      notificationPrefs.weeklyDigestNoProgress
                        ? "bg-calpoly-green"
                        : "bg-gray-300"
                    }`}
                    role="switch"
                    aria-checked={notificationPrefs.weeklyDigestNoProgress}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                        notificationPrefs.weeklyDigestNoProgress
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Notify me when my submitted risk is approved or rejected
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Receive a notification when an admin approves or rejects your risk.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setNotificationPrefs((prev) => ({
                      ...prev,
                      notifyRiskDecision: !prev.notifyRiskDecision,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    notificationPrefs.notifyRiskDecision
                      ? "bg-calpoly-green"
                      : "bg-gray-300"
                  }`}
                  role="switch"
                  aria-checked={notificationPrefs.notifyRiskDecision}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                      notificationPrefs.notifyRiskDecision
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            )}
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => void handleSaveNotificationPrefs()}
              disabled={savingPrefs}
              className="inline-flex items-center gap-2 rounded-lg bg-calpoly-green px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
            >
              {savingPrefs ? "Saving…" : "Save Preferences"}
            </button>
          </div>
        </section>
      )}

      {/* Activity: risks I entered / approved / rejected */}
      {profileSection === "activity" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <nav className="inline-flex rounded-lg bg-gray-100 p-1" aria-label="Tabs">
            {tabs.map((tab) => (
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
                {tab.count != null && tab.count > 0 && (
                  <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="mt-6">
            {activeTab === "entered" && (
              <div className="space-y-8">
                <section className="rounded-lg border border-gray-200 border-l-4 border-l-calpoly-gold bg-gray-50/50 p-5">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-calpoly-green">
                    <Clock className="h-4 w-4 text-calpoly-gold" />
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

                <section className="rounded-lg border border-gray-200 border-l-4 border-l-calpoly-green bg-gray-50/50 p-5">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-calpoly-green">
                    <CheckCircle className="h-4 w-4 text-calpoly-green" />
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

                <section className="rounded-lg border border-gray-200 border-l-4 border-l-amber-500 bg-gray-50/50 p-5">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-calpoly-green">
                    <XCircle className="h-4 w-4 text-amber-600" />
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
                <h2 className="text-lg font-semibold text-calpoly-green">Risks you approved</h2>
                <p className="mt-1 text-sm text-gray-500">
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
                <h2 className="text-lg font-semibold text-calpoly-green">Risks you rejected</h2>
                <p className="mt-1 text-sm text-gray-500">
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
      )}

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
