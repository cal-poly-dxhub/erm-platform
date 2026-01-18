import React, { useMemo } from "react";
import { getRiskData } from "@/utils/riskCalculations";
import { ratingColors } from "@/utils/constants";
import { Risk } from "@/types";

interface AnalyticsProps {
  risks: Risk[];
}

const Analytics: React.FC<AnalyticsProps> = ({ risks }) => {
  const analytics = useMemo(() => {
    const totalRisks = risks.length;
    let high = 0,
      medium = 0;

    risks.forEach((r) => {
      const { rating } = getRiskData(r.likelihood, r.impact);
      if (rating === "High" || rating === "Med Hi") high++;
      else if (rating === "Medium") medium++;
    });

    const totalResidual = risks.reduce((acc, r) => {
      const { score } = getRiskData(r.updatedLikelihood, r.updatedImpact);
      return acc + (typeof score === "number" ? score : 0);
    }, 0);
    const avgResidual =
      risks.length > 0 ? (totalResidual / risks.length).toFixed(1) : "0";

    // Category distribution
    const categoryCounts = risks.reduce((acc, r) => {
      acc[r.riskCategory] = (acc[r.riskCategory] || 0) + 1;
      return acc;
    }, {});
    const sortedCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    // Unit distribution
    const unitCounts = risks.reduce((acc, r) => {
      const unit = r.collegeUnit || "N/A";
      acc[unit] = (acc[unit] || 0) + 1;
      return acc;
    }, {});

    // Top 5 risks
    const topRisks = [...risks]
      .sort((a, b) => {
        const scoreA = getRiskData(a.likelihood, a.impact).score;
        const scoreB = getRiskData(b.likelihood, b.impact).score;
        return (
          (typeof scoreB === "number" ? scoreB : 0) -
          (typeof scoreA === "number" ? scoreA : 0)
        );
      })
      .slice(0, 5);

    return {
      totalRisks,
      high,
      medium,
      avgResidual,
      sortedCategories,
      unitCounts,
      topRisks,
    };
  }, [risks]);

  const chartColors = ["#003831", "#B29A6C", "#f97316", "#22c55e", "#64748b"];
  const maxUnitCount = Math.max(...Object.values(analytics.unitCounts), 0);

  let totalOffset = 0;
  const donutSVG = (
    <svg viewBox="0 0 36 36" className="w-full h-full">
      <circle
        cx="18"
        cy="18"
        r="15.915"
        fill="none"
        stroke="#e6e6e6"
        strokeWidth="3"
      />
      {analytics.sortedCategories.map(([category, count], i) => {
        const percent = (count / analytics.totalRisks) * 100;
        const offset = totalOffset;
        totalOffset += percent;
        return (
          <circle
            key={category}
            cx="18"
            cy="18"
            r="15.915"
            fill="none"
            stroke={chartColors[i]}
            strokeWidth="3"
            strokeDasharray={`${percent}, 100`}
            strokeDashoffset={`-${offset}`}
          />
        );
      })}
    </svg>
  );

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Total Risks</h3>
          <p className="text-3xl font-bold text-calpoly-green mt-2">
            {analytics.totalRisks}
          </p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">High Priority</h3>
          <p className="text-3xl font-bold text-risk-high mt-2">
            {analytics.high}
          </p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Medium Priority</h3>
          <p className="text-3xl font-bold text-risk-medium mt-2">
            {analytics.medium}
          </p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">
            Avg. Residual Score
          </h3>
          <p className="text-3xl font-bold text-calpoly-green mt-2">
            {analytics.avgResidual}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            Risk Category Distribution
          </h3>
          <div className="flex items-center justify-center space-x-6">
            <div className="relative w-48 h-48">{donutSVG}</div>
            <div className="space-y-2 text-sm">
              {analytics.sortedCategories.map(([category, count], i) => (
                <div key={category} className="flex items-center">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: chartColors[i] }}
                  />
                  <span className="ml-2">
                    {category || "Uncategorized"} ({count})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="lg:col-span-3 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            Risks by College/Unit
          </h3>
          <div className="space-y-4">
            {Object.entries(analytics.unitCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([unit, count]) => {
                const percent =
                  maxUnitCount > 0 ? (count / maxUnitCount) * 100 : 0;
                return (
                  <div key={unit} className="flex items-center gap-4">
                    <span className="w-1/3 text-right text-sm text-gray-600">
                      {unit}
                    </span>
                    <div className="w-2/3 bg-gray-200 rounded-full h-6">
                      <div
                        className="chart-bar bg-calpoly-green h-6 rounded-full flex items-center justify-end pr-2 text-white text-xs"
                        style={{ width: `${percent}%` }}
                      >
                        {count}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">
          Top 5 Highest Scored Risks (Baseline)
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risk ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risk
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rating
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analytics.topRisks.map((r) => {
                const { score, rating } = getRiskData(r.likelihood, r.impact);
                return (
                  <tr key={r.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {r.riskIdNo || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {r.risk}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {r.owner || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {score}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${ratingColors[rating]}`}
                      >
                        {rating}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default Analytics;
