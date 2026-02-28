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
      <div className="rounded-lg border border-dashed border-gray-200 bg-white py-12 px-6 text-center">
        <FolderSearch className="mx-auto h-12 w-12 text-gray-300" />
        <h2 className="mt-4 text-lg font-semibold text-gray-700">
          No risks yet
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Use Add New Risk to get started.
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
