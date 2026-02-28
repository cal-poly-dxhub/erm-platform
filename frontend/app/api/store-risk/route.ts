import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";

const STORE_RISK_LAMBDA_API_URL =
  process.env.STORE_RISK_LAMBDA_API_URL || "";

function toNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return false;
  return String(value).toLowerCase() === "true" || String(value) === "1";
}

function toPositiveInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

/**
 * Maps frontend risk payload to Lambda body matching RDS columns exactly.
 * unit = user's selection from college dropdown OR unit dropdown (they pick one).
 */
function buildLambdaBody(body: Record<string, unknown>) {
  const baselineLikelihood = toNum(body.likelihood ?? body.baseline_likelihood);
  const baselineImpact = toNum(body.impact ?? body.baseline_impact);
  const baselineScore =
    baselineLikelihood != null && baselineImpact != null
      ? baselineLikelihood * baselineImpact
      : null;
  const unitValue = toStr(body.unit || body.college || "");
  const recordId = toPositiveInt(body.id);
  const actionValue = toStr(body.action ?? (recordId ? "update" : "create"));

  return {
    ...(recordId ? { id: recordId } : {}),
    action: actionValue,
    risk_id: toStr(body.riskIdNo ?? body.risk_id ?? ""),
    unit: unitValue,
    department: toStr(body.department ?? ""),
    owner: toStr(body.owner ?? ""),
    risk_description: toStr(body.risk ?? body.risk_description ?? ""),
    risk_analysis: toStr(body.riskAnalysis ?? body.risk_analysis ?? ""),
    category: toStr(body.riskCategory ?? body.category ?? ""),
    current_controls: toStr(body.currentControls ?? body.current_controls ?? ""),
    baseline_likelihood: baselineLikelihood ?? null,
    baseline_impact: baselineImpact ?? null,
    baseline_risk_rating: baselineScore ?? null,
    mitigation_strategies: toStr(
      body.additionalControls ?? body.mitigation_strategies ?? ""
    ),
    updated_likelihood:
      toNum(body.updatedLikelihood ?? body.updated_likelihood) ?? null,
    updated_impact: toNum(body.updatedImpact ?? body.updated_impact) ?? null,
    residual_risk_rating:
      toNum(body.residual_risk_rating ?? body.residualRiskRating) ??
      baselineScore ??
      0,
    status: toStr(body.status ?? ""),
    internal_resources:
      toNum(body.resourceInternalFTE ?? body.internal_resources) ?? null,
    external_resources: toStr(
      body.resourceExternal ?? body.external_resources ?? ""
    ),
    funding_required: toNum(body.resourceFunding ?? body.funding_required) ?? null,
    risk_tolerance: toStr(
      body.departmentRiskTolerance ?? body.risk_tolerance ?? ""
    ),
    is_college_wide: toBool(body.isCollegeWide ?? body.is_college_wide),
    status_poc: toStr(body.statusPoc ?? body.status_poc ?? ""),
    is_private: toBool(body.isPrivate ?? body.is_private),
    is_attorney_client_privilege: toBool(
      body.isAttorneyClientPrivilege ?? body.is_attorney_client_privilege
    ),
    erm_comments: toStr(body.ermComments ?? body.erm_comments ?? ""),
    ehs_comments: toStr(body.ehsComments ?? body.ehs_comments ?? ""),
    leadership_comments: toStr(
      body.leadershipComments ?? body.leadership_comments ?? ""
    ),
    status_tolerance: toStr(body.statusTolerance ?? body.status_tolerance ?? ""),
    approval_status: toStr(body.approvalStatus ?? body.approval_status ?? ""),
  };
}

export async function POST(request: NextRequest) {
  const session = readSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!STORE_RISK_LAMBDA_API_URL) {
    return NextResponse.json(
      { error: "Store risk API URL not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const lambdaBody = buildLambdaBody(body);

    console.log("sending to Lambda:", JSON.stringify(lambdaBody, null, 2)); // ADD THIS


    const authHeader =
      request.headers.get("Authorization") ??
      (session.accessToken ? `Bearer ${session.accessToken}` : null);
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized. Missing access token." },
        { status: 401 }
      );
    }

    const response = await fetch(STORE_RISK_LAMBDA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(lambdaBody),
    });

    const responseBody = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Store risk failed: ${response.status}`,
          upstreamBody: responseBody || undefined,
        },
        { status: response.status }
      );
    }

    const data = responseBody ? JSON.parse(responseBody) : {};
    const result = data?.body
      ? typeof data.body === "string"
        ? JSON.parse(data.body)
        : data.body
      : data;
    return NextResponse.json(result ?? { ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to store risk",
      },
      { status: 500 }
    );
  }
}
