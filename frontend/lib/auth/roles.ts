export const ROLES = ["user", "admin", "superadmin"] as const;
export type Role = (typeof ROLES)[number];

const ROLE_RANK: Record<Role, number> = {
  user: 1,
  admin: 2,
  superadmin: 3,
};

/** Highest recognized app role from Cognito groups (one role per person). */
export function getRole(groups: string[]): Role | null {
  let best: Role | null = null;
  let bestRank = 0;

  for (const group of groups) {
    if (!ROLES.includes(group as Role)) continue;
    const rank = ROLE_RANK[group as Role];
    if (rank > bestRank) {
      best = group as Role;
      bestRank = rank;
    }
  }

  return best;
}

/** True if the user has user, admin, or superadmin. */
export function hasAppAccess(groups: string[]): boolean {
  return getRole(groups) !== null;
}

/** True if role is at least `min` (admin includes superadmin). */
export function hasMinRole(groups: string[], min: Role): boolean {
  const role = getRole(groups);
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
