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
      <div className="text-center py-16 px-8 bg-white rounded-lg border-2 border-dashed border-gray-300">
        <FolderSearch className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h2 className="text-2xl font-semibold text-gray-700">
          No Risks Logged Yet
        </h2>
        <p className="text-gray-500 mt-2">
          Click "Add New Risk" or "Load Demo" to get started.
        </p>
      </div>
    );
  }

  return (
    <main id="risk-register">
      {risks.map((risk) => (
        <RiskCard
          key={risk.id}
          risk={risk}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </main>
  );
};

export default RiskList;
