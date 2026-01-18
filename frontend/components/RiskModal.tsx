import React, { useState, useEffect } from "react";
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
    setIsGenerating(true);
    try {
      const steps = await generateMitigationSteps(
        formData.risk,
        formData.riskAnalysis,
        formData.currentControls
      );
      handleChange("additionalControls", steps);
    } catch (error) {
      alert(`Could not generate mitigation steps. ${error.message}`);
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
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Likelihood
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
