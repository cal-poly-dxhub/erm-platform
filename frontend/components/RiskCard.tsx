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
    <div className="bg-white rounded-lg shadow-sm mb-4 p-5 border border-gray-200 transition-all hover:border-calpoly-gold hover:shadow-md">
      <div className="flex flex-col md:flex-row justify-between items-start">
        <div className="flex-grow">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-gray-500 font-medium">
              {risk.riskIdNo || "No ID"}
            </p>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${approvalBadgeClass}`}
            >
              {approvalLabel}
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            {risk.risk || "Untitled Risk"}
          </h2>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>
              <Building2 className="inline w-4 h-4 mr-1 text-gray-400" />
              {risk.collegeUnit || "-"}
            </span>
            <span className="text-gray-300">&bull;</span>
            <span>
              <UserCircle className="inline w-4 h-4 mr-1 text-gray-400" />
              {risk.owner || "-"}
            </span>
          </div>
        </div>
        <div className="flex space-x-2 mt-4 md:mt-0">
          <button
            onClick={() => onEdit(risk.id)}
            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button
            onClick={() => onDelete(risk.id)}
            className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-md"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-gray-200 pt-4">
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
          <h4 className="font-semibold mb-2 text-gray-600">Baseline Risk</h4>
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
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
          <h4 className="font-semibold mb-2 text-gray-600">Residual Risk</h4>
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
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
          <h4 className="font-semibold mb-2 text-gray-600">Status</h4>
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
