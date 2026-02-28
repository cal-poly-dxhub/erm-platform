import React, { useState, useMemo } from "react";
import { X } from "lucide-react";
import {
  likelihoods,
  impacts,
  qualitativeMatrix,
  ratingColors,
} from "@/utils/constants";
import { Risk } from "@/types";

interface HeatMapProps {
  risks: Risk[];
  onEdit: (id: string) => void;
}

type CellKey = `${number}-${number}`;

interface CellData {
  count: number;
  risks: Risk[];
}

type HeatMapData = Record<CellKey, CellData>;

const HeatMap: React.FC<HeatMapProps> = ({ risks, onEdit }) => {
  const [selectedCell, setSelectedCell] = useState<{
    likelihood: number;
    impact: number;
    data: CellData;
  } | null>(null);

  const heatMapData = useMemo(() => {
    const data = {} as HeatMapData;
    for (let i = 1; i <= 5; i++) {
      for (let l = 1; l <= 5; l++) {
        const key = `${i}-${l}` as CellKey;
        data[key] = { count: 0, risks: [] };
      }
    }
    risks.forEach((risk) => {
      if (risk.likelihood && risk.impact) {
        const key = `${risk.impact}-${risk.likelihood}` as CellKey;
        if (data[key]) {
          data[key].count++;
          data[key].risks.push(risk);
        }
      }
    });
    return data;
  }, [risks]);

  const handleCellClick = (likelihood: number, impact: number) => {
    const key = `${impact}-${likelihood}` as CellKey;
    setSelectedCell({ likelihood, impact, data: heatMapData[key] });
  };

  const clearSelection = () => {
    setSelectedCell(null);
  };

  const likelihoodText = selectedCell
    ? likelihoods.find((l) => l.value == selectedCell.likelihood)?.text
    : "";
  const impactText = selectedCell
    ? impacts.find((i) => i.value == selectedCell.impact)?.text
    : "";

  return (
    <section className="mb-8">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Risk Heat Map (Baseline)
        </h2>
        <div className="flex">
          <div className="flex flex-col-reverse justify-between text-right pr-4 text-sm font-medium text-gray-500">
            <div className="h-20 flex items-center">Very Unlikely</div>
            <div className="h-20 flex items-center">Unlikely</div>
            <div className="h-20 flex items-center">Possible</div>
            <div className="h-20 flex items-center">Likely</div>
            <div className="h-20 flex items-center">Very Likely</div>
          </div>
          <div className="grid grid-cols-5 gap-2 flex-1">
            {[5, 4, 3, 2, 1].map((l) =>
              [1, 2, 3, 4, 5].map((i) => {
                const key = `${i}-${l}` as CellKey;
                const data = heatMapData[key];
                const rating = (qualitativeMatrix as any)[l][i] as keyof typeof ratingColors;
                const colorClass =
                  data.count > 0
                    ? ratingColors[rating]
                    : "bg-gray-100 text-gray-400 border border-gray-200";
                const isSelected =
                  selectedCell?.likelihood === l && selectedCell?.impact === i;

                return (
                  <div
                    key={key}
                    className={`heat-map-cell h-20 flex items-center justify-center font-bold text-xl rounded-lg cursor-pointer ${colorClass} ${
                      isSelected ? "ring-4 ring-calpoly-gold" : ""
                    }`}
                    onClick={() => handleCellClick(l, i)}
                    title={`${data.count} risks`}
                  >
                    {data.count}
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="flex ml-auto pl-16">
          <div className="grid grid-cols-5 gap-2 flex-1 mt-2 text-center text-sm font-medium text-gray-500">
            <div>Negligible</div>
            <div>Minor</div>
            <div>Moderate</div>
            <div>Significant</div>
            <div>Severe</div>
          </div>
        </div>
      </div>

      {selectedCell && (
        <div className="mt-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">
              Risks: {likelihoodText} / {impactText}
            </h3>
            <button
              onClick={clearSelection}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="space-y-2">
            {selectedCell.data.risks.length > 0 ? (
              selectedCell.data.risks.map((risk) => (
                <div
                  key={risk.id}
                  className="p-3 bg-gray-50 rounded-md flex justify-between items-center hover:bg-gray-100"
                >
                  <div>
                    <p className="font-semibold text-gray-700">
                      {risk.riskIdNo || "No ID"}
                    </p>
                    <p className="text-sm text-gray-600">{risk.risk}</p>
                  </div>
                  <button
                    onClick={() => onEdit(risk.id)}
                    className="text-sm text-calpoly-green font-semibold"
                  >
                    View
                  </button>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No risks in this category.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default HeatMap;
