import {
  COGNITO_GROUP_ADMIN,
  COGNITO_GROUP_SUPER_ADMIN,
  COGNITO_GROUP_USER,
} from "@/lib/auth/groups";

/** Cognito group names (must match User Pool groups and AVP UserGroup entities). */
export const COGNITO_GROUPS = [
  COGNITO_GROUP_USER,
  COGNITO_GROUP_ADMIN,
  COGNITO_GROUP_SUPER_ADMIN,
] as const;
export type CognitoGroup = (typeof COGNITO_GROUPS)[number];

export type Role = CognitoGroup;

const ROLE_RANK: Record<Role, number> = {
  [COGNITO_GROUP_USER]: 1,
  [COGNITO_GROUP_ADMIN]: 2,
  [COGNITO_GROUP_SUPER_ADMIN]: 3,
};

/**
 * Highest Cognito group on the session (for display only).
 * Route access is enforced by AVP — do not use this to authorize API calls.
 */
export function getRole(groups: string[]): Role | null {
  let best: Role | null = null;
  let bestRank = 0;

  for (const group of groups) {
    if (!COGNITO_GROUPS.includes(group as Role)) continue;
    const rank = ROLE_RANK[group as Role];
    if (rank > bestRank) {
      best = group as Role;
      bestRank = rank;
    }
  }

  return best;
}
