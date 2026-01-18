"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import RiskList from "@/components/RiskList";
import RiskModal from "@/components/RiskModal";
import HeatMap from "@/components/HeatMap";
import Analytics from "@/components/Analytics";
import { loadFromLocalStorage, saveToLocalStorage } from "@/utils/storage";
import { demoRisks } from "@/utils/constants";
import { Risk } from "@/types";

export default function Home() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [currentView, setCurrentView] = useState<"list" | "map" | "analytics">("list");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);

  const updateViewButtons = (activeView: "list" | "map" | "analytics") => {
    const views = ["list", "map", "analytics"];
    const buttonIds = {
      list: "btn-list-view",
      map: "btn-map-view",
      analytics: "btn-analytics-view",
    };

    views.forEach((view) => {
      const btn = document.getElementById(buttonIds[view]);
      if (btn) {
        const isActive = view === activeView;
        btn.classList.toggle("bg-white", isActive);
        btn.classList.toggle("shadow", isActive);
        btn.classList.toggle("text-gray-600", !isActive);
      }
    });
  };

  useEffect(() => {
    const savedRisks = loadFromLocalStorage();
    setRisks(savedRisks);

    const handleViewChange = (e: CustomEvent) => {
      setCurrentView(e.detail as "list" | "map" | "analytics");
      setTimeout(() => updateViewButtons(e.detail as "list" | "map" | "analytics"), 0);
    };

    window.addEventListener("viewChange", handleViewChange);
    setTimeout(() => updateViewButtons("list"), 0);

    return () => {
      window.removeEventListener("viewChange", handleViewChange);
    };
  }, []);

  const handleSaveRisk = (riskData: Risk) => {
    if (editingRisk) {
      setRisks((prev) => {
        const updated = prev.map((r) =>
          r.id === editingRisk.id ? { ...r, ...riskData } : r
        );
        saveToLocalStorage(updated);
        return updated;
      });
    } else {
      setRisks((prev) => {
        const updated = [...prev, riskData];
        saveToLocalStorage(updated);
        return updated;
      });
    }
    setEditingRisk(null);
  };

  const handleEditRisk = (id: string) => {
    const risk = risks.find((r) => r.id === id);
    setEditingRisk(risk);
    setIsModalOpen(true);
  };

  const handleDeleteRisk = (id: string) => {
    if (confirm("Are you sure you want to delete this risk?")) {
      setRisks((prev) => {
        const updated = prev.filter((r) => r.id !== id);
        saveToLocalStorage(updated);
        return updated;
      });
    }
  };

  const handleLoadDemo = () => {
    setRisks(demoRisks);
    saveToLocalStorage(demoRisks);
  };

  const handleAddNew = () => {
    setEditingRisk(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRisk(null);
  };

  return (
    <div className="bg-gray-100 text-gray-800">
      <div className="container mx-auto p-4 md:p-8">
        <Header onLoadDemo={handleLoadDemo} onAddNew={handleAddNew} />

        {currentView === "list" && (
          <RiskList
            risks={risks}
            onEdit={handleEditRisk}
            onDelete={handleDeleteRisk}
          />
        )}

        {currentView === "map" && (
          <HeatMap risks={risks} onEdit={handleEditRisk} />
        )}

        {currentView === "analytics" && <Analytics risks={risks} />}

        <RiskModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          risk={editingRisk}
          onSave={handleSaveRisk}
        />
      </div>
    </div>
  );
}

