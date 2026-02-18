import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";

const LAMBDA_API_URL = process.env.LAMBDA_API_URL || "";

export interface LambdaRiskRequest {
  department: string;
  risk_title: string;
  risk_description: string;
  current_controls?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = readSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!LAMBDA_API_URL || LAMBDA_API_URL === "") {
      return NextResponse.json(
        { error: "Lambda API URL not configured" },
        { status: 500 }
      );
    }

    const body: LambdaRiskRequest = await request.json();

    // Validate required fields
    if (!body.department || !body.risk_title || !body.risk_description) {
      return NextResponse.json(
        { error: "Missing required fields: department, risk_title, risk_description" },
        { status: 400 }
      );
    }

    // Call Lambda function
    const response = await fetch(LAMBDA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        department: body.department,
        risk_title: body.risk_title,
        risk_description: body.risk_description,
        ...(body.current_controls && { current_controls: body.current_controls }),
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
    const result = data.body ? JSON.parse(data.body) : data;

    return NextResponse.json({
      likelihood: result.likelihood,
      impact: result.impact,
      category: result.category,
      notes: result.notes,
      similar: result.similar,
    });
  } catch (error) {
    console.error("Error calling Lambda API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
