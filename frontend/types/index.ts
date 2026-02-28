// Risk data types
export interface Risk {
  id: string;
  riskIdNo?: string;
  /** Form scope: "college" | "unit" (used by RiskModal for dropdowns). */
  orgType?: "college" | "unit";
  /** College value when orgType is "college". */
  college?: string;
  /** Unit value when orgType is "unit". */
  unit?: string;
  collegeUnit?: string;
  department?: string;
  owner?: string;
  risk?: string;
  riskAnalysis?: string;
  currentControls?: string;
  likelihood?: string;
  impact?: string;
  additionalControls?: string;
  updatedLikelihood?: string;
  updatedImpact?: string;
  status?: string;
  /** Whether the risk applies college-wide (vs a specific department/unit). */
  isCollegeWide?: boolean;
  /** Free-text tolerance / follow-up status. */
  statusTolerance?: string;
  statusPoc?: string;
  riskCategory?: string;
  /** Department's stated risk tolerance (used in gap analysis and review). */
  departmentRiskTolerance?: string;
  /** Resource estimates captured on the form. */
  resourceInternalFTE?: string;
  resourceExternal?: string;
  resourceFunding?: string;
  resourcesNeeded?: string;
  leadershipComments?: string;
  ermComments?: string;
  ehsComments?: string;
  /** Privacy flags for sensitive risks. */
  isPrivate?: boolean;
  isAttorneyClientPrivilege?: boolean;
  /** Approval state: "pending" | "approved" | "rejected". Only "approved" appears in dashboard analytics. */
  approvalStatus?: "pending" | "approved" | "rejected";
  /** Set when an admin rejects the risk; visible only to admins. */
  rejectionReason?: string;
}

export interface Likelihood {
  text: string;
  value: number;
  description: string;
}

export interface Impact {
  text: string;
  value: number;
  details: {
    ops: string;
    rep: string;
    legal: string;
    people: string;
  };
}

export interface RiskData {
  score: number | string;
  rating: string;
  response: string;
}
