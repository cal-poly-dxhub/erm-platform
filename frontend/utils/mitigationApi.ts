// Client-side utility for calling the mitigation strategies API
// The actual Lambda API call is handled by the Next.js API route at /api/mitigation-strategies

export interface MitigationStrategy {
  title: string;
  type: "Preventative" | "Detective" | "Corrective";
  description: string;
  scores: {
    financial: "Significant Effect" | "Moderate Effect" | "Little to No Effect";
    legal: "Significant Effect" | "Moderate Effect" | "Little to No Effect";
    reputation: "Significant Effect" | "Moderate Effect" | "Little to No Effect";
    safety: "Significant Effect" | "Moderate Effect" | "Little to No Effect";
    service: "Significant Effect" | "Moderate Effect" | "Little to No Effect";
    workforce: "Significant Effect" | "Moderate Effect" | "Little to No Effect";
  };
  likelihood_rating: "Decreases Likelihood" | "Does Not Change" | "Increases Likelihood";
  urgency: "Immediate" | "Urgent" | "Low";
  calculated_effectiveness_score?: number;
}

export interface MitigationStrategiesResponse {
  strategies: MitigationStrategy[];
  residual_risk: {
    updated_likelihood: number;
    updated_impact: number;
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
}

export const generateMitigationStrategies = async (
  riskTitle: string,
  department: string,
  riskDescription: string,
  currentControls: string,
  category: string,
  baselineLikelihood: number | string,
  baselineImpact: number | string,
  baselineScore: number | string
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

  console.log("Sending payload to API:", JSON.stringify(payload, null, 2));

  try {
    // Call our Next.js API route which proxies to Lambda
    const response = await fetch("/api/mitigation-strategies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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

    return {
      strategies: data.strategies || [],
      residual_risk: data.residual_risk || {},
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to generate mitigation strategies: Unknown error occurred");
  }
};
