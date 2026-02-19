// Risk data types
export interface Risk {
  id: string;
  riskIdNo?: string;
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
  statusPoc?: string;
  riskCategory?: string;
  resourcesNeeded?: string;
  leadershipComments?: string;
  ermComments?: string;
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
