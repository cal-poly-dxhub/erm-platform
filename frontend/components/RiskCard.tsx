import React from "react";
import { Building2, UserCircle, Edit, Trash2, UserCheck } from "lucide-react";
import { getRiskData } from "@/utils/riskCalculations";
import { ratingColors } from "@/utils/constants";
import { Risk } from "@/types";

interface RiskCardProps {
  risk: Risk;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const RiskCard: React.FC<RiskCardProps> = ({ risk, onEdit, onDelete }) => {
  const baselineData = getRiskData(risk.likelihood, risk.impact);
  const residualData = getRiskData(risk.updatedLikelihood, risk.updatedImpact);
  const approvalStatus = (risk.approvalStatus || "pending").toLowerCase();
  const approvalBadgeClass =
    approvalStatus === "approved"
      ? "bg-emerald-100 text-emerald-800"
      : approvalStatus === "rejected"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";
  const approvalLabel =
    approvalStatus === "approved"
      ? "Approved"
      : approvalStatus === "rejected"
        ? "Rejected"
        : "Pending";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-calpoly-green/30">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500">
              {risk.riskIdNo || "No ID"}
            </span>
            <span
              className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${approvalBadgeClass}`}
            >
              {approvalLabel}
            </span>
          </div>
          <h2 className="mt-1 text-sm font-semibold text-calpoly-green">
            {risk.risk || "Untitled Risk"}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              {risk.collegeUnit || "—"}
            </span>
            <span className="inline-flex items-center gap-1">
              <UserCircle className="h-3.5 w-3.5 shrink-0" />
              {risk.owner || "—"}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => onEdit(risk.id)}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-calpoly-green"
            aria-label="Edit"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(risk.id)}
            className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 border-t border-gray-100 pt-3 md:grid-cols-3">
        <div className="rounded-lg bg-gray-50/80 px-3 py-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Baseline Risk</h4>
          <div className="flex justify-between items-center">
            <span className="text-sm">Rating:</span>
            <span
              className={`font-bold px-2 py-1 text-sm rounded-md ${
                ratingColors[baselineData.rating as keyof typeof ratingColors] || ""
              }`}
            >
              {baselineData.rating}
            </span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm">Score:</span>
            <span className="font-bold">{baselineData.score}</span>
          </div>
        </div>
        <div className="rounded-lg bg-gray-50/80 px-3 py-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Residual Risk</h4>
          <div className="flex justify-between items-center">
            <span className="text-sm">Rating:</span>
            <span
              className={`font-bold px-2 py-1 text-sm rounded-md ${
                ratingColors[residualData.rating as keyof typeof ratingColors] || ""
              }`}
            >
              {residualData.rating}
            </span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm">Score:</span>
            <span className="font-bold">{residualData.score}</span>
          </div>
        </div>
        <div className="rounded-lg bg-gray-50/80 px-3 py-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</h4>
          <div className="text-center">
            <span className="font-bold text-lg text-calpoly-gold">
              {risk.status || "Not Set"}
            </span>
            <div className="text-xs text-gray-500 mt-1 flex items-center justify-center">
              <UserCheck className="w-3 h-3 mr-1" />
              <span>{risk.statusPoc || "N/A"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskCard;
