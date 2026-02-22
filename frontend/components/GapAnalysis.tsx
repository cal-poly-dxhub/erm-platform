import React, { useState } from "react";

/** Prefill for opening the risk form from gap analysis (unit/college, department, optional risk text). */
export type GapRiskPrefill = {
  orgType: "college" | "unit";
  college: string;
  unit: string;
  collegeUnit: string;
  department: string;
  risk?: string;
  riskAnalysis?: string;
};

const COLLEGE_OPTIONS = [
  { value: "cafes", label: "College of Agriculture, Food & Env. Sciences (CAFES)" },
  { value: "caed", label: "College of Architecture & Env. Design (CAED)" },
  { value: "ocob", label: "Orfalea College of Business (OCOB)" },
  { value: "ceng", label: "College of Engineering (CENG)" },
  { value: "cla", label: "College of Liberal Arts (CLA)" },
  { value: "bcsm", label: "Bailey College of Science & Mathematics (BCSM)" },
  { value: "cpace", label: "Extended, Professional & Continuing Education" },
];

const UNIT_OPTIONS = [
  { value: "academic_affairs", label: "Academic Affairs" },
  { value: "admin_finance", label: "Administration & Finance" },
  { value: "student_affairs", label: "Student Affairs" },
  { value: "diversity", label: "Diversity & Inclusion (OUDI)" },
  { value: "research", label: "Research & Graduate Programs" },
  { value: "its", label: "Information Technology Services (ITS)" },
  { value: "facilities", label: "Facilities Management & Development" },
  { value: "public_safety", label: "Public Safety / University Police" },
  { value: "partners", label: "Cal Poly Partners (Corporation)" },
  { value: "advancement", label: "University Development & Alumni Engagement" },
  { value: "marketing", label: "University Communications & Marketing" },
];

type GapRisk = {
  risk?: string;
  description?: string;
};

type GapAnalysisProps = {
  onOpenAddRisk?: (prefill: GapRiskPrefill) => void;
};

const GapAnalysis: React.FC<GapAnalysisProps> = ({ onOpenAddRisk }) => {
  const [orgType, setOrgType] = useState<"college" | "unit">("college");
  const [college, setCollege] = useState("");
  const [unit, setUnit] = useState("");
  const [department, setDepartment] = useState("");
  const [risks, setRisks] = useState<GapRisk[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedOrgValue = orgType === "college" ? college : unit;

  const getPrefill = (item?: GapRisk): GapRiskPrefill => ({
    orgType,
    college: orgType === "college" ? selectedOrgValue : "",
    unit: orgType === "unit" ? selectedOrgValue : "",
    collegeUnit: selectedOrgValue,
    department,
    risk: item?.risk,
    riskAnalysis: item?.description,
  });

  const runGapAnalysis = async () => {
    if (!selectedOrgValue.trim()) {
      setMessage(
        orgType === "college"
          ? "Please select a college."
          : "Please select a unit."
      );
      setRisks([]);
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/gap-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          unit: selectedOrgValue.trim(),
          orgType,
          department: department.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data?.error || `Gap analysis failed (${response.status})`);
        setRisks([]);
        return;
      }

      const normalized =
        data && typeof data.body === "string" ? JSON.parse(data.body) : data;
      const list = Array.isArray(normalized?.gap_risks?.risks)
        ? normalized.gap_risks.risks
        : [];
      setRisks(list);
      if (list.length === 0) {
        setMessage("No gap analysis risks were returned.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to run gap analysis",
      );
      setRisks([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold text-gray-800">Gap Analysis</h2>
      <p className="mt-2 text-sm text-gray-500">
        Select a college or unit, optionally enter a department, then run gap analysis.
      </p>

      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          <span className="text-sm font-medium text-gray-700">Scope:</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="gapOrgType"
              checked={orgType === "college"}
              onChange={() => setOrgType("college")}
              className="text-calpoly-green focus:ring-calpoly-gold"
            />
            <span className="text-gray-800">Academic College</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="gapOrgType"
              checked={orgType === "unit"}
              onChange={() => setOrgType("unit")}
              className="text-calpoly-green focus:ring-calpoly-gold"
            />
            <span className="text-gray-800">Administrative Unit</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {orgType === "college" ? "College" : "Unit"}
          </label>
          {orgType === "college" ? (
            <select
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
            >
              <option value="">-- Select College --</option>
              {COLLEGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
            >
              <option value="">-- Select Unit --</option>
              {UNIT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Department <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runGapAnalysis();
            }}
            placeholder="e.g. Computer Science"
            className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
          />
        </div>

        <div>
          <button
            type="button"
            onClick={runGapAnalysis}
            disabled={loading}
            className="rounded-md bg-calpoly-green px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
          >
            {loading ? "Running..." : "Run Gap Analysis"}
          </button>
        </div>
      </div>

      {message && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {message}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {risks.map((item, index) => (
          <div
            key={`${item.risk || "risk"}-${index}`}
            className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800">
                {item.risk || "Untitled Risk"}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {item.description || "--"}
              </p>
            </div>
            {onOpenAddRisk && (
              <button
                type="button"
                onClick={() => onOpenAddRisk(getPrefill(item))}
                className="shrink-0 self-start rounded-md border border-calpoly-green/60 bg-white px-3 py-1.5 text-xs font-semibold text-calpoly-green transition hover:bg-calpoly-green/5 sm:self-center"
              >
                Add as risk
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default GapAnalysis;
