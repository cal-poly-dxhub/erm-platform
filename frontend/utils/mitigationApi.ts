// Client-side utility for calling the mitigation strategies API
// The actual Lambda API call is handled by the Next.js API route at /api/mitigation-strategies

export interface MitigationStrategiesResponse {
  mitigation_strategies: string;
  updated_scores: {
    updated_likelihood?: number;
    updated_impact?: number;
  };
}

export interface MitigationStrategyRequest {
  risk_title: string;
  department: string;
  risk_description: string;
  current_controls: string;
  category: string;
  baseline_likelihood: number | string;
  baseline_impact: number | string;
  baseline_score: number | string;
  mitigation_strategies?: string;
}

export const generateMitigationStrategies = async (
  riskTitle: string,
  department: string,
  riskDescription: string,
  currentControls: string,
  category: string,
  baselineLikelihood: number | string,
  baselineImpact: number | string,
  baselineScore: number | string,
  mitigationStrategies?: string
): Promise<MitigationStrategiesResponse> => {
  if (!riskTitle || !department || !riskDescription || !currentControls || !category) {
    throw new Error("Please provide all required fields for mitigation strategy generation");
  }

  const payload: MitigationStrategyRequest = {
    risk_title: riskTitle,
    department,
    risk_description: riskDescription,
    current_controls: currentControls,
    category,
    baseline_likelihood: baselineLikelihood,
    baseline_impact: baselineImpact,
    baseline_score: baselineScore,
  };
  if (mitigationStrategies && mitigationStrategies.trim()) {
    payload.mitigation_strategies = mitigationStrategies;
  }

  console.log("Sending payload to API:", JSON.stringify(payload, null, 2));

  try {
    // Call our Next.js API route which proxies to Lambda
    const response = await fetch("/api/mitigation-strategies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      throw new Error(
        errorData.error || `API call failed with status: ${response.status}: ${errorText}`
      );
    }

    const data = await response.json();
    console.log("Mitigation API response:", data);

    const mitigationText =
      typeof data.mitigation_strategies === "string"
        ? data.mitigation_strategies
        : "";
    const updatedScores =
      data.updated_scores && typeof data.updated_scores === "object"
        ? data.updated_scores
        : data.residual_risk && typeof data.residual_risk === "object"
          ? data.residual_risk
          : {};

    return {
      mitigation_strategies: mitigationText,
      updated_scores: updatedScores,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to generate mitigation strategies: Unknown error occurred");
  }
};
