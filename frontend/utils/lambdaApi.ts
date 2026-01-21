// Client-side utility for calling the risk assessment API
// The actual Lambda API call is handled by the Next.js API route at /api/risk-assessment

export interface LambdaRiskResponse {
  likelihood?: number;
  impact?: number;
  category?: string;
  notes?: string;
  similar?: {
    merged: boolean;
    risk_ids: string[];
  };
}

export interface LambdaRiskRequest {
  department: string;
  risk_title: string;
  risk_description: string;
  current_controls?: string;
}

export const assessRisk = async (
  department: string,
  riskTitle: string,
  riskDescription: string,
  currentControls?: string
): Promise<LambdaRiskResponse> => {
  if (!department || !riskTitle || !riskDescription) {
    throw new Error(
      "Please provide department, risk title, and risk description"
    );
  }

  const payload: LambdaRiskRequest = {
    department,
    risk_title: riskTitle,
    risk_description: riskDescription,
    ...(currentControls && { current_controls: currentControls }),
  };

  try {
    // Call our Next.js API route which proxies to Lambda
    const response = await fetch("/api/risk-assessment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `API call failed with status: ${response.status}`
      );
    }

    const data = await response.json();
    
    return {
      likelihood: data.likelihood,
      impact: data.impact,
      category: data.category,
      notes: data.notes,
      similar: data.similar,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to assess risk: Unknown error occurred");
  }
};
