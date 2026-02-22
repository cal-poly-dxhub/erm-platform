import React, { useState } from "react";

type GapRisk = {
  risk?: string;
  description?: string;
};

const GapAnalysis: React.FC = () => {
  const [department, setDepartment] = useState("");
  const [risks, setRisks] = useState<GapRisk[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const runGapAnalysis = async () => {
    const trimmed = department.trim();
    if (!trimmed) {
      setMessage("Please enter a department.");
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
        body: JSON.stringify({ department: trimmed }),
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
        Enter a department to retrieve gap-analysis risks.
      </p>

      <div className="mt-4 flex flex-col gap-3 md:flex-row">
        <input
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              runGapAnalysis();
            }
          }}
          placeholder="Department"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-calpoly-gold focus:outline-none focus:ring-2 focus:ring-calpoly-gold/30"
        />
        <button
          type="button"
          onClick={runGapAnalysis}
          disabled={loading}
          className="rounded-md bg-calpoly-green px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Running..." : "Run"}
        </button>
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
            className="rounded-lg border border-gray-200 bg-gray-50 p-4"
          >
            <p className="text-sm font-semibold text-gray-800">
              {item.risk || "Untitled Risk"}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              {item.description || "--"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default GapAnalysis;
