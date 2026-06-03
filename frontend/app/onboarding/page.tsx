"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { extractUserProfile } from "@/lib/api/userProfile";
import { formatExpertiseForEdit } from "@/utils/expertise";

/** Split typed expertise into TEXT[] (comma, semicolon, or newline). */
function parseExpertiseText(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type UserProfile = {
  college?: string | null;
  unit?: string | null;
  department?: string | null;
  expertise?: unknown;
};

function prefillFromProfile(profile: UserProfile) {
  const hasCollege = Boolean(profile.college);
  const hasUnit = Boolean(profile.unit);
  return {
    orgType: hasUnit && !hasCollege ? ("unit" as const) : ("college" as const),
    college: profile.college ?? "",
    unit: profile.unit ?? "",
    department: profile.department ?? "",
    expertiseText: formatExpertiseForEdit(profile.expertise),
  };
}

function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEdit = searchParams.get("edit") === "1";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [displayEmail, setDisplayEmail] = useState("");
  const [orgType, setOrgType] = useState<"college" | "unit">("college");
  const [college, setCollege] = useState("");
  const [unit, setUnit] = useState("");
  const [department, setDepartment] = useState("");
  const [expertiseText, setExpertiseText] = useState("");

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        if (meRes.status === 401) {
          window.location.href = `/login?returnTo=${encodeURIComponent(
            isEdit ? "/onboarding?edit=1" : "/onboarding",
          )}`;
          return;
        }
        const meData = await meRes.json().catch(() => ({}));
        const user = meData?.user;
        if (!cancelled && user) {
          setDisplayName(user.name || "");
          setDisplayEmail(user.email || "");
        }

        const profileRes = await fetch("/api/users/profile", {
          credentials: "include",
        });
        if (profileRes.ok) {
          const profile = await profileRes.json().catch(() => ({}));
          const parsed = extractUserProfile(profile, {
            email: user?.email,
            name: user?.name,
            sub: user?.sub,
          });
          if (parsed && !cancelled) {
            if (!isEdit) {
              router.replace("/dashboard");
              return;
            }
            const filled = prefillFromProfile(parsed);
            setOrgType(filled.orgType);
            setCollege(filled.college);
            setUnit(filled.unit);
            setDepartment(filled.department);
            setExpertiseText(filled.expertiseText);
          }
        }
      } catch {
        if (!cancelled) setError("Could not load your session.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [router, isEdit]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const collegeValue =
      orgType === "college" && college ? college : null;
    const unitValue = orgType === "unit" && unit ? unit : null;

    setSaving(true);
    try {
      const res = await fetch("/api/users/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          college: collegeValue,
          unit: unitValue,
          department: department.trim() || null,
          expertise: parseExpertiseText(expertiseText),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not save profile.");
        return;
      }
      router.replace(isEdit ? "/profile" : "/dashboard");
    } catch {
      setError("Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-600">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-calpoly-gold">
          {isEdit ? "Profile" : "Welcome"}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-calpoly-green">
          {isEdit ? "Edit your profile" : "Complete your profile"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isEdit
            ? "Update your organization and expertise."
            : "This helps us match you to relevant risks."}
        </p>
        {(displayName || displayEmail) && (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
            {displayName && (
              <p>
                <span className="text-gray-500">Name</span>{" "}
                <span className="font-medium text-gray-900">{displayName}</span>
              </p>
            )}
            {displayEmail && (
              <p className={displayName ? "mt-1" : ""}>
                <span className="text-gray-500">Email</span>{" "}
                <span className="font-medium text-gray-900">{displayEmail}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Organization scope{" "}
            <span className="font-normal text-gray-500">(optional)</span>
          </p>
          <div className="flex flex-wrap gap-4 mb-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={orgType === "college"}
                onChange={() => setOrgType("college")}
              />
              Academic college
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={orgType === "unit"}
                onChange={() => setOrgType("unit")}
              />
              Administrative unit
            </label>
          </div>
          {orgType === "college" ? (
            <select
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— Select college —</option>
              <option value="cafes">College of Agriculture, Food & Env. Sciences (CAFES)</option>
              <option value="caed">College of Architecture & Env. Design (CAED)</option>
              <option value="ocob">Orfalea College of Business (OCOB)</option>
              <option value="ceng">College of Engineering (CENG)</option>
              <option value="cla">College of Liberal Arts (CLA)</option>
              <option value="bcsm">Bailey College of Science & Mathematics (BCSM)</option>
              <option value="cpace">Extended, Professional & Continuing Education</option>
            </select>
          ) : (
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— Select unit —</option>
              <option value="academic_affairs">Academic Affairs</option>
              <option value="admin_finance">Administration & Finance</option>
              <option value="student_affairs">Student Affairs</option>
              <option value="diversity">Diversity & Inclusion (OUDI)</option>
              <option value="research">Research & Graduate Programs</option>
              <option value="its">Information Technology Services (ITS)</option>
              <option value="facilities">Facilities Management & Development</option>
              <option value="public_safety">Public Safety / University Police</option>
              <option value="partners">Cal Poly Partners (Corporation)</option>
              <option value="advancement">University Development & Alumni Engagement</option>
              <option value="marketing">University Communications & Marketing</option>
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Department{" "}
            <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <input
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="e.g. ITS, Facilities, Ag Business"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Expertise{" "}
            <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <textarea
            value={expertiseText}
            onChange={(e) => setExpertiseText(e.target.value)}
            rows={4}
            placeholder="e.g. cybersecurity, facilities, enrollment (comma-separated)"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {isEdit && (
            <button
              type="button"
              onClick={() => router.push("/profile")}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-calpoly-green px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Continue to dashboard"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-600">
          Loading…
        </div>
      }
    >
      <OnboardingForm />
    </Suspense>
  );
}
