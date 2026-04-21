import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";

const MITIGATION_LAMBDA_API_URL = process.env.MITIGATION_LAMBDA_API_URL || "";

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

export async function POST(request: NextRequest) {
  try {
    const session = readSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!MITIGATION_LAMBDA_API_URL || MITIGATION_LAMBDA_API_URL === "") {
      return NextResponse.json(
        { error: "Mitigation Lambda API URL not configured" },
        { status: 500 }
      );
    }

    let body: MitigationStrategyRequest;
    try {
      body = await request.json();
    } catch (error) {
      console.error("Error parsing request body:", error);
      return NextResponse.json(
        {
          error: "Invalid JSON in request body",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 400 }
      );
    }

    // Validate required fields
    const requiredFields = [
      "risk_title",
      "department",
      "risk_description",
      "current_controls",
      "category",
      "baseline_likelihood",
      "baseline_impact",
      "baseline_score",
    ];

    const missing = requiredFields.filter((f) => {
      const value = body?.[f as keyof typeof body];
      console.log(`Field ${f}:`, value, "type:", typeof value);
      // Check if value is undefined, null, or empty string (but allow 0 as valid)
      return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
    });
    
    if (missing.length > 0) {
      console.error("Missing fields:", missing);
      return NextResponse.json(
        {
          error: "Missing required fields",
          missing,
          received_body: body,
        },
        { status: 400 }
      );
    }

    // Call Lambda function
    const response = await fetch(MITIGATION_LAMBDA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        risk_title: body.risk_title,
        department: body.department,
        risk_description: body.risk_description,
        current_controls: body.current_controls,
        category: body.category,
        baseline_likelihood: Number(body.baseline_likelihood),
        baseline_impact: Number(body.baseline_impact),
        baseline_score: Number(body.baseline_score),
        ...(body.mitigation_strategies && body.mitigation_strategies.trim()
          ? { mitigation_strategies: body.mitigation_strategies }
          : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Lambda API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Handle both wrapped body and direct response
    let result;
    if (data.body) {
      // If body is a string, parse it
      result = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
    } else {
      result = data;
    }

    console.log("Parsed Lambda response:", result);

    const updatedScores =
      result.updated_scores && typeof result.updated_scores === "object"
        ? result.updated_scores
        : result.residual_risk && typeof result.residual_risk === "object"
          ? result.residual_risk
          : {};

    let mitigationText =
      typeof result.mitigation_strategies === "string"
        ? result.mitigation_strategies
        : "";
    if (!mitigationText) {
      if (Array.isArray(result.strategies)) {
        mitigationText = result.strategies
          .map((item: unknown) => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object") {
              const s = item as Record<string, unknown>;
              const title = typeof s.title === "string" ? s.title : "Strategy";
              const description =
                typeof s.description === "string" ? s.description : "";
              return description ? `${title}: ${description}` : title;
            }
            return "";
          })
          .filter(Boolean)
          .join("\n");
      } else if (result.strategies && typeof result.strategies === "string") {
        mitigationText = result.strategies;
      }
    }

    return NextResponse.json({
      mitigation_strategies: mitigationText,
      updated_scores: updatedScores,
      // Backward compatibility for any callers still reading residual_risk.
      residual_risk: updatedScores,
    });
  } catch (error) {
    console.error("Error calling Mitigation Lambda API:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
