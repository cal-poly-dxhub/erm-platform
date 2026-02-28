import React, { useState } from "react";
import { HelpCircle, Search, CheckCircle2, AlertCircle, Play } from "lucide-react";

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
  const [showHelp, setShowHelp] = useState(false);

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
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      {/* Section header and help */}
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-lg font-semibold text-calpoly-green flex items-center">
          <Search className="w-5 h-5 mr-2 text-calpoly-gold" />
          Identify Risks
        </h2>
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <HelpCircle className="w-4 h-4 mr-1" />
          {showHelp ? "Hide info" : "What is this?"}
        </button>
      </div>

      {showHelp && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-semibold text-gray-900 mb-2">How Gap Analysis works</p>
          <p className="mb-3">
            This tool compares your department or unit against standards and historical risk data to surface potential blind spots—risks you may not have logged yet.
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-calpoly-green shrink-0 mt-0.5" />
              <span><strong>Step 1:</strong> Select an academic college or administrative unit.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-calpoly-green shrink-0 mt-0.5" />
              <span><strong>Step 2:</strong> Click &quot;Run Gap Analysis&quot; to generate suggested risks for your selection.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-calpoly-green shrink-0 mt-0.5" />
              <span><strong>Step 3:</strong> Review results and use &quot;Add to Register&quot; to pre-fill a new risk form when a suggestion applies.</span>
            </li>
          </ul>
        </div>
      )}

      <div className="space-y-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Scope</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="gapOrgType"
              checked={orgType === "college"}
              onChange={() => setOrgType("college")}
              className="text-calpoly-green focus:ring-calpoly-gold w-4 h-4"
            />
            <span className="text-gray-800 font-medium">Academic College</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="gapOrgType"
              checked={orgType === "unit"}
              onChange={() => setOrgType("unit")}
              className="text-calpoly-green focus:ring-calpoly-gold w-4 h-4"
            />
            <span className="text-gray-800 font-medium">Administrative Unit</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              {orgType === "college" ? "Select College" : "Select Unit"} <span className="text-red-500">*</span>
            </label>
            {orgType === "college" ? (
              <select
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
              >
                <option value="">-- Choose... --</option>
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
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
              >
                <option value="">-- Choose... --</option>
                {UNIT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Department <span className="text-gray-400 font-normal">(Optional context)</span>
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runGapAnalysis();
              }}
              placeholder="e.g. Civil Engineering"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={runGapAnalysis}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-lg bg-calpoly-gold px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Analyzing…
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Gap Analysis
              </>
            )}
          </button>
        </div>
      </div>

      {message && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {message}
        </div>
      )}

      {risks.length > 0 && (
        <div className="mt-6 border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-calpoly-green mb-4">Suggested risk areas</h3>
          <div className="grid gap-3">
            {risks.map((item, index) => (
              <div
                key={`${item.risk || "risk"}-${index}`}
                className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-gray-900">
                    {item.risk || "Untitled Risk"}
                  </p>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                    {item.description || "--"}
                  </p>
                </div>
                {onOpenAddRisk && (
                  <button
                    type="button"
                    onClick={() => onOpenAddRisk(getPrefill(item))}
                    className="shrink-0 w-full sm:w-auto text-center rounded-lg border-2 border-calpoly-green bg-white px-4 py-2 text-sm font-bold text-calpoly-green transition hover:bg-calpoly-green hover:text-white"
                  >
                    Add to Register
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default GapAnalysis;