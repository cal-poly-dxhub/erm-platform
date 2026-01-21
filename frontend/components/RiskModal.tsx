import React, { useState, useEffect, useRef } from "react";
import { X, Sparkles, HelpCircle } from "lucide-react";
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
    collegeUnit: "",
    department: "",
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
    statusPoc: "",
    riskCategory: "",
    resourcesNeeded: "",
    leadershipComments: "",
    ermComments: "",
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

  useEffect(() => {
    if (risk) {
      setFormData({
        riskIdNo: risk.riskIdNo || "",
        collegeUnit: risk.collegeUnit || "",
        department: risk.department || "",
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
        statusPoc: risk.statusPoc || "",
        riskCategory: risk.riskCategory || "",
        resourcesNeeded: risk.resourcesNeeded || "",
        leadershipComments: risk.leadershipComments || "",
        ermComments: risk.ermComments || "",
      });
    } else {
      setFormData({
        riskIdNo: "",
        collegeUnit: "",
        department: "",
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
        statusPoc: "",
        riskCategory: "",
        resourcesNeeded: "",
        leadershipComments: "",
        ermComments: "",
      });
    }
    setAiSuggestion(null);
    setLambdaSuggestion(null);
    setLambdaError(null);
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

  // Call Lambda to get category suggestion when department, risk title, and description are filled
  useEffect(() => {
    if (!isOpen) return;
    
    // Clear previous timeout
    if (lambdaCallTimeoutRef.current) {
      clearTimeout(lambdaCallTimeoutRef.current);
    }

    // Check if we have the required fields for category suggestion
    if (formData.department && formData.risk && formData.riskAnalysis) {
      // Debounce the API call
      lambdaCallTimeoutRef.current = setTimeout(async () => {
        setIsLoadingLambda(true);
        setLambdaError(null);
        try {
          const response = await assessRisk(
            formData.department,
            formData.risk,
            formData.riskAnalysis
          );
          
          // Store suggestion and auto-fill category if not manually set
          setLambdaSuggestion((prev) => ({
            ...prev,
            category: response.category,
            notes: response.notes,
            similar: response.similar,
          }));
          
          // Auto-fill category if user hasn't manually set it
          if (response.category && !formData.riskCategory) {
            setFormData((prev) => ({ ...prev, riskCategory: response.category || "" }));
          }
        } catch (error) {
          // Silently fail for category suggestion - don't show error for optional suggestions
          setLambdaError(error instanceof Error ? error.message : "Failed to get suggestions");
        } finally {
          setIsLoadingLambda(false);
        }
      }, 1000); // 1 second debounce
    }

    return () => {
      if (lambdaCallTimeoutRef.current) {
        clearTimeout(lambdaCallTimeoutRef.current);
      }
    };
  }, [formData.department, formData.risk, formData.riskAnalysis, isOpen, formData.riskCategory]);

  // Call Lambda to get baseline likelihood and impact when current controls is entered
  useEffect(() => {
    if (!isOpen) return;
    
    // Clear previous timeout
    if (lambdaCallTimeoutRef.current) {
      clearTimeout(lambdaCallTimeoutRef.current);
    }

    // Check if we have all required fields including current controls
    if (
      formData.department &&
      formData.risk &&
      formData.riskAnalysis &&
      formData.currentControls
    ) {
      // Debounce the API call
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
          
          // Store all suggestions
          setLambdaSuggestion((prev) => ({
            ...prev,
            category: response.category || prev?.category,
            likelihood: response.likelihood,
            impact: response.impact,
            notes: response.notes,
            similar: response.similar,
          }));

          // Auto-fill likelihood and impact from Lambda response
          // Users can still override by manually changing the values
          if (response.likelihood !== undefined && response.likelihood !== null) {
            setFormData((prev) => ({ ...prev, likelihood: String(response.likelihood) }));
          }
          if (response.impact !== undefined && response.impact !== null) {
            setFormData((prev) => ({ ...prev, impact: String(response.impact) }));
          }
          
          // Also auto-fill category if available and not already set
          if (response.category && !formData.riskCategory) {
            setFormData((prev) => ({ ...prev, riskCategory: response.category || "" }));
          }
        } catch (error) {
          setLambdaError(error instanceof Error ? error.message : "Failed to get risk assessment");
        } finally {
          setIsLoadingLambda(false);
        }
      }, 1000); // 1 second debounce
    }

    return () => {
      if (lambdaCallTimeoutRef.current) {
        clearTimeout(lambdaCallTimeoutRef.current);
      }
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

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...formData, id: risk?.id || `risk_${new Date().getTime()}` });
    onClose();
  };

  const applySuggestion = (field, value) => {
    handleChange(field, value);
  };

  const handleGenerateMitigation = async () => {
    // Validate required fields
    if (!formData.risk || !formData.department || !formData.riskAnalysis || !formData.currentControls || !formData.riskCategory) {
      alert("Please fill in Risk, Department, Risk Analysis, Current Controls, and Category before generating mitigation strategies.");
      return;
    }

    if (!formData.likelihood || !formData.impact) {
      alert("Please set baseline Likelihood and Impact before generating mitigation strategies.");
      return;
    }

    setIsGenerating(true);
    try {
      const baselineScore = baselineData.score === "-" ? 0 : Number(baselineData.score);
      
      console.log("Calling generateMitigationStrategies with:", {
        risk: formData.risk,
        department: formData.department,
        riskAnalysis: formData.riskAnalysis,
        currentControls: formData.currentControls,
        category: formData.riskCategory,
        likelihood: formData.likelihood,
        impact: formData.impact,
        baselineScore,
      });

      const response = await generateMitigationStrategies(
        formData.risk,
        formData.department,
        formData.riskAnalysis,
        formData.currentControls,
        formData.riskCategory,
        formData.likelihood,
        formData.impact,
        baselineScore
      );

      console.log("Received response:", response);

      // Store strategies
      const strategies = response.strategies || [];
      setMitigationStrategies(strategies);

      if (strategies.length === 0) {
        alert("No mitigation strategies were generated. Please try again.");
        return;
      }

      // Format strategies for display in additionalControls
      const strategiesText = strategies
        .map((strategy, index) => {
          const typeLabel = strategy.type === "Preventative" ? "Preventative" : 
                           strategy.type === "Detective" ? "Detective" : "Corrective";
          return `${index + 1}. [${typeLabel}] ${strategy.title}\n   ${strategy.description}\n   Urgency: ${strategy.urgency} | Likelihood Impact: ${strategy.likelihood_rating}`;
        })
        .join("\n\n");

      handleChange("additionalControls", strategiesText);

      // Auto-fill residual risk values
      if (response.residual_risk && Object.keys(response.residual_risk).length > 0) {
        if (response.residual_risk.updated_likelihood !== undefined && response.residual_risk.updated_likelihood !== null) {
          setFormData((prev) => ({ ...prev, updatedLikelihood: String(response.residual_risk.updated_likelihood) }));
        }
        if (response.residual_risk.updated_impact !== undefined && response.residual_risk.updated_impact !== null) {
          setFormData((prev) => ({ ...prev, updatedImpact: String(response.residual_risk.updated_impact) }));
        }
      }
    } catch (error) {
      console.error("Error generating mitigation strategies:", error);
      alert(`Could not generate mitigation strategies. ${error instanceof Error ? error.message : "Unknown error"}`);
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

          <div className="mt-4 max-h-[75vh] overflow-y-auto pr-4">
            {/* Section 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="col-span-full text-lg font-semibold text-calpoly-gold mb-2">
                1. Risk Identification & Context
              </h4>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Risk ID No.
                </label>
                <input
                  type="text"
                  value={formData.riskIdNo}
                  onChange={(e) => handleChange("riskIdNo", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  College/Unit
                </label>
                <input
                  type="text"
                  value={formData.collegeUnit}
                  onChange={(e) => handleChange("collegeUnit", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => handleChange("department", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Owner
                </label>
                <input
                  type="text"
                  value={formData.owner}
                  onChange={(e) => handleChange("owner", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
              </div>
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Risk
                </label>
                <textarea
                  rows="3"
                  value={formData.risk}
                  onChange={(e) => handleChange("risk", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
              </div>
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Risk Analysis
                </label>
                <textarea
                  rows="3"
                  value={formData.riskAnalysis}
                  onChange={(e) => handleChange("riskAnalysis", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
              </div>
              {aiSuggestion && (
                <div className="col-span-full mt-2 p-3 bg-calpoly-green/5 border-l-4 border-calpoly-green rounded-r-lg">
                  <div className="flex items-center">
                    <Sparkles className="w-5 h-5 mr-2 text-calpoly-gold" />
                    <h5 className="font-semibold text-calpoly-green">
                      AI Suggestions
                    </h5>
                  </div>
                  <div className="text-sm mt-2 text-gray-700 pl-7">
                    <p className="mb-2">
                      Based on your input, here are some suggestions:
                    </p>
                    <p>
                      <strong>Category:</strong>{" "}
                      <button
                        type="button"
                        onClick={() =>
                          applySuggestion("riskCategory", aiSuggestion.category)
                        }
                        className="ml-2 bg-calpoly-gold/20 text-calpoly-green font-semibold py-1 px-2 rounded-md hover:bg-calpoly-gold/40"
                      >
                        {aiSuggestion.category}
                      </button>
                    </p>
                    {aiSuggestion.impact && (
                      <p className="mt-1">
                        <strong>Impact:</strong>{" "}
                        <button
                          type="button"
                          onClick={() =>
                            applySuggestion("impact", aiSuggestion.impact.value)
                          }
                          className="ml-2 bg-calpoly-gold/20 text-calpoly-green font-semibold py-1 px-2 rounded-md hover:bg-calpoly-gold/40"
                        >
                          {aiSuggestion.impact.text}
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              )}
              {/* Lambda API Suggestions */}
              {(lambdaSuggestion || isLoadingLambda) && (
                <div className="col-span-full mt-2 p-3 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                  <div className="flex items-center">
                    <Sparkles className="w-5 h-5 mr-2 text-blue-600" />
                    <h5 className="font-semibold text-blue-700">
                      Risk Assessment AI Suggestions
                    </h5>
                    {isLoadingLambda && (
                      <span className="ml-2 text-sm text-blue-600">Analyzing...</span>
                    )}
                  </div>
                  {lambdaSuggestion && (
                    <div className="text-sm mt-2 text-gray-700 pl-7">
                      {lambdaSuggestion.category && (
                        <div className="mb-2">
                          <p>
                            <strong>Suggested Category:</strong>{" "}
                            <button
                              type="button"
                              onClick={() =>
                                applySuggestion("riskCategory", lambdaSuggestion.category)
                              }
                              className="ml-2 bg-blue-200 text-blue-800 font-semibold py-1 px-2 rounded-md hover:bg-blue-300"
                            >
                              {lambdaSuggestion.category}
                            </button>
                          </p>
                          {lambdaSuggestion.similar?.risk_ids && lambdaSuggestion.similar.risk_ids.length > 0 && (
                            <p className="mt-1 text-xs text-gray-600">
                              <strong>Similar Risk IDs:</strong>{" "}
                              <span className="text-blue-600 font-medium">
                                {lambdaSuggestion.similar.risk_ids.join(", ")}
                              </span>
                            </p>
                          )}
                        </div>
                      )}
                      {lambdaSuggestion.notes && (
                        <p className="mt-1 text-xs text-gray-600 italic">
                          {lambdaSuggestion.notes}
                        </p>
                      )}
                    </div>
                  )}
                  {lambdaError && (
                    <p className="text-xs text-red-600 mt-2 pl-7">
                      {lambdaError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Section 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="col-span-full text-lg font-semibold text-calpoly-gold mb-2">
                2. Baseline Risk Assessment
              </h4>
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Current Control Measures
                </label>
                <textarea
                  rows="3"
                  value={formData.currentControls}
                  onChange={(e) =>
                    handleChange("currentControls", e.target.value)
                  }
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
                {isLoadingLambda && formData.currentControls && (
                  <p className="text-xs text-blue-600 mt-1">
                    Generating baseline risk assessment...
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Likelihood
                  {lambdaSuggestion?.likelihood && (
                    <span className="ml-2 text-xs text-blue-600 font-normal">
                      (Suggested: {likelihoods.find(l => l.value === lambdaSuggestion.likelihood)?.text || lambdaSuggestion.likelihood})
                    </span>
                  )}
                </label>
                <select
                  value={formData.likelihood}
                  onChange={(e) => handleChange("likelihood", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                >
                  <option value="">Select Likelihood</option>
                  {likelihoods.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.text}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center">
                  Impact
                  {lambdaSuggestion?.impact && (
                    <span className="ml-2 text-xs text-blue-600 font-normal">
                      (Suggested: {impacts.find(i => i.value === lambdaSuggestion.impact)?.text || lambdaSuggestion.impact})
                    </span>
                  )}
                  <span className="tooltip ml-2">
                    <HelpCircle className="w-4 h-4 text-gray-400" />
                    <span
                      className="tooltiptext"
                      dangerouslySetInnerHTML={{ __html: impactTooltipContent }}
                    />
                  </span>
                </label>
                <select
                  value={formData.impact}
                  onChange={(e) => handleChange("impact", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                >
                  <option value="">Select Impact</option>
                  {impacts.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.text}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 grid grid-cols-3 gap-4 bg-white p-3 rounded-lg border border-gray-200">
                <div className="text-center">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Rating
                  </label>
                  <div
                    className={`font-bold text-lg p-2 rounded-md ${
                      ratingColors[baselineData.rating] ||
                      "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {baselineData.rating}
                  </div>
                </div>
                <div className="text-center">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Score
                  </label>
                  <div
                    className={`font-bold text-lg p-2 rounded-md ${
                      ratingColors[baselineData.rating] ||
                      "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {baselineData.score}
                  </div>
                </div>
                <div className="text-center">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Response
                  </label>
                  <div
                    className={`font-semibold text-md p-2 rounded-md ${
                      ratingColors[baselineData.rating] ||
                      "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {baselineData.response}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3 */}
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
                  <span>
                    {isGenerating
                      ? "Generating..."
                      : "✨ Suggest Mitigation Steps"}
                  </span>
                  {isGenerating && <span className="spinner ml-2" />}
                </button>
              </div>
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Additional Control Measures
                </label>
                <textarea
                  rows="4"
                  value={formData.additionalControls}
                  onChange={(e) =>
                    handleChange("additionalControls", e.target.value)
                  }
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
                {mitigationStrategies.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <h5 className="text-sm font-semibold text-calpoly-green mb-2">
                      Generated Mitigation Strategies:
                    </h5>
                    {mitigationStrategies.map((strategy, index) => {
                      const typeColors = {
                        Preventative: "bg-green-100 text-green-800 border-green-300",
                        Detective: "bg-blue-100 text-blue-800 border-blue-300",
                        Corrective: "bg-orange-100 text-orange-800 border-orange-300",
                      };
                      const urgencyColors = {
                        Immediate: "text-red-600 font-bold",
                        Urgent: "text-orange-600 font-semibold",
                        Low: "text-gray-600",
                      };
                      return (
                        <div
                          key={index}
                          className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-1 text-xs font-semibold rounded border ${
                                  typeColors[strategy.type] || "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {strategy.type}
                              </span>
                              <span className="font-semibold text-gray-800">
                                {strategy.title}
                              </span>
                            </div>
                            <span className={`text-xs ${urgencyColors[strategy.urgency] || "text-gray-600"}`}>
                              {strategy.urgency}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{strategy.description}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-600">
                            <span>
                              <strong>Likelihood:</strong> {strategy.likelihood_rating}
                            </span>
                            {strategy.calculated_effectiveness_score !== undefined && (
                              <span>
                                <strong>Effectiveness Score:</strong> {strategy.calculated_effectiveness_score}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Updated Likelihood
                </label>
                <select
                  value={formData.updatedLikelihood}
                  onChange={(e) =>
                    handleChange("updatedLikelihood", e.target.value)
                  }
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                >
                  <option value="">Select Likelihood</option>
                  {likelihoods.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.text}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Updated Impact
                </label>
                <select
                  value={formData.updatedImpact}
                  onChange={(e) =>
                    handleChange("updatedImpact", e.target.value)
                  }
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                >
                  <option value="">Select Impact</option>
                  {impacts.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.text}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 grid grid-cols-3 gap-4 bg-white p-3 rounded-lg border border-gray-200">
                <div className="text-center">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Rating
                  </label>
                  <div
                    className={`font-bold text-lg p-2 rounded-md ${
                      ratingColors[residualData.rating] ||
                      "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {residualData.rating}
                  </div>
                </div>
                <div className="text-center">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Score
                  </label>
                  <div
                    className={`font-bold text-lg p-2 rounded-md ${
                      ratingColors[residualData.rating] ||
                      "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {residualData.score}
                  </div>
                </div>
                <div className="text-center">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Response
                  </label>
                  <div
                    className={`font-semibold text-md p-2 rounded-md ${
                      ratingColors[residualData.rating] ||
                      "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {residualData.response}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="col-span-full text-lg font-semibold text-calpoly-gold mb-2">
                4. Tracking & Categorization
              </h4>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Risk Category
                  {lambdaSuggestion?.category && (
                    <span className="ml-2 text-xs text-blue-600 font-normal">
                      (AI Suggested: {lambdaSuggestion.category})
                    </span>
                  )}
                </label>
                <select
                  value={formData.riskCategory}
                  onChange={(e) => handleChange("riskCategory", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                >
                  <option value="">Select Category</option>
                  {riskCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                >
                  <option value="">Select Status</option>
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Point of Contact for Status
                </label>
                <input
                  type="text"
                  value={formData.statusPoc}
                  onChange={(e) => handleChange("statusPoc", e.target.value)}
                  placeholder="e.g., Jane Doe, Project Manager"
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
              </div>
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Resources Needed
                </label>
                <textarea
                  rows="3"
                  value={formData.resourcesNeeded}
                  onChange={(e) =>
                    handleChange("resourcesNeeded", e.target.value)
                  }
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  College/Unit Leadership Comments
                </label>
                <textarea
                  rows="3"
                  value={formData.leadershipComments}
                  onChange={(e) =>
                    handleChange("leadershipComments", e.target.value)
                  }
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  ERM Comments
                </label>
                <textarea
                  rows="3"
                  value={formData.ermComments}
                  onChange={(e) => handleChange("ermComments", e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-calpoly-gold"
                />
              </div>
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
