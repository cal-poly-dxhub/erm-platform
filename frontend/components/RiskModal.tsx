import React, { useState, useEffect, useRef } from "react";
import { X, Sparkles, HelpCircle, ShieldAlert, Lock } from "lucide-react";
import {
  likelihoods,
  impacts,
  riskCategories,
  statuses,
  ratingColors,
} from "@/utils/constants";
import { getRiskData } from "@/utils/riskCalculations";
import { analyzeTextForSuggestions } from "@/utils/aiSuggestions";
import { generateMitigationSteps } from "@/utils/gemini";
import { assessRisk } from "@/utils/lambdaApi";
import { generateMitigationStrategies, MitigationStrategy } from "@/utils/mitigationApi";
import { Risk } from "@/types";

interface RiskModalProps {
  isOpen: boolean;
  onClose: () => void;
  risk: Risk | null;
  onSave: (riskData: Risk) => void;
}

const RiskModal: React.FC<RiskModalProps> = ({ isOpen, onClose, risk, onSave }) => {
  const [formData, setFormData] = useState({
    riskIdNo: "",
    
    // Organization Scope
    orgType: "college", 
    college: "",
    unit: "",
    department: "",
    isCollegeWide: false,
    
    owner: "",
    risk: "",
    riskAnalysis: "",
    currentControls: "",
    likelihood: "",
    impact: "",
    additionalControls: "",
    updatedLikelihood: "",
    updatedImpact: "",
    
    // Status Logic
    status: "",
    statusTolerance: "",
    statusPoc: "",
    riskCategory: "",
    
    // NEW: Risk Tolerance Logic
    departmentRiskTolerance: "",
    
    // Resource Buckets (Section 4 - Optional)
    resourceInternalFTE: "",
    resourceExternal: "",
    resourceFunding: "",
    resourcesNeeded: "", 
    
    // Comments
    leadershipComments: "",
    ermComments: "",
    ehsComments: "", 
    
    // Privacy Flags
    isPrivate: false,
    isAttorneyClientPrivilege: false,
  });

  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mitigationStrategies, setMitigationStrategies] = useState<MitigationStrategy[]>([]);
  const [lambdaSuggestion, setLambdaSuggestion] = useState<{
    category?: string;
    likelihood?: number;
    impact?: number;
    notes?: string;
    similar?: { merged: boolean; risk_ids: string[] };
  } | null>(null);
  const [isLoadingLambda, setIsLoadingLambda] = useState(false);
  const [lambdaError, setLambdaError] = useState<string | null>(null);
  const lambdaCallTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [baselineData, setBaselineData] = useState({
    score: "-",
    rating: "-",
    response: "-",
  });
  const [residualData, setResidualData] = useState({
    score: "-",
    rating: "-",
    response: "-",
  });
  const [uiMessage, setUiMessage] = useState<string | null>(null);

  useEffect(() => {
    if (risk) {
      setFormData({
        riskIdNo: risk.riskIdNo || "",
        orgType: risk.orgType || "college",
        college: risk.college || risk.collegeUnit || "",
        unit: risk.unit || risk.collegeUnit || "",
        department: risk.department || "",
        isCollegeWide: risk.isCollegeWide || false,
        owner: risk.owner || "",
        risk: risk.risk || "",
        riskAnalysis: risk.riskAnalysis || "",
        currentControls: risk.currentControls || "",
        likelihood: risk.likelihood || "",
        impact: risk.impact || "",
        additionalControls: risk.additionalControls || "",
        updatedLikelihood: risk.updatedLikelihood || "",
        updatedImpact: risk.updatedImpact || "",
        status: risk.status || "",
        statusTolerance: risk.statusTolerance || "",
        statusPoc: risk.statusPoc || "",
        riskCategory: risk.riskCategory || "",
        departmentRiskTolerance: risk.departmentRiskTolerance || "", // Hydrate new field
        resourceInternalFTE: risk.resourceInternalFTE || "",
        resourceExternal: risk.resourceExternal || "",
        resourceFunding: risk.resourceFunding || "",
        resourcesNeeded: risk.resourcesNeeded || "",
        leadershipComments: risk.leadershipComments || "",
        ermComments: risk.ermComments || "",
        ehsComments: risk.ehsComments || "",
        isPrivate: risk.isPrivate || false,
        isAttorneyClientPrivilege: risk.isAttorneyClientPrivilege || false,
      });
    } else {
      setFormData({
        riskIdNo: "",
        orgType: "college",
        college: "",
        unit: "",
        department: "",
        isCollegeWide: false,
        owner: "",
        risk: "",
        riskAnalysis: "",
        currentControls: "",
        likelihood: "",
        impact: "",
        additionalControls: "",
        updatedLikelihood: "",
        updatedImpact: "",
        status: "",
        statusTolerance: "",
        statusPoc: "",
        riskCategory: "",
        departmentRiskTolerance: "", // Reset new field
        resourceInternalFTE: "",
        resourceExternal: "",
        resourceFunding: "",
        resourcesNeeded: "",
        leadershipComments: "",
        ermComments: "",
        ehsComments: "",
        isPrivate: false,
        isAttorneyClientPrivilege: false,
      });
    }
    setAiSuggestion(null);
    setLambdaSuggestion(null);
    setLambdaError(null);
    setUiMessage(null);
  }, [risk, isOpen]);

  useEffect(() => {
    if (isOpen) {
      updateCalculations();
    }
  }, [
    formData.likelihood,
    formData.impact,
    formData.updatedLikelihood,
    formData.updatedImpact,
    isOpen,
  ]);

  useEffect(() => {
    const suggestion = analyzeTextForSuggestions(
      formData.risk,
      formData.riskAnalysis
    );
    setAiSuggestion(suggestion);
  }, [formData.risk, formData.riskAnalysis]);

  // Call Lambda to get category suggestion
  useEffect(() => {
    if (!isOpen) return;
    if (lambdaCallTimeoutRef.current) clearTimeout(lambdaCallTimeoutRef.current);

    if (formData.department && formData.risk && formData.riskAnalysis) {
      lambdaCallTimeoutRef.current = setTimeout(async () => {
        setIsLoadingLambda(true);
        setLambdaError(null);
        try {
          const response = await assessRisk(
            formData.department,
            formData.risk,
            formData.riskAnalysis
          );
          setLambdaSuggestion((prev) => ({
            ...prev,
            category: response.category,
            notes: response.notes,
            similar: response.similar,
          }));
          if (response.category && !formData.riskCategory) {
            setFormData((prev) => ({ ...prev, riskCategory: response.category || "" }));
          }
        } catch (error) {
          setLambdaError(error instanceof Error ? error.message : "Failed to get suggestions");
        } finally {
          setIsLoadingLambda(false);
        }
      }, 1000);
    }
    return () => {
      if (lambdaCallTimeoutRef.current) clearTimeout(lambdaCallTimeoutRef.current);
    };
  }, [formData.department, formData.risk, formData.riskAnalysis, isOpen, formData.riskCategory]);

  // Call Lambda to get baseline likelihood and impact
  useEffect(() => {
    if (!isOpen) return;
    if (lambdaCallTimeoutRef.current) clearTimeout(lambdaCallTimeoutRef.current);

    if (
      formData.department &&
      formData.risk &&
      formData.riskAnalysis &&
      formData.currentControls
    ) {
      lambdaCallTimeoutRef.current = setTimeout(async () => {
        setIsLoadingLambda(true);
        setLambdaError(null);
        try {
          const response = await assessRisk(
            formData.department,
            formData.risk,
            formData.riskAnalysis,
            formData.currentControls
          );
          setLambdaSuggestion((prev) => ({
            ...prev,
            category: response.category || prev?.category,
            likelihood: response.likelihood,
            impact: response.impact,
            notes: response.notes,
            similar: response.similar,
          }));
          if (response.likelihood !== undefined && response.likelihood !== null) {
            setFormData((prev) => ({ ...prev, likelihood: String(response.likelihood) }));
          }
          if (response.impact !== undefined && response.impact !== null) {
            setFormData((prev) => ({ ...prev, impact: String(response.impact) }));
          }
          if (response.category && !formData.riskCategory) {
            setFormData((prev) => ({ ...prev, riskCategory: response.category || "" }));
          }
        } catch (error) {
          setLambdaError(error instanceof Error ? error.message : "Failed to get risk assessment");
        } finally {
          setIsLoadingLambda(false);
        }
      }, 1000);
    }
    return () => {
      if (lambdaCallTimeoutRef.current) clearTimeout(lambdaCallTimeoutRef.current);
    };
  }, [formData.department, formData.risk, formData.riskAnalysis, formData.currentControls, isOpen]);

  const updateCalculations = () => {
    setBaselineData(getRiskData(formData.likelihood, formData.impact));
    setResidualData(
      getRiskData(formData.updatedLikelihood, formData.updatedImpact)
    );
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const idStr = risk?.id ?? "";
    const isNewRisk =
      idStr === "new" ||
      idStr === "" ||
      !/^\d+$/.test(String(idStr)) ||
      Number(idStr) <= 0;
    const payload = {
      ...formData,
      id: isNewRisk ? undefined : risk?.id,
      action: isNewRisk ? "create" : "update",
      approvalStatus: risk?.approvalStatus || "pending",
      riskIdNo: formData.riskIdNo || risk?.riskIdNo || "",
    };
    try {
      const res = await fetch("/api/store-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setUiMessage(data?.error || `Failed to save risk: ${res.status}`);
        return;
      }
      onSave({ ...formData, id: payload.id } as Risk);
      onClose();
    } catch (err) {
      setUiMessage(err instanceof Error ? err.message : "Failed to save risk");
    }
  };

  const applySuggestion = (field, value) => {
    handleChange(field, value);
  };

  const handleGenerateMitigation = async () => {
    if (!formData.risk || !formData.riskAnalysis || !formData.currentControls || !formData.riskCategory) {
      setUiMessage("Please fill in Risk, Analysis, Controls, and Category first.");
      return;
    }
    if (!formData.likelihood || !formData.impact) {
      setUiMessage("Please set baseline Likelihood and Impact first.");
      return;
    }

    setIsGenerating(true);
    setUiMessage(null);
    try {
      const baselineScore = baselineData.score === "-" ? 0 : Number(baselineData.score);
      const response = await generateMitigationStrategies(
        formData.risk,
        formData.department || formData.college || formData.unit,
        formData.riskAnalysis,
        formData.currentControls,
        formData.riskCategory,
        formData.likelihood,
        formData.impact,
        baselineScore
      );
      const strategies = response.strategies || [];
      setMitigationStrategies(strategies);

      if (strategies.length === 0) {
        setUiMessage("No strategies were generated.");
        return;
      }

      const strategiesText = strategies
        .map((strategy, index) => {
          const typeLabel = strategy.type === "Preventative" ? "Preventative" : 
                           strategy.type === "Detective" ? "Detective" : "Corrective";
          return `${index + 1}. [${typeLabel}] ${strategy.title}\n   ${strategy.description}\n   Urgency: ${strategy.urgency}`;
        })
        .join("\n\n");

      handleChange("additionalControls", strategiesText);

      if (response.residual_risk) {
        if (response.residual_risk.updated_likelihood) {
          setFormData((prev) => ({ ...prev, updatedLikelihood: String(response.residual_risk.updated_likelihood) }));
        }
        if (response.residual_risk.updated_impact) {
          setFormData((prev) => ({ ...prev, updatedImpact: String(response.residual_risk.updated_impact) }));
        }
      }
    } catch (error) {
      console.error("Error generating strategies:", error);
      setUiMessage(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const impactTooltipContent = `
    <div>
      <strong class="block text-calpoly-gold mb-2">Impact Definitions</strong>
      ${impacts
        .map(
          (imp) => `
        <div class="mb-2">
          <strong class="text-white">${imp.text}:</strong>
          <ul>
            <li class="ml-2 text-gray-300"><strong>Operations:</strong> ${imp.details.ops}</li>
            <li class="ml-2 text-gray-300"><strong>Reputation:</strong> ${imp.details.rep}</li>
            <li class="ml-2 text-gray-300"><strong>Legal:</strong> ${imp.details.legal}</li>
            <li class="ml-2 text-gray-300"><strong>People:</strong> ${imp.details.people}</li>
          </ul>
        </div>
      `
        )
        .join("")}
    </div>
  `;

  if (!isOpen) return null;

  return (
    <>
      <div
        className="modal-backdrop"
        style={{ display: "block" }}
        onClick={onClose}
      />
      <div
        className="modal w-full max-w-6xl bg-white rounded-lg shadow-2xl border border-gray-200"
        style={{ display: "block" }}
      >
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex justify-between items-center pb-3 border-b border-gray-200">
            <h3 className="text-2xl font-semibold text-calpoly-green">
              {risk
                ? `Edit Risk: ${risk.riskIdNo || "Untitled"}`
                : "Add New Risk"}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          {uiMessage && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {uiMessage}
            </div>
          )}

          <div className="mt-4 max-h-[75vh] overflow-y-auto pr-4">
            
            {/* --- Section 1: Risk Identification & Context --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="col-span-full text-lg font-semibold text-calpoly-gold mb-2">
                1. Risk Identification & Context
              </h4>
              
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Risk ID No. <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.riskIdNo}
                  onChange={(e) => handleChange("riskIdNo", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
              </div>

              {/* ORGANIZATION SCOPE SELECTOR */}
              <div className="col-span-full md:col-span-3 bg-white p-3 rounded border border-gray-200">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Organization Scope <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-4 items-center">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="orgType"
                      value="college"
                      checked={formData.orgType === "college"}
                      onChange={(e) => handleChange("orgType", e.target.value)}
                      className="text-calpoly-green focus:ring-calpoly-gold"
                    />
                    <span className="text-gray-900 font-medium">Academic College</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="orgType"
                      value="unit"
                      checked={formData.orgType === "unit"}
                      onChange={(e) => handleChange("orgType", e.target.value)}
                      className="text-calpoly-green focus:ring-calpoly-gold"
                    />
                    <span className="text-gray-900 font-medium">Administrative Unit</span>
                  </label>
                  
                  {/* Conditional Dropdowns */}
                  <div className="flex-grow">
                    {formData.orgType === "college" ? (
                      <select
                        required
                        value={formData.college}
                        onChange={(e) => handleChange("college", e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-1"
                      >
                        <option value="">-- Select College --</option>
                        <option value="cafes">College of Agriculture, Food & Env. Sciences (CAFES)</option>
                        <option value="caed">College of Architecture & Env. Design (CAED)</option>
                        <option value="ocob">Orfalea College of Business (OCOB)</option>
                        <option value="ceng">College of Engineering (CENG)</option>
                        <option value="cla">College of Liberal Arts (CLA)</option>
                        <option value="bcsm">Bailey College of Science & Mathematics (BCSM)</option>
                        <option value="cpace">Extended, Professional & Continuing Education</option>
                      </select>
                    ) : (
                      <select
                        required
                        value={formData.unit}
                        onChange={(e) => handleChange("unit", e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-1"
                      >
                        <option value="">-- Select Unit --</option>
                        <option value="academic_affairs">Academic Affairs</option>
                        <option value="admin_finance">Administration & Finance</option>
                        <option value="student_affairs">Student Affairs</option>
                        <option value="diversity">Diversity & Inclusion (OUDI)</option>
                        <option value="research">Research & Graduate Programs</option>
                        <option value="its">Information Technology Services (ITS)</option>
                        <option value="facilities">Facilities Management & Development</option>
                        <option value="public_safety">Public Safety / University Police</option>
                        <option value="partners">Cal Poly Partners (Corporation)</option>
                        <option value="advancement">University Development & Alumni Engagement</option>
                        <option value="marketing">University Communications & Marketing</option>
                      </select>
                    )}
                  </div>
                </div>
                
                {/* Cross Pollination Checkbox */}
                <div className="mt-2 flex items-center">
                  <input
                    type="checkbox"
                    id="isCollegeWide"
                    checked={formData.isCollegeWide}
                    onChange={(e) => handleChange("isCollegeWide", e.target.checked)}
                    className="h-4 w-4 text-calpoly-gold rounded border-gray-300 focus:ring-calpoly-green"
                  />
                  <label htmlFor="isCollegeWide" className="ml-2 text-xs font-semibold text-gray-600">
                    This risk applies <span className="text-calpoly-green uppercase">College-Wide</span> or impacts other Units.
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Specific Department <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.department}
                  onChange={(e) => handleChange("department", e.target.value)}
                  placeholder="e.g. Civil Engineering"
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Owner <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.owner}
                  onChange={(e) => handleChange("owner", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
              </div>
              
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Risk Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows="3"
                  required
                  value={formData.risk}
                  onChange={(e) => handleChange("risk", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
              </div>
              
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Risk Analysis <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows="3"
                  required
                  value={formData.riskAnalysis}
                  onChange={(e) => handleChange("riskAnalysis", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
              </div>

              {/* AI Suggestions Display */}
              {(aiSuggestion || lambdaSuggestion) && (
                <div className="col-span-full mt-2 p-3 bg-calpoly-green/5 border-l-4 border-calpoly-green rounded-r-lg">
                  <div className="flex items-center">
                    <Sparkles className="w-5 h-5 mr-2 text-calpoly-gold" />
                    <h5 className="font-semibold text-calpoly-green">AI Suggestions</h5>
                  </div>
                  <div className="text-sm mt-2 text-gray-700 pl-7">
                    {(lambdaSuggestion?.category || aiSuggestion?.category) && (
                       <p className="mb-1">
                         <strong>Category:</strong> {lambdaSuggestion?.category || aiSuggestion?.category}
                       </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* --- Section 2: Baseline Risk Assessment --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="col-span-full text-lg font-semibold text-calpoly-gold mb-2">
                2. Baseline Risk Assessment
              </h4>
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Current Control Measures <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows="3"
                  required
                  value={formData.currentControls}
                  onChange={(e) =>
                    handleChange("currentControls", e.target.value)
                  }
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
                {isLoadingLambda && (
                  <p className="text-xs text-blue-600 mt-1">Analyzing controls...</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Likelihood <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.likelihood}
                  onChange={(e) => handleChange("likelihood", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                >
                  <option value="">Select Likelihood</option>
                  {likelihoods.map((l) => (
                    <option key={l.value} value={l.value}>{l.text}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center">
                  Impact <span className="text-red-500">*</span>
                  <span className="tooltip ml-2">
                    <HelpCircle className="w-4 h-4 text-gray-400" />
                    <span className="tooltiptext" dangerouslySetInnerHTML={{ __html: impactTooltipContent }} />
                  </span>
                </label>
                <select
                  required
                  value={formData.impact}
                  onChange={(e) => handleChange("impact", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                >
                  <option value="">Select Impact</option>
                  {impacts.map((i) => (
                    <option key={i.value} value={i.value}>{i.text}</option>
                  ))}
                </select>
              </div>

              {/* Score Display */}
              <div className="col-span-2 grid grid-cols-3 gap-4 bg-white p-3 rounded-lg border border-gray-200">
                <div className="text-center">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Rating</label>
                  <div className={`font-bold text-lg p-2 rounded-md ${ratingColors[baselineData.rating] || "bg-gray-100 text-gray-800"}`}>
                    {baselineData.rating}
                  </div>
                </div>
                <div className="text-center">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Score</label>
                  <div className={`font-bold text-lg p-2 rounded-md ${ratingColors[baselineData.rating] || "bg-gray-100 text-gray-800"}`}>
                    {baselineData.score}
                  </div>
                </div>
                <div className="text-center">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Response</label>
                  <div className="font-semibold text-md p-2 rounded-md bg-gray-100 text-gray-800">
                    {baselineData.response}
                  </div>
                </div>
              </div>
            </div>

            {/* --- Section 3: Residual Risk Assessment --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="col-span-full flex justify-between items-center mb-2">
                <h4 className="text-lg font-semibold text-calpoly-gold">
                  3. Residual Risk Assessment
                </h4>
                <button
                  type="button"
                  onClick={handleGenerateMitigation}
                  disabled={isGenerating}
                  className="flex items-center bg-calpoly-green hover:opacity-90 text-white text-sm font-bold py-2 px-3 rounded-lg transition duration-300 disabled:opacity-50"
                >
                  <span>{isGenerating ? "Generating..." : "✨ Suggest Mitigation Steps"}</span>
                </button>
              </div>
              
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Additional Control Measures <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows="4"
                  required
                  value={formData.additionalControls}
                  onChange={(e) => handleChange("additionalControls", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
                <p className="text-xs text-gray-500 mt-1">You can edit the AI generated strategies above.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Updated Likelihood <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.updatedLikelihood}
                  onChange={(e) => handleChange("updatedLikelihood", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                >
                  <option value="">Select Likelihood</option>
                  {likelihoods.map((l) => (
                    <option key={l.value} value={l.value}>{l.text}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Updated Impact <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.updatedImpact}
                  onChange={(e) => handleChange("updatedImpact", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                >
                  <option value="">Select Impact</option>
                  {impacts.map((i) => (
                    <option key={i.value} value={i.value}>{i.text}</option>
                  ))}
                </select>
              </div>

              {/* Residual Score Display */}
              <div className="col-span-2 grid grid-cols-3 gap-4 bg-white p-3 rounded-lg border border-gray-200">
                <div className="text-center">
                   <label className="block text-sm font-medium text-gray-500 mb-1">Rating</label>
                   <div className={`font-bold text-lg p-2 rounded-md ${ratingColors[residualData.rating] || "bg-gray-100 text-gray-800"}`}>
                     {residualData.rating}
                   </div>
                </div>
                <div className="text-center">
                   <label className="block text-sm font-medium text-gray-500 mb-1">Score</label>
                   <div className={`font-bold text-lg p-2 rounded-md ${ratingColors[residualData.rating] || "bg-gray-100 text-gray-800"}`}>
                     {residualData.score}
                   </div>
                </div>
                <div className="text-center">
                   <label className="block text-sm font-medium text-gray-500 mb-1">Response</label>
                   <div className="font-semibold text-md p-2 rounded-md bg-gray-100 text-gray-800">
                     {residualData.response}
                   </div>
                </div>
              </div>
            </div>

            {/* --- Section 4: Tracking & Categorization --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="col-span-full text-lg font-semibold text-calpoly-gold mb-2">
                4. Tracking & Categorization
              </h4>
              
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Risk Category <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.riskCategory}
                  onChange={(e) => handleChange("riskCategory", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                >
                  <option value="">Select Category</option>
                  {riskCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                >
                  <option value="">Select Status</option>
                  {statuses.map((s) => (
                     <option key={s} value={s}>{s}</option>
                  ))}
                  <option value="Tolerable">TOLERABLE (Risk Accepted)</option>
                </select>
                
                {formData.status === "Tolerable" && (
                   <div className="mt-2">
                      <select 
                         value={formData.statusTolerance}
                         onChange={(e) => handleChange("statusTolerance", e.target.value)}
                         className="w-full bg-orange-50 border border-orange-200 text-sm rounded px-2 py-1"
                      >
                         <option value="">Select Tolerance Level...</option>
                         <option value="Monitor">Broadly Acceptable (Monitor)</option>
                         <option value="ALARP">Tolerable (ALARP)</option>
                         <option value="Critical">Critical Acceptance (Exec Approval)</option>
                      </select>
                   </div>
                )}
              </div>

              {/* NEW: Departmental Risk Tolerance */}
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center">
                  Department Risk Tolerance
                  <span className="tooltip ml-2">
                    <HelpCircle className="w-4 h-4 text-gray-400" />
                    <span className="tooltiptext w-64 p-2 text-xs">
                      Indicates your department's operational willingness to accept this risk, aligning with the University's Strategic Risk Appetite.
                    </span>
                  </span>
                </label>
                <select
                  value={formData.departmentRiskTolerance}
                  onChange={(e) => handleChange("departmentRiskTolerance", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                >
                  <option value="">Select Tolerance</option>
                  <option value="Zero">Zero / Very Minimal (No appetite to accept this risk)</option>
                  <option value="Low">Low (Willing to accept limited, tightly managed risk)</option>
                  <option value="Moderate">Moderate (Willing to accept measured, well-governed risk)</option>
                </select>
              </div>

              {/* Resource Requirements Buckets (Moved Here - Optional) */}
              <div className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-3 rounded border border-gray-200 mt-2">
                 <h5 className="col-span-full text-sm font-bold text-gray-700 border-b pb-1">
                    Resource Requirements <span className="text-xs font-normal text-gray-500">(Optional)</span>
                 </h5>
                 
                 <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Internal FTEs</label>
                    <input 
                      type="number" step="0.1" placeholder="0.0"
                      value={formData.resourceInternalFTE}
                      onChange={(e) => handleChange("resourceInternalFTE", e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">External Resources</label>
                    <input 
                      type="text" placeholder="Consultants"
                      value={formData.resourceExternal}
                      onChange={(e) => handleChange("resourceExternal", e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Funding ($)</label>
                    <input 
                      type="number" placeholder="0"
                      value={formData.resourceFunding}
                      onChange={(e) => handleChange("resourceFunding", e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                 </div>
              </div>
              
              <div className="col-span-full md:col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Point of Contact for Status
                </label>
                <input
                  type="text"
                  value={formData.statusPoc}
                  onChange={(e) => handleChange("statusPoc", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
              </div>

              <div className="col-span-full md:col-span-1">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  College/Unit Leadership Comments
                </label>
                <textarea
                  rows="3"
                  value={formData.leadershipComments}
                  onChange={(e) => handleChange("leadershipComments", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
              </div>

              {/* ERM & EHS Comments */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 col-span-full">
                 <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">ERM Comments</label>
                    <textarea
                      rows="3"
                      value={formData.ermComments}
                      onChange={(e) => handleChange("ermComments", e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-calpoly-green mb-1 flex items-center">
                       <Sparkles className="w-3 h-3 mr-1" /> EHS Comments (Env. Health & Safety)
                    </label>
                    <textarea
                      rows="3"
                      value={formData.ehsComments}
                      onChange={(e) => handleChange("ehsComments", e.target.value)}
                      className="w-full bg-green-50 border border-green-200 rounded-md shadow-sm px-3 py-2"
                      placeholder="Safety protocols, PPE requirements..."
                    />
                 </div>
              </div>
            </div>

            {/* --- Privacy & Verification Flags --- */}
            <div className="mt-4 flex flex-col md:flex-row gap-4">
               {/* Privacy Toggle */}
               <label className="flex items-center cursor-pointer p-3 bg-gray-100 rounded border border-gray-200 hover:bg-gray-200 transition">
                  <input 
                     type="checkbox"
                     checked={formData.isPrivate}
                     onChange={(e) => handleChange("isPrivate", e.target.checked)}
                     className="h-4 w-4 text-calpoly-green rounded"
                  />
                  <div className="ml-2 flex items-center">
                     <Lock className="w-4 h-4 text-gray-500 mr-2" />
                     <span className="text-sm font-semibold text-gray-700">Mark as Private / Confidential</span>
                  </div>
               </label>

               {/* Attorney-Client Toggle */}
               <label className="flex items-center cursor-pointer p-3 bg-red-50 rounded border border-red-200 hover:bg-red-100 transition">
                  <input 
                     type="checkbox"
                     checked={formData.isAttorneyClientPrivilege}
                     onChange={(e) => handleChange("isAttorneyClientPrivilege", e.target.checked)}
                     className="h-4 w-4 text-red-600 rounded"
                  />
                  <div className="ml-2 flex items-center">
                     <ShieldAlert className="w-4 h-4 text-red-500 mr-2" />
                     <span className="text-sm font-bold text-red-700">Attorney-Client Privilege</span>
                  </div>
               </label>
            </div>

          </div>

          <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded-lg transition duration-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-calpoly-green hover:opacity-90 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ring-1 ring-calpoly-gold"
            >
              Save Risk
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default RiskModal;
