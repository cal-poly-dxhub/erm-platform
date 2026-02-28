import React from "react";
import { FolderSearch } from "lucide-react";
import RiskCard from "./RiskCard";
import { Risk } from "@/types";

interface RiskListProps {
  risks: Risk[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const RiskList: React.FC<RiskListProps> = ({ risks, onEdit, onDelete }) => {
  if (risks.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 py-12 px-6 text-center">
        <FolderSearch className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-4 font-medium text-gray-800">No risks yet</p>
        <p className="mt-1 text-sm text-gray-600">
          Use Add New Risk to get started.
        </p>
      </div>
    );
  }

  return (
    <div id="risk-register" className="flex flex-col gap-3">
      {risks.map((risk) => (
        <RiskCard
          key={risk.id}
          risk={risk}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default RiskList;
