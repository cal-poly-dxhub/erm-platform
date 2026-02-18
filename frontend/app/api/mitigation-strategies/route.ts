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
      console.log("Received request body:", JSON.stringify(body, null, 2));
      console.log("Body type:", typeof body);
      console.log("Body keys:", Object.keys(body || {}));
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

    // Extract residual_risk from the result (Lambda uses updated_scores)
    let residualRisk = {};
    if (result.residual_risk) {
      residualRisk = result.residual_risk;
    } else if (result.updated_scores) {
      // Map updated_scores to residual_risk format
      residualRisk = {
        updated_likelihood: result.updated_scores.updated_likelihood,
        updated_impact: result.updated_scores.updated_impact,
      };
    }

    return NextResponse.json({
      strategies: result.strategies || [],
      residual_risk: residualRisk,
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
