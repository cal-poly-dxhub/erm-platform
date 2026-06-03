const COLLEGE_LABELS: Record<string, string> = {
  cafes: "College of Agriculture, Food & Env. Sciences (CAFES)",
  caed: "College of Architecture & Env. Design (CAED)",
  ocob: "Orfalea College of Business (OCOB)",
  ceng: "College of Engineering (CENG)",
  cla: "College of Liberal Arts (CLA)",
  bcsm: "Bailey College of Science & Mathematics (BCSM)",
  cpace: "Extended, Professional & Continuing Education",
};

const UNIT_LABELS: Record<string, string> = {
  academic_affairs: "Academic Affairs",
  admin_finance: "Administration & Finance",
  student_affairs: "Student Affairs",
  diversity: "Diversity & Inclusion (OUDI)",
  research: "Research & Graduate Programs",
  its: "Information Technology Services (ITS)",
  facilities: "Facilities Management & Development",
  public_safety: "Public Safety / University Police",
  partners: "Cal Poly Partners (Corporation)",
  advancement: "University Development & Alumni Engagement",
  marketing: "University Communications & Marketing",
};

export function collegeLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return COLLEGE_LABELS[slug] ?? slug;
}

export function unitLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return UNIT_LABELS[slug] ?? slug;
}

export function organizationScopeLabel(
  college: string | null | undefined,
  unit: string | null | undefined,
): string | null {
  if (college) return collegeLabel(college);
  if (unit) return unitLabel(unit);
  return null;
}
